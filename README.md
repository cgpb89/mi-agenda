# Tempo — appointment booking for small businesses

Tempo is a multi-tenant SaaS application. Each business gets a public booking page (one of five templates), a dashboard (calendar, appointments, services, staff, customers, availability, analytics, settings) and a platform super-admin area. It is built from the approved designs in [`/design`](design/).

- **Stack:** Next.js 16 (App Router) · TypeScript (strict) · SCSS modules · Prisma 7 · Supabase PostgreSQL · Zod · Luxon · libphonenumber-js · Argon2id · Vitest · Playwright.
- **Authentication:** app-managed email/password with server-side sessions. Supabase is used **only as the PostgreSQL host**; there is no Supabase Auth, Storage or Realtime.
- **Payments:** no online payment processing. Staff record money they actually collected. This is reported separately from _estimated_ appointment value.

More detail lives in [`docs/`](docs/):

| Doc                                                 | Contents                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| [architecture.md](docs/architecture.md)             | Structure, data model, tenant isolation, routes                              |
| [booking-engine.md](docs/booking-engine.md)         | Availability rules, conflict prevention, phone limit, concurrency            |
| [security.md](docs/security.md)                     | Auth, sessions, CSRF/CSP, rate limiting, database privileges, residual risks |
| [operations.md](docs/operations.md)                 | Supabase setup, connection strings, migrations, deploy, backups and restore  |
| [design-assumptions.md](docs/design-assumptions.md) | Mapping of `/design` screens to routes, plus every gap and deviation         |

---

## Quick start (local development)

Prerequisites: Node 22.12+ (24 tested) and a **Supabase project** (or any PostgreSQL 15+ with `btree_gist`).

```bash
npm install
cp .env.example .env          # then fill in the values (see below)
npx prisma generate
npm run db:migrate:deploy     # applies prisma/migrations to DIRECT_URL
npm run db:seed               # demo businesses + accounts (prints a dev password)
npm run dev                   # http://localhost:3000
```

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Minimum `.env` for development:

| Variable                                                             | Purpose                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `APP_URL`                                                            | `http://localhost:3000`                                                                          |
| `DATABASE_URL`                                                       | Runtime connection (Supabase **transaction pooler**, port 6543; preferably the `tempo_app` role) |
| `DIRECT_URL`                                                         | Migrations and seed (direct connection, or **session pooler** on 5432, as `postgres`)            |
| `SESSION_SECRET`, `PASSWORD_RESET_TOKEN_SECRET`, `RATE_LIMIT_SECRET` | 32+ character random secrets                                                                     |
| `RATE_LIMIT_STORE`                                                   | `postgres` (default) or `memory` (dev only; refused in production)                               |

Email is optional. Without SMTP settings, password-reset and invitation emails are **printed to the server console in development only**, and the UI never claims an email was sent. See [operations.md](docs/operations.md) for exact Supabase connection-string formats and the least-privilege role.

### Seeded demo data

`npm run db:seed` creates the businesses from the design: **Northside Barber Co.** (about four months of appointments and payments), Sable & Sage, Harbor Physio, Forge Training Lab, Mendwell, and a draft "Northside Eastgate". It also creates these accounts:

- `admin@tempo.test` (platform admin)
- `marcus@northside.test` (owner)
- `amara@sableandsage.test`, `elena@harborphysio.test`, `kai@forgelab.test`, `ravi@mendwell.test`

The seed prints a random password once. Set `SEED_PASSWORD` to choose your own. It refuses to run with `NODE_ENV=production` and never overwrites existing tenants or users.

### Platform admin bootstrap

There is no default administrator. Sign up normally, then run:

```bash
npm run admin:grant -- --email you@company.com            # or --revoke
```

---

## Scripts

| Command                                 | What it does                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`       | Develop, build (`prisma generate` + `next build`), serve                                          |
| `npm run typecheck` · `lint` · `format` | `tsc --noEmit` · ESLint (Next + React Compiler rules) · Prettier                                  |
| `npm run test:unit`                     | Pure logic: scheduling/DST, rules, ledger, permissions, validation, analytics                     |
| `npm run test:integration`              | Real PostgreSQL: concurrency, tenant isolation, auth, payments, audit, rate limits, DB privileges |
| `npm run test:e2e`                      | Playwright journeys against a production build on :3100                                           |
| `npm run db:migrate:dev`                | Create a new migration (dev database only)                                                        |
| `npm run db:migrate:deploy`             | Apply migrations (CI/production)                                                                  |
| `npm run db:seed`                       | Development seed                                                                                  |
| `npm run db:test:reset`                 | Rebuild the **test** database from migrations                                                     |
| `npm run admin:grant`                   | Grant or revoke platform admin                                                                    |

## Testing

Integration and e2e tests **truncate tables**, so they only run against a separate, allow-listed test database. Put these in `.env.test.local` (git-ignored):

```dotenv
TEST_DATABASE_URL=postgresql://...      # separate Supabase project (pooler)
TEST_DIRECT_URL=postgresql://...        # same project, direct/session
ALLOW_DESTRUCTIVE_DB_TESTS=true
TEST_DB_PROJECT_ALLOWLIST=<test-project-ref>
```

The guard ([`tests/support/test-db-guard.ts`](tests/support/test-db-guard.ts)) refuses to run if any of these is missing, if the project is not allow-listed, or if the test database matches `DATABASE_URL`/`DIRECT_URL` from `.env`.

```bash
npm run db:test:reset         # proves migrations build a clean schema
npm run test:integration
npx playwright install chromium && npm run test:e2e
```

## Status and known limitations

See [design-assumptions.md](docs/design-assumptions.md) and the "Residual risks" section of [security.md](docs/security.md). In short:

- No online payments, SMS, or phone verification. Phone numbers are unverified and are only used as a per-business anti-spam limit key.
- No image uploads: photos are the design's hatched placeholders. No Supabase Storage.
- The super-admin "Plans" and "Templates" pages are placeholders, as in the design. Plans are labels only.
- Tenant isolation is enforced in application code plus composite foreign keys. PostgreSQL RLS is deny-all for Supabase API roles, not per-tenant (see [security.md](docs/security.md)).
- Email sending requires SMTP configuration.
