/* eslint-disable @typescript-eslint/no-require-imports */
// Prisma v5 has known issues with Node16 moduleResolution re-exports.
// Using require() as a workaround.
import type { PrismaClient as PrismaClientType } from '@prisma/client';

const { PrismaClient } = require('@prisma/client') as {
  PrismaClient: new (opts?: {
    log?: Array<'query' | 'info' | 'warn' | 'error'>;
  }) => PrismaClientType;
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined;
};

export const prisma: PrismaClientType =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Type for Prisma interactive transaction client.
 * Omits $transaction/$connect/$disconnect/$on/$use from the client type.
 */
export type TransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
