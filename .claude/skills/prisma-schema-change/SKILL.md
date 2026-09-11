---
name: prisma-schema-change
description: Use when changing the database schema — adding or altering Prisma models, fields, enums, indexes or constraints — or when a migration is needed. Covers the dev-branch iteration → committed migration workflow and what must be flagged before pushing, because a push to main runs the migration against production.
---

# Prisma schema change

Schema: `prisma/schema.prisma`. Migrations: `prisma/migrations/`. Connection
URLs come from `prisma.config.ts` (Prisma 7), which reads `.env.local`
(Neon `dev` branch) locally. **Every migration committed and pushed runs
against production during the next Vercel build.** Treat migration SQL as
production code.

## Workflow

1. Edit `prisma/schema.prisma`. Naming: PascalCase models, camelCase fields,
   SCREAMING enum values, snake_case `@@map` table names. Calendar dates are
   `DateTime @db.Date`; instants are plain `DateTime`.
2. Create the migration against the dev branch:
   `pnpm prisma migrate dev --name descriptive_change_name` (snake_case).
   Never `db push`.
3. Read the generated SQL. It must do exactly what you intend and nothing more.
4. `pnpm prisma generate`, then **restart `pnpm dev`**: the dev server holds
   the old client and will throw "Unknown argument" otherwise.
5. Update anything that maps the change: view models in `lib/tasks/view.ts`
   or `lib/planning/queries.ts`, `prisma/seed.ts`, `prisma/seed-dev.ts`, the
   docs in `docs/domain.md` if a rule changed.
6. `pnpm check`, then `pnpm build` (it runs `migrate deploy` against dev, a
   dress rehearsal for production).

## Flag before pushing (say it explicitly in your summary and wait)

- Destructive SQL: `DROP`, column removal or rename, type narrowing, a new
  `NOT NULL` on an existing column. Say what happens to existing rows.
- Backfills of existing production data. Prefer a separate, explicit
  migration.
- Enum value removals. Usually additive only.

## Never

- `prisma migrate reset` without Rob's verbatim consent (the CLI enforces
  this for agents via `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`).
- Edit or delete a migration that has already been pushed.
- Point `DATABASE_URL` at the production branch for local work.
