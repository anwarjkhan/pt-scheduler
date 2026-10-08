/**
 * Three months of training history for every demo client.
 * Re-runnable (fixed ids). Run with: npm run db:seed:quarter
 *
 * The existing history seed covers only Alice and Bob, which left everyone
 * else a few weeks old and permanently stuck on "Too early to tell". This
 * gives each client a full quarter and a distinct character, so the health
 * scoring has something real to separate:
 *
 *   Alice    weekly, near-perfect                  → the model client
 *   Carol    weekly, polite cancellations          → good, not flawless
 *   Dave     fortnightly, steady                   → fine, lower cadence
 *   Bob      weekly, two late cancels + a no-show  → the problem
 *   Frank    erratic, reschedules constantly       → hard work
 *   Grace    weekly then stops six weeks ago       → drifting
 *   Harry    monthly, long sessions                → low frequency, high value
 *   Eve      weekly, recently ill                  → the exempt case
 *   Anwar2   twice weekly, 120-min                 → the big spender
 *
 * Sessions are written in the past as COMPLETED with their price snapshotted,
 * because that is what a real session looks like after the sweep has run.
 * Wallet entries are left to seed-wallets, which reads this history.
 */
import { PrismaClient } from "@prisma/client";
import { addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const db = new PrismaClient();
const TZ = "Europe/London";

/** Local date key for N days before now. */
function dayKey(daysAgo: number): string {
  return formatInTimeZone(new Date(Date.now() - daysAgo * 86_400_000), TZ, "yyyy-MM-dd");
}

function at(date: string, hhmm: string): Date {
  return fromZonedTime(`${date}T${hhmm}:00`, TZ);
}

type Profile = {
  email: string;
  /** Days between sessions. */
  everyDays: number;
  time: string;
  durationMin: number;
  sessionType?: "IN_PERSON" | "ONLINE";
  /** Stop generating this many days before now — for the client who drifted. */
  stoppedDaysAgo?: number;
  /** Occurrence indexes (0 = oldest) the client cancelled, with notice in hours. */
  cancelAt?: { index: number; noticeHours: number }[];
  /** Occurrence indexes the client simply did not attend. */
  noShowAt?: number[];
  /** Occurrence indexes the client asked to move, and how many times. */
  movedAt?: { index: number; times: number }[];
};

const QUARTER_DAYS = 92;

const PROFILES: Profile[] = [
  // The model client: weekly, turns up, one cancellation with plenty of notice.
  { email: "alice@example.com", everyDays: 7, time: "09:00", durationMin: 60, cancelAt: [{ index: 4, noticeHours: 96 }] },

  // Good but human: a couple of polite cancellations.
  {
    email: "carol@example.com",
    everyDays: 7,
    time: "10:30",
    durationMin: 60,
    cancelAt: [
      { index: 3, noticeHours: 72 },
      { index: 9, noticeHours: 48 },
    ],
  },

  // Steady, just less often.
  { email: "dave@example.com", everyDays: 14, time: "18:00", durationMin: 60 },

  // The problem: cancels at the last minute, and once did not turn up at all.
  {
    email: "bob@example.com",
    everyDays: 7,
    time: "16:30",
    durationMin: 60,
    cancelAt: [
      { index: 2, noticeHours: 1 },
      { index: 7, noticeHours: 0.5 },
    ],
    noShowAt: [10],
  },

  // Hard work: moves nearly every session.
  {
    email: "frank@example.com",
    everyDays: 10,
    time: "12:00",
    durationMin: 60,
    movedAt: [
      { index: 1, times: 2 },
      { index: 3, times: 1 },
      { index: 5, times: 3 },
      { index: 7, times: 2 },
    ],
  },

  // Was weekly, has not been seen for six weeks.
  { email: "grace@example.com", everyDays: 7, time: "08:00", durationMin: 60, stoppedDaysAgo: 42 },

  // Infrequent but worth having: monthly 90-minute sessions.
  { email: "harry@example.com", everyDays: 28, time: "11:00", durationMin: 90 },

  // Regular until illness stopped her a fortnight ago — the exempt case.
  { email: "eve@example.com", everyDays: 7, time: "07:30", durationMin: 60, stoppedDaysAgo: 14 },

  // The big spender: twice-weekly two-hour sessions.
  { email: "anwar@example.com", everyDays: 4, time: "13:00", durationMin: 120 },
];

async function main() {
  const rules = await db.priceRule.findMany();
  const settings = await db.trainerSettings.findUnique({ where: { id: "singleton" } });
  const currency = settings?.currency ?? "GBP";
  if (rules.length === 0) {
    console.error("No price rules — run the migrations first, or set rates in Settings → Billing.");
    process.exit(1);
  }

  const priceFor = (sessionType: string, durationMin: number) =>
    rules.find((r) => r.sessionType === sessionType && r.durationMin === durationMin)?.amountPence ?? null;

  let created = 0;
  let skipped = 0;
  const summary: string[] = [];

  for (const p of PROFILES) {
    const user = await db.user.findUnique({ where: { email: p.email }, select: { id: true, name: true } });
    if (!user) {
      skipped++;
      continue;
    }
    const loc = await db.location.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    if (!loc) {
      skipped++;
      continue;
    }

    const sessionType = p.sessionType ?? "IN_PERSON";
    const amount = priceFor(sessionType, p.durationMin);
    const tag = p.email.split("@")[0];
    const cancels = new Map((p.cancelAt ?? []).map((c) => [c.index, c.noticeHours]));
    const noShows = new Set(p.noShowAt ?? []);
    const moves = new Map((p.movedAt ?? []).map((m) => [m.index, m.times]));

    // Walk back from the oldest session to the most recent, so index 0 is the
    // first time they trained — which is what the profiles above describe.
    const stopAt = p.stoppedDaysAgo ?? 0;
    const offsets: number[] = [];
    for (let d = QUARTER_DAYS; d >= stopAt; d -= p.everyDays) offsets.push(d);

    let n = 0;
    for (const [index, daysAgo] of offsets.entries()) {
      const date = dayKey(daysAgo);
      const startAt = at(date, p.time);
      const endAt = addMinutes(startAt, p.durationMin);
      const id = `q-${tag}-${index}`;

      const noticeHours = cancels.get(index);
      const cancelled = noticeHours != null;
      const noShow = noShows.has(index);
      const moved = moves.get(index) ?? 0;

      const data = {
        clientId: user.id,
        locationId: loc.id,
        sessionType,
        startAt,
        endAt,
        durationMin: p.durationMin,
        status: cancelled ? "CANCELLED_BY_CLIENT" : "COMPLETED",
        // A no-show still occupied the slot, so it completes with the flag set.
        noShow,
        completedAt: cancelled ? null : endAt,
        cancelledAt: cancelled ? new Date(startAt.getTime() - noticeHours * 3_600_000) : null,
        // Cancelled sessions were never delivered, so they carry a price (it is
        // what a late-cancellation fee is a percentage of) but no completion.
        priceAmountPence: amount,
        priceCurrency: amount == null ? null : currency,
        rescheduleCount: moved,
        rescheduledBy: moved > 0 ? "CLIENT" : null,
        lastRescheduledAt: moved > 0 ? new Date(startAt.getTime() - 3 * 86_400_000) : null,
        createdAt: new Date(startAt.getTime() - 14 * 86_400_000),
      };

      await db.booking.upsert({ where: { id }, update: data, create: { id, ...data } });
      created++;
      n++;
    }

    const delivered = n - (p.cancelAt?.length ?? 0);
    summary.push(
      `  ${(user.name ?? p.email).padEnd(16)} ${String(n).padStart(2)} sessions over ${QUARTER_DAYS}d · every ${p.everyDays}d` +
        (p.stoppedDaysAgo ? ` · stopped ${p.stoppedDaysAgo}d ago` : "") +
        (p.noShowAt?.length ? ` · ${p.noShowAt.length} no-show` : "") +
        (p.cancelAt?.length ? ` · ${p.cancelAt.length} cancelled` : "") +
        ` · ${delivered} delivered`,
    );
  }

  console.log(`Wrote ${created} sessions across ${PROFILES.length - skipped} clients${skipped ? ` (${skipped} skipped — no client or no address)` : ""}.\n`);
  for (const line of summary) console.log(line);
  console.log("\nNext: npm run db:seed:wallets — it prices anything new and rebuilds the ledger.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
