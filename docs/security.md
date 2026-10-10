# Security design

This document describes the controls that are implemented and how they were verified. It is not a claim that the system is "secure". The residual risks at the end are deployment responsibilities.

## Tenant isolation

- **Resolution:** every dashboard request resolves the tenant on the server with `requireTenant(slug, permission)` in [`src/lib/auth/authorize.ts`](../src/lib/auth/authorize.ts).
  1. The session cookie is validated against the database.
  2. The user's **active** membership is looked up for that slug (the tenant must be `TRIAL`/`ACTIVE`).
  3. The role permission is checked.
- **No enumeration:** unknown tenant, no membership and suspended tenant all return the same `NOT_FOUND`/404, so tenant existence is not revealed.
- **The client never supplies a `tenantId`.** A slug only selects which of the caller's _own_ memberships to use.
- **Scoped queries:** every query on tenant-owned data filters by `tenantId` from the server-side context. Lookups by ID use `findFirst({ id, tenantId })`, so a foreign ID behaves exactly like a missing one.
- **Database backstop:** every child table references its parents through **composite foreign keys** `(tenant_id, x_id) → (tenant_id, id)`. For example, an appointment cannot reference another tenant's service, staff member or customer even if application code had a bug. This is tested.
- **Public pages:** `loadPublicPage` selects only public fields (name, copy, services, staff names and titles, hours). It never selects customers, appointments, emails of staff or internal notes. The slot API returns only "bookable or not" for each time.
- **Platform admins** are not tenant members:
  - They see account data and appointment **counts** only.
  - Their actions (suspend, reactivate, plan change, user suspension, role change for support) are audited and require a reason where the design asks for one.
  - There is no impersonation. "Support access through an owner-approved session" is planned and not implemented.

Tests: [`tests/integration/tenant-isolation.test.ts`](../tests/integration/tenant-isolation.test.ts) exercises the real server actions with real sessions and cross-tenant IDs and slugs.

## Roles

The permission matrix lives in [`src/lib/auth/permissions.ts`](../src/lib/auth/permissions.ts) and denies by default.

| Role    | Can                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OWNER   | Everything, including roles and ownership                                                                                                                                                  |
| MANAGER | Everything except role changes; can invite STAFF only                                                                                                                                      |
| STAFF   | Calendar, appointments and customer details; create bookings in their own column; confirm, complete, no-show, cancel, reschedule and record payments only on appointments assigned to them |

Hiding UI controls is cosmetic; every action re-checks permissions on the server. Role changes and member suspension revoke the affected user's sessions. The last active owner cannot be demoted or suspended.

## Authentication and sessions

- **Passwords:**
  - Argon2id (m=19 MiB, t=2, p=1) via `@node-rs/argon2`. Hashes upgrade transparently on login if parameters change.
  - Minimum 10 characters.
  - Login failures return one generic message, and a dummy hash check keeps the timing similar for unknown accounts.
- **Sessions:**
  - The token is 32 random bytes. Only `HMAC-SHA256(SESSION_SECRET, token)` is stored.
  - Cookie: `__Host-tempo_session` (HttpOnly, Secure, SameSite=Lax, Path=/) in production; `tempo_session` in development.
  - Lifetime: 30 days absolute, 7 days idle. `last_used_at` is refreshed at most hourly.
  - Login rotates the session (any presented token is revoked first, which prevents fixation). Logout deletes it.
  - Password reset, user suspension, tenant suspension and role changes revoke all of the affected users' sessions.
- **Password reset:**
  - The token is 32 random bytes, and only its HMAC is stored. It expires after 30 minutes and is **single-use**: consumption is an atomic `UPDATE … WHERE consumed_at IS NULL`, which is tested under concurrency.
  - Requesting a new link invalidates older ones.
  - The response is identical whether or not the account exists.
  - Without SMTP, the link is printed to the server console in `NODE_ENV=development` only. It is never put in an API response.
- **Invitations:** 7-day single-use hashed tokens. The accepting account must match the invited email.

## CSRF, XSS and headers

- **CSRF:**
  - Server Actions use POST plus Next.js's Origin/Host check, and SameSite=Lax cookies.
  - Public JSON endpoints (`/api/public/*`) require a same-origin `Origin`/`Referer` (`assertSameOrigin`) and carry no auth cookie.
