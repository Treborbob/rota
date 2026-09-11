# Rota

Private household chore rota for two people. The agreed scope, domain model
and rules live in **SPEC.md**; the recurrence and planning semantics in
**docs/domain.md**. Read both before changing behaviour. This file is the
canonical instruction set for AI agents working in this repo.

@AGENTS.md

## 1. Working here

Rob owns the repo and is the only committer. There are no pull requests:
verified work is committed straight to `main`, and **every push to `main`
deploys to production** via Vercel, running any new migration against the
live database on the way. Treat a push as a release.

### The task loop

1. **Understand.** Read the code you'll change. Check the repo map (§2) and
   gotchas (§6) first; most surprises this week were in §6.
2. **Plan briefly.** For anything non-trivial, say the approach in a few
   sentences before writing code. If two designs are reasonable and nothing
   decides it, ask (§1 "Stop and ask").
3. **Implement in small steps.** Follow existing patterns. Scope stays with
   the task; a genuinely separate improvement gets mentioned, not smuggled in.
4. **Verify.** `pnpm check` (Biome, tsc, vitest). For UI, drive the running
   app in the browser and look at phone width as well as desktop. For anything
   touching the build or `"use server"` files, `pnpm build` too.
5. **Deliver.** Commit with a plain imperative subject and a body that says
   *why*. Push only when the definition of done holds.

### Definition of done

- Scope matches the request: nothing speculative added, nothing quietly dropped.
- `pnpm check` passes; formatting rewrites are included in the commit.
- Changed domain logic has a table-driven test in `test/` in the same commit.
  A bug fix gets a regression test.
- A changed screen has been looked at in the browser, at phone width.
- `docs/domain.md` updated if a rule changed; `SPEC.md` if the agreed scope did.
- No dead code, commented-out code, unused exports or debug output.

### Stop and ask

- Anything in the hard guardrails (§7).
- A schema change that is destructive or backfills existing production rows.
- A decision that changes privacy, auth, external cost, or what gets planned
  on which days.
- Two reasonable implementations with different data models or UX and nothing
  to choose between them.
- You need a secret or an external-service fact you don't have.

Otherwise decide, say what you decided and why, and keep moving. A smaller
finished-and-honest change beats a larger guessed one.

## 2. Repo map

```
app/                 routes (App Router); (app)/ is the authenticated shell,
                     sign-in/ and api/ sit outside it
components/          UI; components/ui is shadcn (don't hand-edit), plan/,
                     tasks/, history/, areas/, settings/ are feature folders
lib/domain/          PURE: recurrence, due-state, planner + planner-config.
                     No Prisma, no React, no clock. Tested in test/.
lib/planning/        capacity cells, generatePlan (DB → planner → DB), queries,
                     server actions for plan items and capacity overrides
lib/tasks/           queries + view models, complete.ts (the completion and
                     void transactions), server actions
lib/completions/     history queries and the void action
lib/areas/, lib/settings/   their server actions
lib/auth.ts          Better Auth config: Google, allowlist, dev login
lib/session.ts       requireUser(): the only way to identify the caller
lib/dates.ts         every timezone conversion; LocalDate helpers
lib/validation/      zod schemas + formDataToObject
prisma/              schema, migrations, seed.ts (household + areas),
                     seed-dev.ts (sample tasks for local testing)
test/                vitest, table-driven, domain only
docs/                domain.md (rules), setup.md (infra walkthrough)
.claude/             settings, hooks, skills for this repo
```

## 3. Commands

```
pnpm dev            # http://localhost:3000 (browser tooling: .claude/launch.json)
pnpm check          # biome + tsc + vitest — the gate
pnpm build          # prisma migrate deploy + next build (needs DATABASE_URL)
pnpm db:migrate     # prisma migrate dev against the Neon dev branch
pnpm db:seed        # household + default areas, idempotent
pnpm db:seed:dev    # sample tasks for exercising the planner locally
pnpm db:seed:prod   # seeds production from .env.production.local — ask first
pnpm db:studio
```

Local sign-in without Google: `ROTA_DEV_LOGIN=true` in `.env.local`, then
`/api/dev-login?email=<allowlisted>&name=<Name>`. Compiled out of production.

## 4. Stack

Next.js 16 App Router (`proxy.ts`, not middleware), React 19, TypeScript
strict, Tailwind 4, shadcn/ui on Radix ("nova" preset), Prisma 7 with
`@prisma/adapter-pg` on Neon Postgres, Better Auth (Google), zod 4, date-fns +
`@date-fns/tz`, Biome, vitest, Vercel. pnpm only.

## 5. Conventions

- **Server components by default.** Client components only for interaction.
- **Every page and server action calls `requireUser()`.** Never accept a user
  id from the client as authority.
