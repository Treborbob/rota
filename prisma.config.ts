import { defineConfig } from "prisma/config";

// Prisma 7 does not load .env files itself. Locally the connection strings
// live in .env.local; on Vercel they are real environment variables.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (CI / Vercel) — rely on the environment.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --env-file-if-exists=.env.local --import tsx prisma/seed.ts",
  },
  datasource: {
    // The CLI (migrate, studio) should use the unpooled connection.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
