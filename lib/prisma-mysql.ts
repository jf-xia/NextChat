import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaMysql: PrismaClient | undefined;
}

export const prismaMysql =
  globalThis.prismaMysql ??
  new PrismaClient({
    // log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaMysql = prismaMysql;
}
