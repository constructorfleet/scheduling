import { copyFile, mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { resolveDbConfig } from "./config";

const DEFAULT_BACKUP_INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_MIN_WRITE_BACKUP_INTERVAL_MS = 60 * 1000;
const DEFAULT_RETENTION_COUNT = 72;

let lastWriteBackupAt = 0;
let backupInFlight: Promise<void> | null = null;

const pad = (value: number) => `${value}`.padStart(2, "0");
const timestamp = (input = new Date()) => {
  return [
    input.getFullYear(),
    pad(input.getMonth() + 1),
    pad(input.getDate())
  ].join("") + "-" + [pad(input.getHours()), pad(input.getMinutes()), pad(input.getSeconds())].join("");
};

const resolveSqlitePath = () => {
  const { url } = resolveDbConfig();
  if (!url.startsWith("file:")) {
    return null;
  }
  const filePath = url.slice("file:".length).split("?")[0];
  if (!filePath) {
    return null;
  }
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.resolve(process.cwd(), filePath);
};

const resolveBackupDir = () => {
  const configured = process.env.DB_BACKUP_DIR?.trim();
  if (!configured) {
    return path.resolve(process.cwd(), "backups");
  }
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const pruneBackups = async (dir: string, keep: number) => {
  const entries = await readdir(dir);
  const backupFiles = await Promise.all(
    entries
      .filter((entry) => entry.startsWith("scheduling-") && entry.endsWith(".db"))
      .map(async (entry) => {
        const fullPath = path.join(dir, entry);
        const fileStat = await stat(fullPath);
        return { fullPath, mtimeMs: fileStat.mtimeMs };
      })
  );
  if (backupFiles.length <= keep) {
    return;
  }
  backupFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const stale = backupFiles.slice(keep);
  await Promise.all(stale.map((file) => unlink(file.fullPath)));
};

const runBackup = async (reason: string) => {
  const sqlitePath = resolveSqlitePath();
  if (!sqlitePath) {
    return;
  }
  const backupDir = resolveBackupDir();
  await mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `scheduling-${timestamp()}-${reason}.db`);
  await copyFile(sqlitePath, backupPath);
  await pruneBackups(
    backupDir,
    parsePositiveInt(process.env.DB_BACKUP_RETENTION_COUNT, DEFAULT_RETENTION_COUNT)
  );
};

const queueBackup = (reason: string) => {
  if (!backupInFlight) {
    backupInFlight = runBackup(reason).finally(() => {
      backupInFlight = null;
    });
    return backupInFlight;
  }
  backupInFlight = backupInFlight.finally(async () => {
    await runBackup(reason);
  });
  return backupInFlight;
};

export const backupBeforeWrite = async () => {
  const now = Date.now();
  const minIntervalMs = parsePositiveInt(
    process.env.DB_WRITE_BACKUP_MIN_INTERVAL_MS,
    DEFAULT_MIN_WRITE_BACKUP_INTERVAL_MS
  );
  if (now - lastWriteBackupAt < minIntervalMs) {
    return;
  }
  lastWriteBackupAt = now;
  await queueBackup("write");
};

export const startPeriodicBackups = () => {
  const intervalMs = parsePositiveInt(
    process.env.DB_BACKUP_INTERVAL_MS,
    DEFAULT_BACKUP_INTERVAL_MS
  );
  if (intervalMs <= 0) {
    return;
  }
  const timer = setInterval(() => {
    void queueBackup("periodic");
  }, intervalMs);
  timer.unref();
};
