# Design mapping, gaps and assumptions

Source of truth: [`/design/project`](../design/project). These are HTML prototypes built on a small React runtime (`support.js`). They were read as specifications and have not been modified.

## Screen → route mapping

| Design                                    | Implemented as                                                                                                                                                                                                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tempo.dc.html` (index and design system) | Tokens in [`src/styles/_tokens.scss`](../src/styles/_tokens.scss): Paper/Workspace/Ink/Tempo orange/Evergreen/Platform/Danger, the status pills, calendar cell styles and the spacing/radius scale. Type: Bricolage Grotesque, Hanken Grotesk and JetBrains Mono, self-hosted with `next/font`     |
| `Tempo Landing.dc.html`                   | `/`, ported section by section: the CSS-3D scroll street, the customer journey phone, the owner journey browser, the live template switcher (runs the real `BookingFlow` in demo mode), analytics, benefits, pricing ("$ —" placeholders, monthly/annual toggle, comparison table), CTA and footer |
| `Booking Flow.dc.html`                    | [`BookingFlow`](../src/components/features/booking/BookingFlow.tsx), the same 5 steps, labels and per-template theme tokens. It is wired to the real slot API, booking API and manage link                                                                                                         |
| `Booking Pages.dc.html`                   | `/book/[slug]`, with five templates (barber, wellness, consult, fitness, services) over one engine and container-query (`cqw`) sizing. The demo toolbar (template tabs, desktop/mobile toggle) is prototype chrome and is not part of a real page                                                  |
| `Tempo App.dc.html`                       | `/app/[tenant]/*`: sidebar, business switcher, overview, calendar (day/week/month), appointments, services and editor drawer, availability, appointment drawer, reschedule panel, new-appointment modal, confirm dialogs and toasts                                                                |
| `Tempo Super Admin.dc.html`               | `/super-admin/*`: overview, businesses and drawer, users, settings and audit log; plans and templates are placeholders                                                                                                                                                                             |

## Screens not in the design, built in its language

- **Auth** (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/invite`): Paper ground, Bricolage headings, the app's form controls.
- **Onboarding** (`/app/[tenant]/onboarding`): a five-step checklist (details, services, hours, policy, publish).
- **"NEXT" pages in the app design**, built following their placeholder copy:
  - **Staff:** profiles, services offered, upcoming and completed counts, estimated value.
  - **Customers:** directory and profile with history and notes.
  - **Analytics:** volume by day/week/month, estimated vs collected, status breakdown, no-show rate, utilisation, staff and service filters.
  - **Booking page:** template choice, copy, contact, publish/unpublish and preview.
  - **Business settings:** booking policy including the phone limit, business details, team and invitations, recent activity.
- **404 and error pages.**

## Deviations and why

1. **Collected revenue.** The design shows "Not set up / Payment tracking is a planned integration". The requirements call for recording collected amounts, so:
   - the appointment drawer has **Record payment** (partial amounts, cash/card/other), plus refunds and voids for managers;
   - the Payment column shows "Not recorded", "$38 collected" or "$20 of $38";
   - the "Revenue collected" KPI shows recorded money.

   No payment provider is integrated.

2. **Phone country selector.** The design has a single phone field. A compact country-code select was added so numbers normalise to E.164 without assuming one country. In the owner modal, "Phone or email" became separate phone and email fields.
3. **No prototype disclaimers.** The "Demo prototype · no appointment was created" footer was removed from real bookings and kept only in the landing demo. "Sent to {email}" appears only when an email was actually sent; otherwise the confirmation explains the private manage link.
4. **Consultation template.** The notes hint is "Practical needs, e.g. access or interpreter", with "Please don't include health details here." The design's "Anything we should prepare for" could invite medical details, which this release must not collect.
5. **Photos.** The design's hatched placeholders are kept, without the "[ shop interior photo ]" labels. There are no uploads, because Storage is out of scope.
6. **Time off.** The design has no UI for staff blocks, so "Holidays, overrides and time off" lets owners scope an override to the whole business or one person, with types Closed/Day off, Custom hours and Block time.
7. **Conflict rules are stricter than the prototype.** The prototype ignored buffers, overrides, notice and advance rules. The real engine enforces them (see [booking-engine.md](booking-engine.md)).
8. **Business switcher.** It lists the user's real memberships. The subline shows `/book/<slug>` or "Draft · not published".
9. **Super-admin:**
   - Suspension also signs the tenant's members out.
   - User suspension uses an in-app dialog with a reason instead of the browser's `confirm()`.
   - Role changes ask for confirmation.
   - "System health" shows live checks (database, email configuration) where available.
   - The "Platform admin" link was removed from the public footer.
10. **Landing links.** "Log in" goes to `/login` and the CTAs go to `/signup`. The template links point to the seeded demo businesses at `/book/<slug>`.
11. **Dark mode and i18n.** Not in the design and not implemented. The UI is en-US with 12-hour times, and dates use the business time zone.

## Known gaps

- The Plans and Templates super-admin pages are placeholders, as in the design. Plan limits (for example staff seats) are displayed but not enforced.
- No drag-and-drop rescheduling in the calendar (the design has none either).
- Feature flags are stored and audited but do not gate any shipped behaviour yet.
