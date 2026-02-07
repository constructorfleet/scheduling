const getArgValue = (key: string) => {
  const prefix = `--${key}=`;
  const entry = process.argv.find((arg) => arg.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : undefined;
};

const getArgFlag = (key: string) => process.argv.includes(`--${key}`);

export interface DbConfig {
  url: string;
}

export const resolveDbConfig = (): DbConfig => {
  const urlFromEnv = process.env.DATABASE_URL;
  const urlFromArgs = getArgValue("db-url") ?? getArgValue("database-url");
  const resolvedUrl = urlFromArgs ?? urlFromEnv ?? undefined;

  if (resolvedUrl) {
    return { url: resolvedUrl };
  }

  const file = getArgValue("db-file") ?? process.env.DB_FILE ?? process.env.DB_NAME ?? "scheduling.db";
  return { url: `file:${file.startsWith("./") ? file : `./${file}`}` };
};

export const applyDbEnv = (): DbConfig => {
  const config = resolveDbConfig();
  process.env.DATABASE_URL = config.url;
  return config;
};

export const isDebugEnabled = () => getArgFlag("debug") || process.env.DEBUG === "1";
