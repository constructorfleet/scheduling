import { applyDbEnv } from "./config";

let prismaPromise: Promise<any> | null = null;

const loadPrismaClient = async (dbType: string) => {
  switch (dbType) {
    case "postgres":
      return import("../generated/prisma-postgres");
    case "mysql":
      return import("../generated/prisma-mysql");
    case "sqlite":
    default:
      return import("../generated/prisma-sqlite");
  }
};

export const getPrisma = async () => {
  if (!prismaPromise) {
    prismaPromise = (async () => {
      const { dbType } = applyDbEnv();
      const module = await loadPrismaClient(dbType);
      const PrismaClient = module.PrismaClient as new () => any;
      return new PrismaClient();
    })();
  }
  return prismaPromise;
};
