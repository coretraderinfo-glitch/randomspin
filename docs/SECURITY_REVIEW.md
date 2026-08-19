# Lucky Spin Security Review

Date: 19 August 2026

## Public Spin Safety

- The authoritative winner is selected only in `POST /api/spin`.
- The browser never receives `excludedNumbers`.
- `crypto.randomInt()` is used through `selectSecureWinner()`.
- Public responses contain only `spinId`, `winner`, and `timestamp`.
- Invalid ranges, oversized ranges, and empty eligible pools return sanitized messages.

## Admin Safety

- Admin passwords are hashed with bcrypt.
- Admin sessions are opaque, hashed in the database, HTTP-only, same-site strict cookies.
- Admin pages use server-side session checks.
- Admin API routes reject unauthenticated requests.
- Admin write routes check same-origin requests.
- Important configuration changes are written to `AuditLog`.

## Abuse Prevention

- Public spin API is IP rate limited at 40 requests per minute by default.
- Admin login is separately IP rate limited at 8 requests per minute by default.
- Production rate limiting uses Upstash Redis REST. Local development falls back to memory when Redis is not configured.
- IP addresses are hashed before storage.
- Security headers are configured in `next.config.ts`.

## Launch Checklist

- Set a strong `NEXTAUTH_SECRET`.
- Use HTTPS in production.
- Use a private Postgres database URL.
- Configure `DATABASE_URL` for pooled runtime connections and `DIRECT_URL` for direct migrations.
- Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` before production launch.
- Run `npm audit` before launch and after dependency updates.
- Add a public contact email in Website Settings only when ready to show it.
