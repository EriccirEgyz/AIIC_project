import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buildClient() {
  // DATABASE_URL is "file:./dev.db" in dev. Strip the "file:" prefix for the
  // raw driver. better-sqlite3 expects a filesystem path.
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const path = url.replace(/^file:/, "");
  const adapter = new PrismaBetterSqlite3({ url: path });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
