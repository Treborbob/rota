# Working on Rota

Rota is a personal project and I'm the only committer. I don't accept pull
requests, but forks are welcome and bug reports via issues are appreciated.
Everything below is for anyone setting up their own fork, and for me.

## Local setup

You need Node 24+, pnpm 10+, and a Postgres database (a free Neon branch is
easiest). Follow [docs/setup.md](docs/setup.md) sections 2 and 3, then:

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

To sign in without configuring Google, set `ROTA_DEV_LOGIN=true` in
`.env.local` and open `/api/dev-login?email=<an address on your allowlist>`.

## Working on it

- **Domain logic is pure.** Recurrence, due state and the planner live in
  `lib/domain/` with no database or React imports. If you change a rule,
  change or add a table-driven test in `test/` in the same commit.
- **Dates are deliberate.** Instants are UTC; calendar dates travel as
  `yyyy-MM-dd` strings; every conversion goes through `lib/dates.ts` in
  `Europe/London`. Don't reach for `new Date()` arithmetic in components.
- **Server components by default.** Client components only where interaction
  demands it. Mutations are server actions that call `requireUser()`.
- **Plain, calm UK English** in the interface. No "failed", no red alerts.
  Never convey state by colour alone.
- **Keep the planner explainable.** Any new placement or overflow behaviour
  needs a reason code and a plain-English message.

## Checks

```bash
pnpm check   # biome lint + format, tsc, vitest
```

CI runs the same thing on every push.

## Changing things

- One logical change per commit, with a short message saying *why*.
- Update `docs/domain.md` if you change a rule, and `SPEC.md` if you change
  the agreed scope.

## Schema changes

Use `pnpm db:migrate` to create a Prisma migration; never `db push`. Keep
migrations additive where possible.