- **Mutations are server actions** returning `ActionState`
  (`lib/action-state.ts`). Forms use `useToastAction` so the toast fires
  inside the action wrapper. A `useEffect` on the state is too late: when the
  action revalidates, the form's component may already be gone.
- **Anything that changes what's due or who's free calls
  `afterTaskChange()` / `replanUpcomingWeeks()`** so the plan never drifts
  from the task list. Only current and future weeks are regenerated;
  completed and hand-placed items are preserved.
- **All completions go through `recordCompletion`**, all undo through
  `voidCompletion` (`lib/tasks/complete.ts`), inside a transaction.
- **Dates.** Instants are UTC `DateTime`. Calendar dates are `@db.Date` and
  travel as `LocalDate` strings (`yyyy-MM-dd`); read them with `fromDbDate`,
  write with `toDbDate`, never `new Date(dateColumn)` arithmetic. All
  conversion is in `lib/dates.ts` in `Europe/London`. The browser's timezone
  is never authoritative.
- **Planner numbers live in `lib/domain/planner-config.ts`**; bump
  `ALGORITHM_VERSION` when they change so old plans stay explicable.
- **Copy.** Plain, calm UK English. No "failed", no red alerts, never state
  by colour alone, 44px touch targets, visible focus.
- **Colours.** Tokens in `app/globals.css`; member colours via
  `lib/member-style.ts` (orange, turquoise, violet by sign-up order).

## 6. Gotchas (all real, all from this codebase)

- **Next 16:** `params`/`searchParams` are promises. Page and layout props
  are the global `PageProps<"/route">` / `LayoutProps<"/">` types generated
  by `next typegen` (which `pnpm typecheck` runs first). A `"use server"`
  module may only export async functions; `tsc` won't catch a stray
  constant but `next build` will.
- **Prisma 7:** connection URLs live in `prisma.config.ts`, not the schema.
  It loads `.env.local` itself; standalone scripts need
  `node --env-file=.env.local --import tsx`. The generated client is at
  `lib/generated/prisma` (ignored, built on install). Never `db push`. The
  CLI refuses `migrate reset` from an agent without Rob's verbatim consent in
  `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`; ask him.
- **The dev server caches the Prisma client.** After a schema change and
  `prisma generate`, restart `pnpm dev` or you'll see "Unknown argument".
- **Better Auth 1.7:** the account table has no `issuer` column. The
  allowlist is `user.validateUserInfo` plus a `user.create.before` hook.
  Account linking trusts Google with `requireLocalEmailVerified: false`
  because a dev-login user is a password credential and would otherwise block
  a real Google sign-in. Check Google's `email_verified` in
  `validateUserInfo`, not with the provider flag.
- **shadcn nova preset:** `cn` is imported from the `cn` package (yes, a
  package), `Button` composes with `asChild`, not `render`. Don't remove the
  `cn` or `shadcn` dependencies.
- **Biome** wants `<label htmlFor>` even when the child is our `Input`
  component, `aria-live` rather than `role="status"` on a div, and no
  assignments inside expressions. Run `pnpm biome check --write .` before
  reading the diagnostics.
- **Nested `<li>`:** `PlanItemCard` renders its own `<li>`; never wrap it in
  another one (hydration error).
- **Vercel:** the project is pinned to `framework: nextjs` in `vercel.json`;
  without it every route 404s. Deployment URLs are SSO-gated; only the custom
  domain is public. Preview deployments can't complete Google sign-in.
- **Google OAuth** is in Testing mode with both users as test users, on
  purpose: publishing needs a privacy policy page. Sessions are Rota's own,
  so the testing-mode token expiry doesn't matter.

## 7. Hard guardrails

- Never run destructive SQL, `migrate reset`, or a data rewrite against the
  Neon `production` branch. Dev is `dev`; `.env.local` points there.
- Never print, log, or commit secrets. `.env.local`,
  `.env.production.local` and `lib/generated/` are ignored; keep it so.
  Show a secret's first few characters at most.
- Never `vercel env`, `vercel deploy`, or change Vercel/Neon/GitHub settings
  without being asked in the conversation. A `git push` is a production
  deploy: don't push a migration Rob hasn't seen.
- Never force-push or rewrite `main` (a ruleset blocks it anyway).
- Never weaken the allowlist, the dev-login gate, or `requireUser()` to make
  something convenient.
- Don't add gamification, roles, multi-household, AI scheduling or a theme
  switcher. They're non-goals in SPEC.md, not oversights.

## 8. Infrastructure (for orientation, not for changing)

Vercel project `rota` in Rob's personal hobby team, git-connected to
`main`. Neon project `rota` in Rob's personal org, London: branches
`production` and `dev`. DNS for the domain is in Microsoft 365. Google OAuth
client in a personal Google Cloud project. Details and the setup walkthrough:
`docs/setup.md`. Production values (never committed): `.env.production.local`.
