import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

/**
 * Returns a singleton PrismaClient for the workers package.
 */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prisma;
}

/**
 * Disconnect PrismaClient gracefully.
 */
export async function closePrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
