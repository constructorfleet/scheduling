export type DbType = "sqlite" | "postgres" | "mysql";

const getArgValue = (key: string) => {
  const prefix = `--${key}=`;
  const entry = process.argv.find((arg) => arg.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : undefined;
};

const getArgFlag = (key: string) => process.argv.includes(`--${key}`);

const inferDbTypeFromUrl = (url: string): DbType | null => {
  if (url.startsWith("file:")) return "sqlite";
  if (url.startsWith("postgresql:") || url.startsWith("postgres:")) return "postgres";
  if (url.startsWith("mysql:")) return "mysql";
  return null;
};

export interface DbConfig {
  dbType: DbType;
  url: string;
}

export const resolveDbConfig = (): DbConfig => {
  const urlFromEnv = process.env.DATABASE_URL;
  const urlFromArgs = getArgValue("db-url") ?? getArgValue("database-url");
  const resolvedUrl = urlFromArgs ?? urlFromEnv ?? undefined;

  const dbTypeArg = getArgValue("db") ?? getArgValue("db-type") ?? process.env.DB_TYPE;
  const inferred = resolvedUrl ? inferDbTypeFromUrl(resolvedUrl) : null;

  const dbType: DbType = (dbTypeArg as DbType) ?? inferred ?? "sqlite";

  if (resolvedUrl) {
    return { dbType, url: resolvedUrl };
  }

  if (dbType === "sqlite") {
    const file =
      getArgValue("db-file") ??
      process.env.DB_FILE ??
      process.env.DB_NAME ??
      "data.db";
    return { dbType, url: `file:${file.startsWith("./") ? file : `./${file}`}` };
  }

  const host = getArgValue("db-host") ?? process.env.DB_HOST;
  const port = getArgValue("db-port") ?? process.env.DB_PORT;
  const user = getArgValue("db-user") ?? process.env.DB_USER;
  const password = getArgValue("db-password") ?? process.env.DB_PASSWORD ?? "";
  const name = getArgValue("db-name") ?? process.env.DB_NAME;

  if (!host || !user || !name) {
    throw new Error(
      `Missing database connection details for ${dbType}. Provide DB_HOST, DB_USER, DB_NAME (and DB_PASSWORD if needed).`
    );
  }

  const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
  const portPart = port ? `:${port}` : "";

  if (dbType === "postgres") {
    return { dbType, url: `postgresql://${auth}@${host}${portPart}/${name}` };
  }

  return { dbType, url: `mysql://${auth}@${host}${portPart}/${name}` };
};

export const applyDbEnv = (): DbConfig => {
  const config = resolveDbConfig();
  process.env.DATABASE_URL = config.url;
  return config;
};

export const isDebugEnabled = () => getArgFlag("debug") || process.env.DEBUG === "1";
