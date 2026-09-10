# Rota

Private two-person household chore rota for Rob and Hannah. The agreed scope,
domain model and rules live in **SPEC.md**; read it before changing behaviour.

@AGENTS.md

## Stack

Next.js 16 (App Router, `proxy.ts` not middleware), React 19, TypeScript strict,
Tailwind 4, shadcn/ui (Radix, "nova" preset), Prisma 7 + `@prisma/adapter-pg`
on Neon Postgres, Better Auth with Google, zod, date-fns + `@date-fns/tz`,
Biome, vitest. pnpm only.

## Conventions

- Top-level `app/`, `components/`, `lib/`, `prisma/`, `test/`, `docs/`. No `src/`.
- Server components by default. Client components only for interaction.
- Server actions for first-party mutations; route handlers only for auth.
- Every page and action calls `requireUser()` from `lib/session.ts`. Never
  trust a user id from the client.
- Pure domain logic (recurrence, planning, due state) lives in `lib/domain/`
  with no Prisma or React imports, and is unit tested with table-driven
  vitest tests in `test/`.
- Instants are UTC `DateTime`; calendar dates are `@db.Date` and travel as
  `LocalDate` strings ("yyyy-MM-dd"). All conversion goes through `lib/dates.ts`
  in `Europe/London`. Never use the browser timezone for planning.
- UK English in UI copy and UK date formats. Plain, calm wording.
- Minimum 44px touch targets, visible focus, no colour-only state.

## Commands

```
pnpm dev            # http://localhost:3000
pnpm check          # biome + tsc + vitest
pnpm build          # runs prisma migrate deploy first
pnpm db:migrate     # prisma migrate dev (against DIRECT_URL in .env.local)
pnpm db:seed        # household + default areas, idempotent
```

## Database

Neon project `rota` in the Black Family org, London region. Branch
`production` for the live app, `dev` for local work. `.env.local` points at
`dev`. Never run destructive operations against `production`.

## Guardrails

- Do not deploy to production, create paid resources, or register OAuth
  credentials without being asked.
- Do not commit secrets. `.env.example` has placeholders only.
- Commit in logical units with clear messages once a step is verified with
  `pnpm check`.
