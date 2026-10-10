# Booking engine

Every path that creates or moves an appointment goes through [`src/modules/bookings/engine.ts`](../src/modules/bookings/engine.ts):

- the public booking page;
- the owner's "New appointment" modal;
- "Book again";
- customer self-service rescheduling;
- staff rescheduling.

Availability is computed by one pure module, [`src/modules/scheduling/availability.ts`](../src/modules/scheduling/availability.ts). It backs the public slot picker, the owner's slot preview, the live conflict message and the authoritative re-check inside the booking transaction.

## Time model

- **Instants:** appointments are stored as `timestamptz` (UTC).
- **Recurring hours:** stored as minutes from local midnight and interpreted in `Tenant.timezone` (an IANA zone) with Luxon.
  - A 09:00–17:00 window is 09:00–17:00 on the wall clock even on daylight-saving changeover days.
  - Non-existent local times (the spring-forward gap) resolve forward.
- **Intervals:** half-open `[start, end)`. An appointment may start exactly when another ends.
- **Buffers:**
  - Each appointment stores `start_at`/`end_at` (the service itself) and `block_start_at`/`block_end_at` (including the service's buffer before and after).
  - Conflicts are evaluated on the buffered block.
  - Rescheduling keeps the booked duration (snapshot) and uses the service's current buffers.
- **Display:** every time in the dashboard and on booking pages is rendered in the **business** time zone, never the viewer's browser zone. The landing-page demo is the only exception.

## Precedence of hours and exceptions

1. **Business hours for the local date**
   - A business `CLOSED` exception means closed all day. It can span a date range for holidays.
   - Business `CUSTOM_HOURS` rows _replace_ the weekly hours for that date.
   - Otherwise the weekly business rules for that weekday apply.
2. **Staff hours for the local date**
   - A staff `CLOSED` exception means a day off.
   - Staff `CUSTOM_HOURS` replace their weekly rules.
   - Staff with weekly rules use them; staff with **no** weekly rules inherit business hours.
3. **Working windows** are business hours ∩ staff hours, minus `BLOCK` exceptions. A business-wide block affects everyone; a staff block affects only that person.
4. **A start time is bookable** when the appointment fits inside one working window and its buffered block overlaps no active appointment for that staff member.
5. **Public bookings additionally require:**
   - minimum notice;
   - the maximum-advance window (the service's override wins);
   - the service's allowed days (`ALL` / `WEEKDAYS` / `SATURDAYS`);
   - the service being active and online, and the page being published.

   Staff-created bookings skip notice, advance and allowed-day rules, but never hours, breaks, blocks or conflicts.

"No preference" picks, among the staff who can take the slot, the person with the fewest bookings that day (ties go to display order).

## Conflict prevention under concurrency

There are two layers.

1. **Re-validation inside the transaction.** The slot is re-checked against fresh data immediately before the insert or update. This gives correct, friendly errors in the common case.
2. **A database guarantee.** The migration [`20261009000100_constraints_and_security`](../prisma/migrations/20261009000100_constraints_and_security/migration.sql) adds:

   ```sql
   EXCLUDE USING gist (tenant_id WITH =, staff_id WITH =,
                       tstzrange(block_start_at, block_end_at, '[)') WITH &&)
   WHERE (status IN ('PENDING','CONFIRMED','COMPLETED'))
   ```

   Two concurrent transactions that both passed layer 1 cannot both commit: the second gets SQLSTATE `23P01`. That error is mapped to `SLOT_TAKEN` ("That time was just taken"), and the whole transaction rolls back, including a customer created in it.

   - `CANCELLED` and `NO_SHOW` appointments do not occupy time.
   - For "No preference" the engine retries up to three times, so a lost race can fall through to another free staff member.
   - Unassigned appointments are impossible: `staff_id` is NOT NULL, so every booking occupies a concrete resource. A one-person business has one staff row.

**Rescheduling** row-locks the appointment (`SELECT … FOR UPDATE`, so concurrent moves or cancels of the same appointment serialise). It then re-checks while excluding the appointment itself, and relies on the same constraint against other appointments.

## Per-phone active-appointment limit

- **Policy:** `BookingPolicy.maxActiveAppointmentsPerPhone`, between 1 and 20. It is validated by Zod and enforced by a CHECK constraint.
  - It is scoped **per tenant**: the same person can book with other businesses.
  - Owners change it in Business settings, and the change is audited with the old and new values.
- **Which appointments count** ([`rules.ts`](../src/modules/bookings/rules.ts)): status `PENDING` or `CONFIRMED` **and** `end_at > now()`. A past appointment whose status was never updated does not block anyone. `CANCELLED`, `COMPLETED` and `NO_SHOW` never count.
- **Phone key:** the number is normalised to E.164 using the explicitly selected country (or a leading `+`). Invalid numbers are rejected, never stored as if normalised.
- **Unverified:** the phone is a lookup and limit key, never a credential. The UI says so, and self-service uses a secret manage link instead.
- **Applies to owner-created bookings too** whenever a phone is present. Walk-ins without a phone have no key, and therefore no limit.

### Serialisation strategy

Inside the booking transaction (READ COMMITTED), before counting:

```sql
SELECT pg_advisory_xact_lock(hashtextextended('phone:<tenant_id>:<e164>', 0))
```

- The key is passed as a bound parameter, never interpolated.
- Concurrent bookings for the same tenant and phone queue on this lock, so "count active → insert" cannot interleave. The second transaction counts only after the first has committed or rolled back.
- Different phones or tenants do not contend.
- The lock is **transaction-scoped**, so it is released on commit or rollback. That makes it safe with Supabase's transaction pooler: no session state survives the transaction.
- Hash collisions (64-bit) can only cause extra serialisation, never a wrong answer.

### Retries, deadlocks and idempotency

- `withTransaction` retries serialisation failures (`40001`) and deadlocks (`40P01`) up to three times with jittered backoff. Business-rule errors are never retried.
- Lock order is always "phone lock → appointment insert", and reschedules take only the appointment row lock, so the engine creates no lock-order inversions.
- **Idempotency:**
  - The public form sends a client-generated UUID, covered by a unique index on `(tenant_id, idempotency_key)`.
  - A retried or double-clicked submission returns the original booking. The manage link is rotated so the retrying client gets a working link.
  - If the duplicate committed first, the engine detects it on failure and replays it instead of returning an error.

### What is tested against real PostgreSQL

The tests in [`tests/integration/booking-concurrency.test.ts`](../tests/integration/booking-concurrency.test.ts) cover:

- 10 parallel bookings for one slot produce exactly 1 success;
- different staff at the same time both succeed;
- "No preference" with two staff and four parallel requests produces two bookings on distinct staff;
- buffers;
- cancelled appointments freeing their slot;
- racing reschedules;
- the raw exclusion constraint;
- the phone limit under six parallel requests (limit 1);
- formatting-insensitive phone matching;
- per-tenant scope;
- policy changes, and stale past appointments not counting;
- owner-created bookings;
- no orphan customers after a failure;
- idempotent double submits;
- server-side prices and snapshots.

## Cancellation and customer self-service

- **Owners and managers** can cancel at any time and pick a reason, which is stored. **Staff** can cancel only their own appointments.
- **Customers** can cancel or reschedule through `/book/<slug>/manage/<token>` until `BookingPolicy.cancellationWindowMin` before the start. After that, the page asks them to contact the business.
- The link carries a 256-bit token. Only its HMAC is stored. The page is `noindex` and uses `Referrer-Policy: no-referrer`.
- After a cancellation the token is cleared, so the link becomes read-only.
- **Status lifecycle:**

  | From        | To                                                   |
  | ----------- | ---------------------------------------------------- |
  | `PENDING`   | `CONFIRMED` or `CANCELLED`                           |
  | `CONFIRMED` | `CANCELLED`; or `COMPLETED` / `NO_SHOW` once started |

  Terminal states stay terminal. Completing an appointment never records a payment.
