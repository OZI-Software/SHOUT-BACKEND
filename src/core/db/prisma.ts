import { PrismaClient } from '@prisma/client'

// Global variable for the Prisma Client instance
let prisma: PrismaClient;

// Singleton pattern to ensure only one instance of PrismaClient is created
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['warn', 'error'],
  });
} else {
  // Use a global object in development to persist the client across hot reloads
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
  prisma = global.prisma;
}

// Export the client
export const db = prisma;

// Extend the global object type for TypeScript in development
declare global {
  var prisma: PrismaClient | undefined;
}