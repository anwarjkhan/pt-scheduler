/**
 * Populate ~two months of realistic client activity: weekly regulars, one-off requests
 * awaiting a decision, online sessions, cancellations and a few availability exceptions.
 * Scheduled inside the trainer's template (Mon 14–18, Tue/Thu 07–20, Fri 07–15; Wed off)
 * and around the bookings seed-future.ts already makes. Re-runnable (fixed `batch-` ids).
 * Run with: npx tsx prisma/seed-batch.ts
 *
 * W1 = next Monday's week, running to W9.
 *  - Accepted weekly series: Alice Tue 07:30, Grace Tue 10:00, Carol Thu 09:00,
 *    Frank Mon 15:00, Harry Fri 08:00 (online) — each skips exception days
 *  - Pending weekly series: Dave Thu 18:00 from W3
 *  - Ad-hoc accepted: Bob fortnightly Mon 16:30, Eve online Thu 12:00, Carol Fri 10:30
 *  - Pending one-offs spread across the window, incl. two competing Thu 17:00 requests
 *  - Cancelled (client and trainer) and declined entries
 *  - Exceptions: W5 Fri off, W7 Sat extra hours with bookings, W8 Thu afternoon blocked
 */
import { PrismaClient } from "@prisma/client";
import { addDays, addMinutes, startOfWeek } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const db = new PrismaClient();
const TZ = "Europe/London";
const WEEKS = 9;

const todayKey = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
const w1 = addDays(startOfWeek(new Date(todayKey), { weekStartsOn: 1 }), 7); // next Monday
const day = (week: number, weekday: number) => formatInTimeZone(addDays(w1, (week - 1) * 7 + (weekday - 1)), TZ, "yyyy-MM-dd");
const at = (date: string, hhmm: string) => fromZonedTime(`${date}T${hhmm}:00`, TZ);

type Who = { user: { id: string }; loc: { id: string } };

