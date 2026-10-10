import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration (migrate, studio, seed).
 * The CLI uses DIRECT_URL — a direct or SESSION-pooler connection with the
 * migration/owner role. The application runtime does NOT read this file; it
 * connects through `@prisma/adapter-pg` using DATABASE_URL (see src/lib/db).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  ...(process.env.DIRECT_URL ? { datasource: { url: process.env.DIRECT_URL } } : {}),
});
