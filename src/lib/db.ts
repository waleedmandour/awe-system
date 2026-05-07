import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Handle case where Prisma client might not be generated
let prismaClient: PrismaClient | null = null

try {
  prismaClient = globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })
  
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaClient
} catch (error) {
  console.warn('Prisma client could not be initialized. Database features will be unavailable.')
}

export const db = prismaClient

// Helper to check if database is available
export const isDatabaseAvailable = (): boolean => {
  return db !== null
}
