# RandomSpin

RandomSpin is a free web-based random draw tool for names, numbers, and more. Public visitors can run number draws, player/name draws, and simple live random draws with server-authoritative results.

The app includes:

- Public RandomSpin Number Draw with recent results, sound toggle, full screen, reset, and share.
- Secure server-side spin API with private admin exclusions.
- Private admin login, dashboard, wheel control, history, analytics, and settings.
- PostgreSQL database schema using Prisma.
- SEO pages, robots, sitemap, privacy, terms, and FAQ.
- Tests for spin selection, wheel visual integrity, exclusions, rate limiting, admin protection, timezone reporting, CSRF, and mobile rendering basics.

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill in:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@POOLED_HOST:5432/randomspin?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@DIRECT_HOST:5432/randomspin?schema=public"
NEXTAUTH_SECRET="make-this-at-least-32-random-characters"
ADMIN_BOOTSTRAP_EMAIL="your-email@example.com"
ADMIN_BOOTSTRAP_PASSWORD="a-long-unique-password"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
```

Local development may leave the Upstash values empty. The app will use an in-memory limiter locally only. Production should always set the Upstash values.

3. Create the database tables:

```bash
npm run db:dev
```

4. Create or update the admin account:

```bash
npm run admin:bootstrap
```

5. Start the website:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Local SQLite Testing

Local development can run without Homebrew, PostgreSQL, Neon, Supabase, Railway, or Vercel. The local-only schema is `prisma/schema.dev.prisma`, and the local SQLite file is `prisma/dev.db`.

Use these commands for localhost testing:

```bash
npm run db:dev
npm run admin:bootstrap
npm run dev
```

The production schema remains `prisma/schema.prisma` with PostgreSQL. Production build and migration commands still use the PostgreSQL schema.

## Admin Login

Go to:

```text
http://localhost:3000/admin/login
```

Use the email and password from:

```text
ADMIN_BOOTSTRAP_EMAIL
ADMIN_BOOTSTRAP_PASSWORD
```

Never commit real credentials into the project.

## Change Eligible / Excluded Numbers

1. Log in at `/admin/login`.
2. Open `/admin/wheel`.
3. Set the active `FROM` and `TO` range.
4. Click number tiles to mark them eligible or excluded.
5. Press `Save Changes`.

Excluded numbers are private. They are never sent to the public website or public spin API response.

## Public / Private Draw Separation

The normal homepage at `/` and private draw audience pages such as `/draw/A7K29P` must feel like the same official RandomSpin website. Do not build a visually separate cloned frontend for private draws.

Both modes should reuse the shared public presentation layer, especially `PublicHome`, `LuckyWheel`, `RangeSelector`, `WinnerModal`, roulette sounds, spin physics, `SPIN` / `SPIN AGAIN`, local visitor time plus UTC, responsive layout, animations, and footer. The only meaningful difference is the server-backed draw context.

- `/` is public mode and uses the complete user-selected range with no private draw exclusions.
- `/draw/[publicCode]` is audience mode and should resolve the draw context server-side from the public code.
- Audience pages may show a small neutral label such as `PRIVATE EVENT DRAW`, but should not expose admin controls, exact exclusions, or technical identifiers.
- Operator/admin draw controls belong on authenticated admin routes such as `/admin/draws/[id]`, not on the audience page.
- Private draw winners, wheel landing, winner modal, and history must all come from the same server result context for that draw.
- Private draw modes are stored as strings for PostgreSQL and SQLite development compatibility, with allowed values validated centrally in `lib/private-draws.ts`.
- View switching is presentation-only. Viewers can choose `Wheel` or `Number` on the public page without changing the server spin endpoint, eligible pool, exclusions, operator mode, or winner authority.

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run db:migrate
npm run db:seed
npm run admin:bootstrap
npm run verify:staging
npm run verify:upstash
```

## Deploy To Railway Staging

