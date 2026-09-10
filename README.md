# Rota

A private chore rota for the Black household. It tracks recurring and one-off
jobs around the house, records who actually did what, and plans each person's
evenings from the minutes they have available.

- **Spec:** [SPEC.md](SPEC.md)
- **Setup and deployment:** [docs/setup.md](docs/setup.md)

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · shadcn/ui · Prisma 7 ·
Neon Postgres · Better Auth (Google) · Vercel

## Commands

```bash
pnpm dev          # local dev server on :3000
pnpm check        # lint, typecheck, unit tests
pnpm build        # migrate deploy + next build
pnpm db:migrate   # create/apply a migration locally
pnpm db:seed      # household + default areas
```

## Layout

```
app/          routes (App Router). (app)/ is the authenticated shell.
components/   UI; components/ui is shadcn.
lib/          auth, db, dates, domain logic (lib/domain is pure).
prisma/       schema, migrations, seed.
test/         vitest unit tests for the domain.
docs/         setup and domain notes.
```
