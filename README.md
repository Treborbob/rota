<p align="center">
  <img src="public/icons/icon-192.png" width="96" height="96" alt="Rota logo">
</p>

<h1 align="center">Rota</h1>

<p align="center">
  A calm, private chore rota for a household. Tell it what needs doing and how many minutes you each have on each evening, and it decides who does what tonight.
</p>

<p align="center">
  <a href="https://github.com/Treborbob/rota/actions/workflows/ci.yml"><img src="https://github.com/Treborbob/rota/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-MIT-blue.svg" alt="MIT licence"></a>
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict">
  <img src="https://img.shields.io/badge/contributions-not%20accepted-lightgrey" alt="Contributions not accepted">
</p>

---

## Why

Most chore apps are either a shared to-do list, which puts the planning back on you, or a points-and-streaks game, which turns a relationship into a leaderboard. Rota does neither. It removes the *deciding*: which jobs are actually due, who should do them this time, and how to fit them into the evenings you genuinely have.

- **Tonight first.** The home screen shows only what matters now, per person, with one tap to mark it done.
- **Time is the fairness unit.** Work is balanced by estimated minutes, not by number of jobs, nudged gently by who has done more over the last month.
- **Actual completion is authoritative.** A four-weekly job done five days late is next due four weeks from the day it was done. Finishing late never creates a backlog.
- **Capacity is data, not a rule.** Every person has a minute budget for each of the seven weekdays. Friday to Sunday default to zero, which is what keeps the weekend free, but nothing is hard-coded.
- **Deterministic and explainable.** Same inputs, same plan. Every placement carries a reason, and everything that couldn't fit says why.
- **Manual control always wins.** Move, reassign, defer, skip, pause, or just grab something off the list on a bored Sunday afternoon.
- **No gamification.** History shows who did what without ever becoming a scoreboard.

Built for two people, one house. It works for more, but it will never grow into a project manager.

## How it works

Rota has five screens.

**Tonight** is home. Each person sees their list for this evening with a tick per job. Expanding a job reveals notes and the escape hatches: move it to another day or person, skip this cycle, or take it off this week. On an evening with no minutes budgeted it simply says so and points you at Pick.

**Week** lays the plan out Monday to Sunday with a bar per person per day of planned versus available minutes. Tap a bar to say "out tonight" or "only 15 minutes" and the week re-plans around it. Anything that couldn't fit is listed underneath with the reason. You can add a task by hand or re-plan the whole week.

**Tasks** is the catalogue. A task is a name, an area, an estimate in minutes, a cadence, and who does it: always one person, take turns, or whoever's free. Give a new task a "last done" date so it starts staggered rather than due today. From a task you can complete it early, defer it to a date, pause it indefinitely (the lawn in December), skip a cycle, or archive it. Any edit re-plans the current week automatically.

**Pick** is for when you feel like doing something anyway. It lists what's due or coming up, filterable to quick jobs and nothing unpleasant, each with a Done button.

**More** holds Areas, History and Settings. History is every completion with who and when, and an undo that keeps a visible record. Settings is each person's minutes per weekday, the single biggest lever on how the app behaves.

The rules behind all of this, including the recurrence arithmetic and the planner's scoring, are written up in [docs/domain.md](docs/domain.md).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · shadcn/ui on Radix · Prisma 7 · Postgres (Neon) · Better Auth with Google sign-in · Biome · Vitest · Vercel

Installable as a PWA on iOS, iPadOS and macOS, with light and dark themes following the system setting.

## Running your own

Rota is private by design: sign-in is Google, and only email addresses on an allowlist can get in. Running a copy for your own household needs a Postgres database, a Google OAuth client and somewhere to host a Next.js app. Vercel's and Neon's free tiers are plenty.

```bash
git clone https://github.com/Treborbob/rota.git
cd rota
cp .env.example .env.local      # fill in database, auth secret, Google client, allowlist
pnpm install                    # also generates the Prisma client
pnpm db:migrate                 # creates the schema
pnpm db:seed                    # household + default areas
pnpm dev                        # http://localhost:3000
```

The full walkthrough, including the Google console steps, environment variables and production deployment, is in [docs/setup.md](docs/setup.md). For local development without Google, set `ROTA_DEV_LOGIN=true` and visit `/api/dev-login?email=<allowlisted address>`; it is compiled out of production builds.

## Project layout

```
app/            routes (App Router); (app)/ is the authenticated shell
components/     UI; components/ui is shadcn
lib/domain/     pure logic: recurrence, due state, planner (no database, no React)
lib/planning/   turns database state into planner input and persists the result
lib/tasks/      task queries, view models, the completion and void transactions
prisma/         schema, migrations, seed
test/           table-driven unit tests for the domain
docs/           domain rules and setup
```

## Quality

```bash
pnpm check      # biome + tsc + vitest
pnpm build      # prisma migrate deploy + next build
```

The recurrence engine and planner are pure functions covered by table-driven tests, including month-end clamping, leap days, both daylight-saving transitions, every assignment mode, capacity overflow and regeneration. CI runs lint, typecheck and tests on every push.

## Contributing

Rota is a personal project and I'm the only one working on it. Forks are very welcome, and so are bug reports via issues, but I'm not accepting pull requests. If you want to take it somewhere, fork it and make it yours. See [CONTRIBUTING.md](CONTRIBUTING.md) if you're setting up a fork.

Things on the maybe-later list: passkeys, web push reminders, an offline completion queue, a holiday mode, data export.

## Licence

[MIT](LICENSE). Do what you like with it; a mention is appreciated.

## Acknowledgements

The specification was first drafted with ChatGPT and then argued down to something a household would actually use. The app was built with [Claude Code](https://claude.com/claude-code). The colours are because one of us likes orange and the other likes turquoise.
