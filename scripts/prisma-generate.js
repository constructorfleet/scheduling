const inferDbTypeFromUrl = (url) => {
  if (url.startsWith("file:")) return "sqlite";
  if (url.startsWith("postgresql:") || url.startsWith("postgres:")) return "postgres";
  return null;
};

const getArgValue = (key) => {
  const prefix = `--${key}=`;
  const entry = process.argv.find((arg) => arg.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : undefined;
};

const resolveDbType = () => {
  const urlFromEnv = process.env.DATABASE_URL;
  const urlFromArgs = getArgValue("db-url") ?? getArgValue("database-url");
  const resolvedUrl = urlFromArgs ?? urlFromEnv ?? undefined;

  const dbTypeArg = getArgValue("db") ?? getArgValue("db-type") ?? process.env.DB_TYPE;
  const inferred = resolvedUrl ? inferDbTypeFromUrl(resolvedUrl) : null;

  return (dbTypeArg ?? inferred ?? "sqlite");
};

const resolveDbUrl = (dbType) => {
  const urlFromEnv = process.env.DATABASE_URL;
  const urlFromArgs = getArgValue("db-url") ?? getArgValue("database-url");
  const resolvedUrl = urlFromArgs ?? urlFromEnv ?? undefined;

  if (resolvedUrl) {
    return resolvedUrl;
  }

  if (dbType === "sqlite") {
    const file =
      getArgValue("db-file") ??
      process.env.DB_FILE ??
      process.env.DB_NAME ??
      "data.db";
    return `file:${file.startsWith("./") ? file : `./${file}`}`;
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
    return `postgresql://${auth}@${host}${portPart}/${name}`;
  }

  throw new Error(`Unsupported db type "${dbType}". Use sqlite or postgres.`);
};

const main = async () => {
  const dbType = resolveDbType();
  if (!["sqlite", "postgres"].includes(dbType)) {
    throw new Error(`Unsupported db type "${dbType}". Use sqlite or postgres.`);
  }

  process.env.DATABASE_URL = resolveDbUrl(dbType);

  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(
    "npx",
    ["prisma", "generate", "--schema", `prisma/schema.${dbType}.prisma`],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
