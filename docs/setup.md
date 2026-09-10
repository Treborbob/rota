# Setup

Everything a fresh machine, and a fresh production deployment, needs.

## 1. Google OAuth client (one-off, manual)

Rota signs people in with Google. You need one OAuth client, created in a
personal Google Cloud project (not a Paramount Visas one).

1. Go to <https://console.cloud.google.com/> and create a project called
   `Rota` (or pick an existing personal one).
2. **APIs & Services → OAuth consent screen.** Choose *External*, app name
   `Rota`, your email as support and developer contact. No scopes beyond the
   defaults (`email`, `profile`, `openid`). Save.
3. Publishing status: click **Publish app**. Because Rota only uses
   non-sensitive scopes, Google does not require verification, and publishing
   avoids the 7-day token expiry that applies in *Testing* mode.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID.**
   Type *Web application*, name `Rota`.
   - Authorised JavaScript origins:
     - `http://localhost:3000`
     - `https://rota.blackfamily.co.uk`
   - Authorised redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://rota.blackfamily.co.uk/api/auth/callback/google`
5. Copy the client ID and secret into `.env.local` as `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`, and later into Vercel.

## 2. Local environment

```bash
cp .env.example .env.local   # then fill it in
pnpm install                 # also runs prisma generate
pnpm db:migrate              # applies migrations to the Neon dev branch
pnpm db:seed                 # household + default areas
pnpm dev
```

`.env.local` values:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string for the `dev` branch |
| `DIRECT_URL` | Same string without `-pooler` in the host (used for migrations) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from step 1 |
| `ROTA_ALLOWED_EMAILS` | the two Google addresses, comma-separated |

The Neon connection strings come from the Neon console (project `rota`,
Black Family org): *Connect → branch → copy*.

## 3. Neon

- Project: `rota`, org *Black Family*, region London (`aws-eu-west-2`),
  Postgres 17.
- Branches: `production` (default) and `dev`.
- The free plan scales compute to zero after inactivity; the first request of
  an evening may take about half a second longer.

## 4. Vercel

1. Import the GitHub repository into your personal Vercel account.
   Framework preset: Next.js. Build command is the default (`pnpm build`),
   which runs `prisma migrate deploy` before `next build`.
2. Environment variables (Production):
   - `DATABASE_URL` and `DIRECT_URL` for the **production** Neon branch
   - `BETTER_AUTH_SECRET` (a *different* secret from local)
   - `BETTER_AUTH_URL` = `https://rota.blackfamily.co.uk`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `ROTA_ALLOWED_EMAILS`
3. Add the domain `rota.blackfamily.co.uk` and create the CNAME Vercel asks
   for at your DNS provider.
4. Preview deployments are not authenticated targets: they build, but Google
   will refuse the callback because their hostnames are not registered.
   That is expected. Deploy from `main`.
5. After the first deployment, run the seed once against production:
   `DATABASE_URL=<prod pooled> pnpm db:seed` from your machine, or run it
   from a Vercel one-off shell.

## 5. First sign-in

Open the site, tap *Continue with Google*, choose an allowlisted account.
The user row and default evening minutes (30/30/30/20/0/0/0) are created on
that first sign-in. Anyone else sees "not on the Rota allowlist".

## 6. Installing on iPhone

Open the site in Safari, tap Share → *Add to Home Screen*. The app runs
standalone with its own icon. Sign-in redirects stay inside the installed app.