async function existing(email: string): Promise<Who> {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const loc = await db.location.findFirstOrThrow({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return { user, loc };
}

async function client(email: string, name: string, phone: string, { area: areaLabel, ...fields }: { label: string; formatted: string; lat: number; lng: number; area: string }): Promise<Who> {
  const user = await db.user.upsert({ where: { email }, update: { name, phone }, create: { email, name, phone, role: "CLIENT" } });
  const area = await db.serviceArea.findFirst({ where: { label: areaLabel } });
  const id = `batch-loc-${email.split("@")[0]}`;
  const l = await db.location.upsert({
    where: { id },
    update: { ...fields, serviceAreaId: area?.id ?? null },
    create: { id, userId: user.id, ...fields, serviceAreaId: area?.id ?? null },
  });
  return { user, loc: l };
}

type Spec = {
  id: string;
  who: Who;
  date: string;
  time: string;
  dur: number;
  status?: string;
  online?: boolean;
  note?: string;
  seriesId?: string;
  reason?: string;
};

async function book(s: Spec) {
  const startAt = at(s.date, s.time);
  const status = s.status ?? "PENDING";
  const fields = {
    clientId: s.who.user.id,
    locationId: s.who.loc.id,
    sessionType: s.online ? "ONLINE" : "IN_PERSON",
    startAt,
    endAt: addMinutes(startAt, s.dur),
    durationMin: s.dur,
    status,
    clientNote: s.note ?? null,
    seriesId: s.seriesId ?? null,
    cancelReason: s.reason ?? null,
    cancelledAt: status.startsWith("CANCELLED") ? new Date() : null,
  };
  await db.booking.upsert({ where: { id: s.id }, update: fields, create: { id: s.id, ...fields } });
}

async function exception(id: string, date: string, type: "UNAVAILABLE" | "EXTRA", note: string, startTime?: string, endTime?: string) {
  const fields = { date, type, note, startTime: startTime ?? null, endTime: endTime ?? null };
  await db.availabilityException.upsert({ where: { id }, update: fields, create: { id, ...fields } });
}

async function main() {
  const alice = await existing("alice@example.com");
  const bob = await existing("bob@example.com");
  const carol = await existing("carol@example.com");
  const dave = await existing("dave@example.com");
  const eve = await existing("eve@example.com");
  const frank = await existing("frank@example.com");
  const grace = await client("grace@example.com", "Grace Holloway", "07700 900555", { label: "Home", formatted: "Tilt Road, Cobham", lat: 51.3262, lng: -0.4058, area: "Cobham" });
  const harry = await client("harry@example.com", "Harry Singh", "07700 900666", { label: "Home", formatted: "Church Street, Epsom", lat: 51.3326, lng: -0.2651, area: "Epsom" });

  // --- Exceptions first, so series below can skip the days they close
  const friOff = day(5, 5);
  const satExtra = day(7, 6);
  const thuBlocked = day(8, 4);
  await exception("batch-exc-fri-off", friOff, "UNAVAILABLE", "Half-term long weekend");
  await exception("batch-exc-sat-extra", satExtra, "EXTRA", "Saturday catch-up slots", "08:00", "12:00");
  await exception("batch-exc-thu-dentist", thuBlocked, "UNAVAILABLE", "Dentist", "12:00", "15:00");
  const closed = new Set([friOff, day(2, 2) /* seed-future's whole-day "Course" */]);

  // --- Weekly series
  const weekly = async (key: string, who: Who, weekday: number, time: string, dur: number, status: string, from: number, opts: { online?: boolean; note?: string } = {}) => {
    const seriesId = `batch-series-${key}`;
    const fields = {
      clientId: who.user.id,
      locationId: who.loc.id,
      sessionType: opts.online ? "ONLINE" : "IN_PERSON",
      weekday: weekday % 7,
      startTime: time,
      durationMin: dur,
      startDate: day(from, weekday),
      endDate: day(WEEKS, weekday),
      status,
    };
    await db.bookingSeries.upsert({ where: { id: seriesId }, update: fields, create: { id: seriesId, ...fields } });
    for (let w = from; w <= WEEKS; w++) {
      const date = day(w, weekday);
      if (closed.has(date)) continue; // the wizard skips closed days
      await book({ id: `${seriesId}-${w}`, who, date, time, dur, status, online: opts.online, seriesId, note: w === from ? opts.note : undefined });
    }
  };
  await weekly("alice-tue", alice, 2, "07:30", 60, "ACCEPTED", 1, { note: "Before the school run please" });
  await weekly("grace-tue", grace, 2, "10:00", 60, "ACCEPTED", 1, { note: "Post-natal return to training — cleared by GP" });
  await weekly("carol-thu", carol, 4, "09:00", 60, "ACCEPTED", 1);
  await weekly("frank-mon", frank, 1, "15:00", 45, "ACCEPTED", 1, { note: "Knee rehab — keep it low impact" });
  await weekly("harry-fri", harry, 5, "08:00", 60, "ACCEPTED", 1, { online: true, note: "Working from home Fridays, video is easiest" });
  await weekly("dave-thu", dave, 4, "18:00", 60, "PENDING", 3, { note: "Thursday evenings until Christmas?" });

  // --- Ad-hoc accepted
  for (const w of [1, 3, 5, 7, 9]) await book({ id: `batch-bob-mon-${w}`, who: bob, date: day(w, 1), time: "16:30", dur: 60, status: "ACCEPTED" });
  for (const w of [2, 6]) await book({ id: `batch-eve-online-${w}`, who: eve, date: day(w, 4), time: "12:00", dur: 30, status: "ACCEPTED", online: true, note: "Quick check-in on the home programme" });
  for (const w of [4, 8]) await book({ id: `batch-carol-fri-${w}`, who: carol, date: day(w, 5), time: "10:30", dur: 60, status: "ACCEPTED", note: "Partner joining this one" });
  await book({ id: "batch-sat-dave", who: dave, date: satExtra, time: "09:00", dur: 60, status: "ACCEPTED" });

  // --- Pending requests awaiting a decision
  await book({ id: "batch-req-bob-lunch", who: bob, date: day(1, 2), time: "12:00", dur: 60, note: "Lunchtime slot — any chance?" });
  await book({ id: "batch-req-grace-review", who: grace, date: day(2, 4), time: "14:00", dur: 90, note: "Can we do 90 minutes for a programme review?" });
  await book({ id: "batch-req-eve-online", who: eve, date: day(2, 5), time: "09:30", dur: 60, online: true, note: "Travelling that week — video instead?" });
  await book({ id: "batch-req-frank-tue", who: frank, date: day(3, 2), time: "16:00", dur: 60, note: "Extra session before my ski trip" });
  await book({ id: "batch-req-harry-mon", who: harry, date: day(4, 1), time: "14:00", dur: 60, note: "In person this time — want to check my deadlift form" });
  await book({ id: "batch-req-bob-thu", who: bob, date: day(4, 4), time: "17:00", dur: 60 }); // competes with Eve below
  await book({ id: "batch-req-eve-thu", who: eve, date: day(4, 4), time: "17:00", dur: 45, note: "Any time after 5 works" });
  await book({ id: "batch-req-grace-sat", who: grace, date: satExtra, time: "10:30", dur: 60, note: "Saw you've opened Saturday — can I grab one?" });
  await book({ id: "batch-req-grace-mon", who: grace, date: day(8, 1), time: "14:00", dur: 45 });
  await book({ id: "batch-req-alice-fri", who: alice, date: day(9, 5), time: "11:00", dur: 60, note: "Pre-Christmas assessment and new programme" });

  // --- Cancelled / declined (must not block slots)
  await book({ id: "batch-series-alice-tue-5", who: alice, date: day(5, 2), time: "07:30", dur: 60, status: "CANCELLED_BY_CLIENT", seriesId: "batch-series-alice-tue", reason: "Half-term — away with the kids" });
  await book({ id: "batch-series-carol-thu-7", who: carol, date: day(7, 4), time: "09:00", dur: 60, status: "CANCELLED_BY_TRAINER", seriesId: "batch-series-carol-thu", reason: "First-aid refresher course clashes — sorry!" });
  await book({ id: "batch-declined-harry", who: harry, date: day(4, 2), time: "19:00", dur: 60, status: "DECLINED", note: "Late one if possible" });

  const count = await db.booking.count({ where: { id: { startsWith: "batch-" } } });
  console.log(`Seeded ${count} batch bookings from ${day(1, 1)} to ${day(WEEKS, 5)}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
