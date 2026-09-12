# PT Scheduler

Booking and calendar management for a mobile personal trainer who trains clients at their chosen locations within a service radius.

**Clients** sign in with Google, save addresses (must be within the trainer's radius — 15 miles by default), and request 30/60/90/120-minute sessions, one-off or weekly. They can cancel up to 24 hours before a session.

**The trainer** sets a weekly availability template and per-date exceptions, reviews requests, and accepts/declines them (whole series at once, with per-occurrence overrides). The calendar draws drive time between consecutive sessions and flags any gap that's too short for the commute.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · Prisma (SQLite locally, Postgres in prod) · Auth.js v5 (Google) · Google Maps Distance Matrix / Geocoding / Places · Vitest.

## Getting started

```bash
npm install
cp .env.example .env      # then fill in the values below
npx prisma migrate dev
npm run db:seed           # optional demo data (see below)
npm run dev
```

### Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `file:./dev.db` locally. For Postgres, set the URL **and** change `provider` in `prisma/schema.prisma` to `postgresql`, then `npx prisma migrate dev`. |
| `AUTH_SECRET` | `npx auth secret` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth 2.0 client from Google Cloud. Redirect URI: `http://localhost:3000/api/auth/callback/google` (and your production URL). |
| `PT_EMAIL` | The Google account that becomes the trainer on first sign-in. Everyone else is a client. |
| `GOOGLE_MAPS_SERVER_KEY` | Enable **Distance Matrix API** and **Geocoding API**. Restrict by IP. |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Enable **Maps JavaScript API** and **Places API**. Restrict by HTTP referrer. |
| `DEV_LOGIN` | `true` enables a password-less dev login form on the sign-in page (ignored in production). |

**Without Maps keys** the app still runs: address entry falls back to manual lat/lng fields, and commute times are estimated from straight-line distance (marked "estimated" in the UI). Results are cached in `CommuteCache` and refreshed once real keys are present.

### Demo data

`npm run db:seed` creates the trainer settings, a Mon–Fri 07:00–20:00 template, clients Alice and Bob with London addresses, and three bookings next Monday — including a deliberately tight commute so the calendar shows a red segment immediately. With `DEV_LOGIN=true`, sign in as `trainer@example.com` (or your `PT_EMAIL`), `alice@example.com`, or `bob@example.com`.

## How scheduling works

All logic lives in `src/lib/scheduling/` and is pure (no DB), so it's unit-tested (`npm test`).

- **Availability** (`availability.ts`): weekly rules per weekday → open windows for a date; exceptions subtract (`UNAVAILABLE`) or add (`EXTRA`) time.
- **Commute** (`conflicts.ts`): for a candidate session, find the previous and next blocking session that day. `required = driveMinutes + bufferMinutes`; if the gap is shorter, the slot gets a **warning** (still bookable — the trainer decides). Hard overlaps are never bookable. First/last sessions of the day report the drive from/to the home base for information.
- **Slots** (`slots.ts`): start times at `slotStepMinutes` intervals that fit the duration, respect `minNoticeHours`, and don't overlap.
- **Recurrence** (`recurrence.ts`): weekly occurrences at the same local time (DST-safe), max 12 weeks. Weeks that are unavailable or taken are skipped and shown to the client before they commit.
- **Rules** (`rules.ts`): the 24-hour cancellation / minimum-notice check.

Evaluations are re-run on the trainer side at accept time and whenever the calendar renders, so warnings always reflect the current schedule.

## Trainer configuration

- **Settings**: home address, timezone, service radius, commute buffer, slot step, minimum notice.
- **Availability**: weekly hours (multiple ranges per day) and dated exceptions (day off, partial day, extra hours).

## Deploying

Vercel + Neon/Supabase Postgres is the intended path: set `DATABASE_URL`, switch the Prisma provider, run migrations, and add the production redirect URI to the Google OAuth client. `postinstall` runs `prisma generate`.

## Not yet included

Payments, email/SMS notifications, multi-trainer support, waitlists, Google Calendar sync, native mobile wrapper.
