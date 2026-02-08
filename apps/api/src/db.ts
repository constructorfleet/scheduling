import { applyDbEnv } from "./config";
import { PrismaClient } from "../generated/prisma-client";
import { PrismaPg } from "@prisma/adapter-pg";

let prismaClient: PrismaClient | null = null;

export const getPrisma = (): PrismaClient => {
    if (!prismaClient) {
        const { url } = applyDbEnv();
        const adapter = new PrismaPg({ connectionString: url });
        prismaClient = new PrismaClient({ adapter });
    }
    return prismaClient;
};

export const resetPrisma = async () => {
    if (prismaClient) {
        await prismaClient.$disconnect();
        prismaClient = null;
    }
};
