import crypto from "node:crypto";

const PASSWORD_VERSION = "scrypt-v1";
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export const SESSION_COOKIE_NAME = "sched_session";
export const CSRF_COOKIE_NAME = "sched_csrf";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const INVITE_TTL_MS = 1000 * 60 * 60 * 72;

const toBase64Url = (buffer: Buffer) =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const hashSessionToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");
export const hashInviteToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const createSessionToken = () => toBase64Url(crypto.randomBytes(32));
export const createInviteToken = () => toBase64Url(crypto.randomBytes(32));
export const createCsrfToken = () => toBase64Url(crypto.randomBytes(24));

export const createSessionExpiry = () => new Date(Date.now() + SESSION_TTL_MS);
export const createInviteExpiry = () => new Date(Date.now() + INVITE_TTL_MS);

export const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });
  return [
    PASSWORD_VERSION,
    SCRYPT_N.toString(10),
    SCRYPT_R.toString(10),
    SCRYPT_P.toString(10),
    toBase64Url(salt),
    toBase64Url(derived)
  ].join("$");
};

export const verifyPassword = (password: string, encodedHash: string): boolean => {
  const [version, nRaw, rRaw, pRaw, saltRaw, derivedRaw] = encodedHash.split("$");
  if (!version || !nRaw || !rRaw || !pRaw || !saltRaw || !derivedRaw || version !== PASSWORD_VERSION) {
    return false;
  }
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }
  const salt = fromBase64Url(saltRaw);
  const expected = fromBase64Url(derivedRaw);
  const actual = crypto.scryptSync(password, salt, expected.byteLength, { N, r, p });
  return crypto.timingSafeEqual(actual, expected);
};
