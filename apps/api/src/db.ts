import { applyDbEnv } from "./config";
import { PrismaClient } from "../generated/prisma-client";

let prismaClient: PrismaClient | null = null;

export const getPrisma = (): PrismaClient => {
  if (!prismaClient) {
    applyDbEnv();
    prismaClient = new PrismaClient();
  }
  return prismaClient;
};
