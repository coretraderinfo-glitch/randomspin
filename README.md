# Lucky Spin

Lucky Spin is a premium free random-number wheel website with a private admin system. Public visitors choose a `FROM` and `TO` number, press `SPIN`, and the server securely selects the winning number before the wheel animation begins.

The app includes:

- Public Lucky Spin wheel with recent results, sound toggle, full screen, reset, and share.
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
DATABASE_URL="postgresql://USER:PASSWORD@POOLED_HOST:5432/lucky_spin?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@DIRECT_HOST:5432/lucky_spin?schema=public"
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
```

## Deploy To Vercel

1. Create a PostgreSQL database in Supabase or Neon.
2. Copy both database connection strings:
   - `DATABASE_URL`: pooled/runtime connection string for the website.
   - `DIRECT_URL`: direct connection string for Prisma migrations.
3. Create a new Vercel project from this repository.
4. Add these Vercel environment variables:
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
5. Deploy once.
6. Run the migration command from your deployment environment:

```bash
npm run db:migrate
npm run admin:bootstrap
```

7. Set `NEXT_PUBLIC_SITE_URL` to your final domain, for example `https://luckyspin.example.com`.
8. In Vercel, add your domain under Project Settings > Domains and follow the DNS instructions.

For Neon, use the pooled URL for `DATABASE_URL` and the non-pooled/direct URL for `DIRECT_URL`. For Supabase, use the pooler URL for runtime traffic and the direct database URL for migrations.

## Production Rate Limiting

Lucky Spin uses Upstash Redis REST for shared rate limiting in production:

- Public spins: `40` requests per minute per IP by default.
- Admin login: `8` requests per minute per IP by default.

If Upstash is not configured in production, rate-limited endpoints fail closed with HTTP `429` instead of silently using per-instance memory.

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
