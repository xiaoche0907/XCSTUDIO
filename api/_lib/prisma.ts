import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __xc_prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__xc_prisma || new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__xc_prisma = prisma;
}
