# TJM Training — website + booking

The tjmtraining.com marketing site rebuilt in Next.js, with an integrated booking and calendar system for Toby's clients.

## How the site and the booking app fit together

- **`/`** — the marketing home page (hero, Meet Toby, Kind words, Training Options, Partners, Areas, Contact). Signed-out visitors see **Register** and a person icon that opens a sign-in panel (Google / Apple). Once signed in, the icon becomes an **avatar with the account menu** — client: Book a session, My sessions (badge), My locations, My profile, Notifications, Help, Privacy, Sign out; trainer: Calendar, Requests (pending badge), Availability, Clients, Settings, My profile, Notifications, Help, Privacy, Sign out. Menu contents live in `USER_MENU` in `src/content/site.ts`. The first item opens the **calendar in a modal** — the booking wizard for clients, the week calendar for the trainer. `/?cal=1` opens it directly (used by the site's "Book a session" buttons when signed in).
- **`/signin`, `/register`** — Google sign-in (same flow; Register just sets expectations for new clients). A dev login is available locally with `DEV_LOGIN=true`.
- **`/account`** — profile (name, phone, emergency contact, notes for Toby) and notification preferences (stored; no emails sent yet).
- **`/app/*`** (client) and **`/trainer/*`** (trainer) — the deeper booking-app pages, wrapped in the site header/footer with a charcoal sub-nav.
- **`/personal-trainer-*`, `/injury-rehab-*`, `/privacy-policy`** — the site's area and legal pages, rendered from `src/content/pages.json` (text scraped from the live site).
- Site copy, links, hours and menu items live in `src/content/site.ts`; images in `public/site/`.

**Clients** sign in with Google, save addresses (must be inside one of the trainer's service areas), and request 30/60/90/120-minute sessions, one-off or weekly. They can cancel up to 24 hours before a session.

**The trainer** sets a weekly availability template and per-date exceptions, reviews requests, and accepts/declines them (whole series at once, with per-occurrence overrides). The calendar draws drive time between consecutive sessions and flags any gap that's too short for the commute.

## Online sessions

Clients can request a session as **in-person** or **online**. An online session is
still scheduled against the trainer's home coordinates — it occupies real time in the
day and the commute engine reserves the drive back from the preceding session — but it
is delivered over video instead of at the client's address.

Video is [Daily.co](https://daily.co). Media flows browser-to-browser via Daily's
servers and never through this app, which only decides **who** may enter **which** room
and **when**:

- A **private room** is created per booking (`VideoRoom`), bounded to the session: nobody
  can connect before it opens, and Daily ejects everyone and deletes the room when it
  closes. One-off sessions get a room when the trainer accepts; weekly series create
  theirs on first join, so cancelled occurrences never leave rooms behind. Cancelling or
  moving a session drops its room — a reschedule changes the window, so the room is
  rebuilt on the next join.
- **Joining** goes through `/app/session/[id]`, which authenticates the viewer, checks the
  booking is theirs (the trainer may open any), checks the time window, and only then mints
  a short-lived **meeting token**. The token carries `is_owner`, which is the sole
  difference between the two sides: the trainer can admit, mute and end the call, the
  client cannot. It is decided server-side and never by the browser.
- The window is `JOIN_EARLY_MIN` before the start to `JOIN_LATE_MIN` after the end
  (`src/lib/video-window.ts`, unit-tested). The same function drives the Join button on the
  client's session list and in the trainer's calendar dialog, so they cannot disagree.

Because the room URL is useless without a token, there is no shareable link to leak.

### Ad-hoc sessions and guest links

The trainer can also book an online session directly, without waiting for a client to
request one — either from **New online session** above the calendar or by **clicking any
empty space** in the day/week grid, which pre-fills that time. It is created already
**confirmed** (the trainer booked it, so there is nobody left to accept it) and shows up
in the client's *My sessions* like any other.

Booking this way offers a **guest link** — `/join/<token>` — which the trainer can also
produce later for any confirmed online session from its calendar dialog. It lets someone
join **without signing in**, which is the point: the client can be sent a link over
WhatsApp and just tap it.

> **This link is a bearer credential.** Anyone holding it can join while the session is
> open, so it should be sent only to the client. It is mitigated, not eliminated: the
> token is unguessable, the holder joins as a **guest** (never the host — they cannot mute,
> admit or end the call), and it only works inside the session window. It can be
> **revoked** from the booking dialog, and cancelling or rescheduling the session
> invalidates it automatically.

Clients with no saved address can still be booked online: the session falls back to a
home-based location, since an online session is run from the trainer's home anyway.

## Instagram clips

The home page carries a **From Instagram** grid between *Kind words* and *Training
Options*: thumbnails that play their clip inline when pressed, each linking back to the
original post.

It is **curated, not synced**. Instagram has no public feed API worth depending on — the
Graph API needs `@tjmtraining` converted to a Business/Creator account, a reviewed
Facebook app, and a token refreshed every 60 days, and its CDN URLs expire. Toby instead
adds clips under **Settings → Website → Instagram clips**: a caption, a thumbnail URL, an
optional MP4 URL and the post link. Hosting the MP4 ourselves is also what allows inline
playback in the site's own styling; Instagram's own embed renders their chrome in an
iframe and will not autoplay or match the design.

Nothing is downloaded until a visitor presses play, and a clip with no video URL shows as
a still that links out. The whole section hides itself while the list is empty.

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
| `AUTH_APPLE_ID` / `AUTH_APPLE_SECRET` | Optional Sign in with Apple. `AUTH_APPLE_ID` is your Services ID; `AUTH_APPLE_SECRET` is the client-secret JWT built from your Team ID, Key ID and `.p8` key (Auth.js docs: providers/apple). The Apple button is disabled until both are set. |
| `PT_EMAIL` | The Google account that becomes the trainer on first sign-in. Everyone else is a client. |
| `GOOGLE_MAPS_SERVER_KEY` | Optional. Enable **Distance Matrix API** and **Geocoding API**. Restrict by IP. Used for drive times and for the address/postcode lookup. |
| `DEV_LOGIN` | `true` enables a password-less dev login form on the sign-in page (ignored in production). |
| `DAILY_API_KEY` | Optional. Server-only REST key from the [Daily](https://dashboard.daily.co/) dashboard, enabling video for online sessions. Without it the Join buttons stay hidden and online bookings behave exactly as before. |

**Without a Maps key** the app still runs: the address/postcode lookup uses free UK sources ([postcodes.io](https://postcodes.io) for postcodes, OpenStreetMap Nominatim for street addresses), and commute times are estimated from straight-line distance (marked "estimated" in the UI). Results are cached in `CommuteCache` and refreshed once a real key is present.

### Demo data

`npm run db:seed:future` adds four more clients (Carol, Dave, Eve, Frank) and a set of upcoming edge cases for UI testing: a five-session day with back-to-back same-address sessions and a 120-min block, a tight commute, three overlapping pending requests, a session inside a partial day-off, Saturday extra hours, a 06:30 session outside the template, a pending weekly series that skips a day off, sessions 26h/20h away (cancellable vs not), and future cancelled/declined entries. `npm run db:seed:history` adds ~3 months of past sessions for Alice and Bob (completed, cancelled, declined, with notes) so the trainer's per-client history page has data.

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

- **Settings**: **service areas** (towns/addresses each with their own radius — a client address must fall inside one, by driving distance), home address (start/end of the day), timezone, fallback radius (used only when no areas are defined), commute buffer, slot step, minimum notice.
- **Availability**: weekly hours (multiple ranges per day) and exceptions (day off, partial day, extra hours) — one-off, or repeating every 1/2/4 weeks with an optional end date (stored as `RecurringException` and expanded on read).

## Deploying

Hosted on Vercel with Prisma Postgres. Work on `dev`, which builds as a preview; merge
to `main` to release:

```bash
git switch main && git merge dev && git push && git switch dev
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests and a production build on
every push and PR to either branch.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the release checklist, environment variables,
demo sign-in, and the database caveats.

## Not yet included

Payments, email/SMS notifications, multi-trainer support, waitlists, Google Calendar sync, native mobile wrapper.