- **CSP** (set per request in [`src/proxy.ts`](../src/proxy.ts)):
  - `script-src 'self' 'nonce-…' 'strict-dynamic'`. Every page renders dynamically so Next.js applies the nonce.
  - `style-src 'self' 'unsafe-inline'`. This is accepted because inline style _attributes_ carry design tokens. The residual risk is CSS injection, which is low.
  - `frame-ancestors 'none'`, `object-src 'none'` and `form-action 'self'`.
  - Fonts are self-hosted.
- **Other headers:** HSTS (production), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` and `COOP`.
- **XSS:** all user and business text is rendered by React as text. Template copy stored as JSON is validated with Zod and never rendered as HTML.
- **Redirects:** login `next=` targets must be internal paths (`safeRedirectPath`).
- **Errors:** clients receive `AppError` messages only. Unexpected errors are logged server-side and replaced with a generic message, so there are no stack traces or SQL details. The structured logger redacts password, token, cookie, authorization, session, phone, email and card keys.

## Abuse controls

- **Rate limits** use the shared **PostgreSQL** store (`app.rate_limit_buckets`, fixed windows). Keys are HMAC'd, so no raw IPs, emails or phones are stored.

  | Area             | Limits                                                                |
  | ---------------- | --------------------------------------------------------------------- |
  | Login            | Per IP and per account                                                |
  | Signup and reset | Per IP; reset also per account                                        |
  | Public booking   | Slot lookups per IP; bookings per IP, per tenant and per tenant+phone |
  | Manage link      | Per IP and per token                                                  |
  | Invitations      | Per tenant                                                            |
  | Dashboard writes | Per user                                                              |

  The memory store is development-only and refused when `NODE_ENV=production`.

- **Client IP:** forwarded headers are trusted only with `TRUST_PROXY_HEADERS=true`. Without that, all traffic shares one bucket per key type, which fails safe but is coarse. Set it behind Vercel or another trusted proxy.
- **Public bookings** also have:
  - a 8 KB body cap;
  - strict Zod schemas with length limits;
  - a honeypot field;
  - a minimum form-fill time;
  - idempotency keys;
  - generic errors that never reveal other bookings.

## Database privileges

- Tables live in the `app` schema, which is **not** exposed by Supabase's Data API.
- The migration revokes all access from `anon`/`authenticated` and enables RLS on every table with **no** policy for those roles (deny-all). This is tested.
- The runtime should connect as the least-privilege role `tempo_app` (see [`prisma/sql/roles.sql`](../prisma/sql/roles.sql)). It is `NOSUPERUSER NOBYPASSRLS`, has a 15 s statement timeout, and:
  - **cannot** UPDATE or DELETE `audit_logs`;
  - cannot DELETE payments, appointments, customers, tenants or users;
  - cannot touch migration bookkeeping.
- Migrations run as the owner role through `DIRECT_URL`.
- **RLS decision:** per-tenant RLS policies are **not** used. With Prisma over a transaction pooler, tenant context would have to be set with `SET LOCAL` in every transaction for every query path. We could not guarantee that, and claiming protection we can't verify would be worse. Isolation therefore relies on scoped queries plus composite FKs. RLS acts only as a deny-all guard against the Supabase API roles.

## Residual risks and deployment responsibilities

- Set strong, unique secrets. Rotating `SESSION_SECRET` signs everyone out, and rotating `PASSWORD_RESET_TOKEN_SECRET` invalidates outstanding reset, invite and manage links.
- Configure `TRUST_PROXY_HEADERS` correctly for your host. If it is wrong, rate limits are either spoofable or shared by everyone.
- Run the app as `tempo_app`, not `postgres`. Keep `DIRECT_URL` out of the runtime environment if your platform allows it.
- Phone numbers are unverified: the limit is anti-spam, not identity. Someone who knows another person's number can book with it, but cannot _view_ or change that person's other bookings.
- Manage links are bearer secrets. Anyone holding the link can cancel or reschedule that booking.
- No MFA, account lockout UI or breach-password check yet. There are no audit-log export or retention policies.
- `npm audit` reports advisories only in dev tooling (ESLint plugin dependencies and Prisma CLI internals), none in runtime dependencies. Re-check on upgrade.
