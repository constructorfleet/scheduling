import { applyDbEnv } from "./config";
import { PrismaClient } from "../generated/prisma-client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

let prismaClient: PrismaClient | null = null;

export const getPrisma = (): PrismaClient => {
  if (!prismaClient) {
    const { url } = applyDbEnv();
    const adapter = new PrismaBetterSqlite3({ url });
    prismaClient = new PrismaClient({ adapter });
  }
  return prismaClient;
};