1. Create one Railway project for staging only.
2. Add a Railway PostgreSQL service, for example `randomspin-staging-db`.
3. Add a web service from this repository, for example `randomspin-staging-web`.
4. Use the existing service commands:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Start command: `npm start`
5. Add these Railway web-service variables:
   - `APP_ENV=staging`
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXTAUTH_SECRET`
   - `ADMIN_BOOTSTRAP_EMAIL`
   - `ADMIN_BOOTSTRAP_PASSWORD`
   - `NEXT_PUBLIC_SITE_URL`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `SPIN_RATE_LIMIT_PER_MINUTE`
   - `ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE`
6. Do not set `SQLITE_DATABASE_URL` on Railway.
7. Set `NEXT_PUBLIC_SITE_URL` to the exact Railway-generated public URL, then redeploy if that value changes.
8. Keep staging separate from future production databases, Redis databases, and domains.

Railway provides `PORT` to the running service. The existing `npm start` command runs `next start`, which binds correctly through Railway's Node deployment flow without a custom Dockerfile for this project.

## Railway PostgreSQL URL Strategy

For the deployed Railway web service, use the Railway same-project/private PostgreSQL URL for `DATABASE_URL`. Railway's PostgreSQL service exposes standard variables including `DATABASE_URL` for services in the same project.

For commands from your Mac, do not use a private Railway hostname. Use one of these safe options:

- Enable Railway PostgreSQL Public Access and use `DATABASE_PUBLIC_URL` in your local `.env.staging.local`.
- Or use Railway CLI tunneling/`railway run` so commands receive Railway's environment safely.

For this project, `DIRECT_URL` can be the same Railway staging PostgreSQL connection string as `DATABASE_URL` when you are not using a separate pooler. If you use a public URL locally for migrations, set both `DATABASE_URL` and `DIRECT_URL` in `.env.staging.local` to that public staging URL while running the local setup commands.

## Staging Checklist

Set all required environment variables in the staging deployment without exposing their values in commits, logs, or screenshots:

- `APP_ENV`: use `staging` for Railway staging.
- `DATABASE_URL`: Railway staging PostgreSQL URL used by the website.
- `DIRECT_URL`: PostgreSQL connection used by Prisma migrations.
- `NEXTAUTH_SECRET`: at least 32 random characters.
- `ADMIN_BOOTSTRAP_EMAIL`: staging admin email.
- `ADMIN_BOOTSTRAP_PASSWORD`: long unique staging admin password.
- `NEXT_PUBLIC_SITE_URL`: exact Railway staging URL.
- `UPSTASH_REDIS_REST_URL`: staging Redis REST URL for shared rate limiting.
- `UPSTASH_REDIS_REST_TOKEN`: staging Redis REST token for shared rate limiting.
- `SPIN_RATE_LIMIT_PER_MINUTE`: public spin limit, default `40`.
- `ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE`: admin login limit, default `8`.

Before live staging verification:

```bash
npm install
npm run db:generate
npm run lint
npm run typecheck
npm run test
npm run build
npm audit
```

Then run the non-destructive staging setup/checks against the configured Railway staging database:

```bash
npm run db:migrate
npm run db:seed
npm run admin:bootstrap
npm run verify:staging
npm run verify:upstash
```

`npm run db:seed` creates only the default public wheel/settings rows and optional admin from env. It does not create local SQLite sample private draw codes such as `A7K29P` or `PLAYTEST`.

`npm run verify:staging` confirms the database connection, required tables, active wheel configuration, site settings timezone, admin user, spin write/read, and audit-log write/read. Verification spin and audit rows are clearly marked and cleaned up by the script.

## CSP Notes

Production CSP is nonce-based for scripts and does not allow `unsafe-eval`. Development keeps the looser behavior needed by Next.js HMR/debug tooling.

The production policy keeps `style-src-attr 'unsafe-inline'` because React-rendered style attributes and Framer Motion runtime transforms need style attributes to animate correctly. Inline scripts still require a nonce.

## Production Rate Limiting

RandomSpin uses Upstash Redis REST for shared rate limiting in production:

- Public spins: `40` requests per minute per IP by default.
- Admin login: `8` requests per minute per IP by default.

If Upstash is not configured in production, rate-limited endpoints fail closed with HTTP `429` instead of silently using per-instance memory.

To verify the live Redis-backed limiter without printing credentials:

```bash
npm run verify:upstash
```

The command uses the configured `SPIN_RATE_LIMIT_PER_MINUTE`, confirms requests `1-limit` are allowed, confirms the next request exceeds the limit, then confirms reset after a short verification window. To check cross-process sharing, run the same command in two shells with the same `UPSTASH_VERIFY_KEY`.

For an end-to-end HTTP check against staging, submit more than `SPIN_RATE_LIMIT_PER_MINUTE` POST requests to `/api/spin` from the same client/IP and confirm the exceeded response is HTTP `429`. Do not log or expose the Upstash token.

## Timezone

Dashboard and analytics reporting use the configurable site timezone. The default is:

```text
Asia/Kuala_Lumpur
```

Database timestamps remain UTC. Reporting boundaries such as Today, This Week, and This Month are calculated using the configured IANA timezone.

## Important Files

- Wheel design: `components/public/LuckyWheel.tsx`
- Homepage design: `components/public/PublicHome.tsx` and `app/page.tsx`
- Admin number control: `components/admin/NumberEligibilityGrid.tsx`
- Spin API: `app/api/spin/route.ts`
- Database: `prisma/schema.prisma` and `prisma/migrations/`
- Colors/theme: `app/globals.css`
- SEO: `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts`
- Admin auth: `lib/auth.ts`
- Timezone reporting: `lib/timezone.ts`
- Rate limiting: `lib/rate-limit.ts`
- Security notes: `docs/SECURITY_REVIEW.md`

## Safe Updates

Before changing production settings, make a small commit. Test locally with:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Then deploy.
