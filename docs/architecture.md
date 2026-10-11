# Architecture

## Layout

```
prisma/                 schema.prisma · migrations/ (generated + hand-written SQL) · seed.ts · sql/roles.sql
src/proxy.ts            per-request CSP nonce + security headers
src/app/
  (marketing)/          /                         landing page
  (auth)/               /login /signup /forgot-password /reset-password /invite
  app/                  /app → first business
  app/[tenant]/         overview calendar appointments services staff customers[/id]
                        analytics availability booking-page settings onboarding
  book/[slug]/          public booking page · manage/[token] (customer self-service)
  super-admin/          overview businesses users plans* templates* settings   (*placeholders)
  api/public/[slug]/    availability (GET) · bookings (POST) · manage (POST)
  api/health
src/modules/<domain>/   business rules + server actions ('use server' files expose only async functions)
  auth · tenants · businesses · services · staff · scheduling · bookings · customers · payments
  analytics · audit · platform · public
src/lib/                env · db (client, tx/retry, error mapping) · auth (session, authorize, permissions,
                        password) · security · rate-limit · validation · phone · mail · cloudinary · observability
src/i18n/               config (locales, cookie) · server (getI18n) · client (useI18n) · format ·
                        message-ref (msg tokens) · messages/{en,es}/<namespace>.ts
src/components/         ui/ (design-system primitives) · layout/ (AppShell) · features/<screen>/
src/styles/             _tokens.scss · _mixins.scss · globals.scss
tests/                  unit/ · integration/ (real PostgreSQL) · e2e/ (Playwright) · support/
```

## Request flow

1. **Server Components** render pages. A page calls `requireTenantPage(slug, permission)`, then reads through Prisma, always filtering by `ctx.tenantId`.
2. **Interactive pieces** (drawers, modals, the booking widget) are Client Components. They call **Server Actions**. Each action:
   1. calls `requireTenant(slug, permission)`;
   2. validates its input with Zod (`parseInput`);
   3. delegates to a domain module;
   4. returns an `ActionResult` (`{ ok, data } | { ok: false, error }`). Unexpected errors are logged and replaced with a generic message.
3. **Public booking** uses JSON route handlers under `/api/public`. These handlers are rate limited, check the Origin and cap the body size.

## Languages (English / Spanish)

All user-facing text lives in `src/i18n/messages/<locale>/<namespace>.ts`. `en` is the source of
truth; each `es` file is typed as `Messages['<namespace>']`, so a missing or extra key is a type
error. Code, identifiers and database values stay in English.

- **Choosing the language:** the `tempo_locale` cookie (set by the EN/ES switcher) wins, then the
  browser's `Accept-Language`, then English. Server Components call `getI18n()`; Client Components
  call `useI18n()` (the root layout provides the locale).
- **Public booking pages** use the visitor's explicit choice, otherwise the business's page language
  (`Tenant.locale`, chosen in the booking-page editor and defaulted to the language used at signup).
  Fetches from the booking widget send `x-tempo-locale` so API errors match the page.
- **Server messages:** server code never builds English sentences. It throws or returns
  `msg('key', params)` tokens (from `message-ref.ts`), and `toPublicError` resolves them, including
  field errors, into the request's language. Zod messages use the same tokens.
- **Emails** (password reset, invitations, booking confirmation) use the language of the request
  that triggers them.
- **Formatting:** dates, times, prices and percentages go through helpers that take the locale
  (`src/i18n/format.ts`, `components/features/shared/format.ts`); never call `toLocale*` without one.

## Data model (summary)

All tables live in the PostgreSQL schema `app`; see [`prisma/schema.prisma`](../prisma/schema.prisma) for every field.

- **Identity:**
  - `users` — normalised unique email, Argon2id hash, status, platform role.
  - `sessions` and `password_reset_tokens` — store hashes only.
- **Tenancy:**
  - `tenants` — slug, status, plan label, category, IANA timezone, currency, country.
  - `memberships` — role and status.
  - `invitations`.
- **Configuration:**
  - `business_profiles` — one per tenant: explicit columns plus Zod-validated `page_content` JSON and `photos` JSON (up to 3 Cloudinary images, first = cover; uploaded browser→Cloudinary with a server signature, then verified via the Admin API before saving).
  - `booking_policies` — one per tenant: phone limit, interval, notice, advance window, cancellation window, require-email, auto-confirm.
  - `services` — money stored as integer minor units.
  - `staff` and `staff_services`.
  - `availability_rules` — weekly hours.
  - `availability_exceptions` — closures, custom hours, blocks.
- **Bookings:**
  - `customers` — unique per `(tenant, phone_e164)`.
  - `appointments` — UTC instants; buffered block; snapshots of service name, duration and price; contact snapshot; hashed manage token; idempotency key.
  - `payment_records` — append-only ledger: payments, refunds and voids.
- **Platform:** `audit_logs` (append-only for the runtime role), `feature_flags`, `rate_limit_buckets`.

**Integrity in the database itself:**

- composite tenant foreign keys;
- a GiST exclusion constraint against staff double-booking;
- CHECKs on money, intervals, durations, policy ranges, the E.164 format, slug format and status/timestamp consistency;
- `RESTRICT` on deletes of historical data. Services and staff are deactivated, never deleted.

## Money and reporting

- Money is stored as `Int` minor units plus an ISO currency, and is never handled as a float. Money input is parsed from decimal strings.
- **Estimated appointment value** = Σ `quoted_price_minor` (snapshot) of **COMPLETED** appointments whose start falls in the period. The UI always labels it "Price of completed appointments. Not collected payments."
- **Collected** = Σ non-voided PAYMENT − Σ non-voided REFUND records, counted by `recorded_at`.
  - Payments are recorded explicitly by staff; completing an appointment records nothing.
  - Partial payments, refunds (never more than was collected) and voids (with a reason, audited) are supported.
- Both figures are attributed using the business time zone.

## Analytics

[`src/modules/analytics/aggregate.ts`](../src/modules/analytics/aggregate.ts) is pure and unit-tested. Its definitions:

| Metric                      | Definition                             |
| --------------------------- | -------------------------------------- |
| Booked                      | Excludes cancelled                     |
| Cancellation rate           | Cancelled ÷ all                        |
| No-show rate                | No-shows ÷ (completed + no-shows)      |
| Utilisation                 | Booked minutes ÷ staff working minutes |
| Peak hours and busiest days | Exclude cancellations                  |

The loaders select only the fields needed, scoped to one tenant.
