/**
 * Fabricate future requests and bookings that exercise the UI's edge cases.
 * Re-runnable (fixed ids). Run with: npx tsx prisma/seed-future.ts
 *
 * Scenarios (W1 = next Monday's week, W2 the week after, …):
 *  - W1 Tue  : 5 sessions in one day incl. back-to-back at the same address (no travel) and a 120-min session
 *  - W1 Wed  : tight commute — Carol (Weybridge) 10:00–11:00 then Dave (Richmond) 11:10 pending
 *  - W1 Thu  : three competing PENDING requests overlapping 17:00–18:30 (accept one → others clash)
 *  - W1 Fri  : accepted session inside a partial day-off exception (created before the exception)
 *  - W1 Sat  : EXTRA hours exception 09:00–12:00 with a booking in it
 *  - W2 Mon  : session at 06:30, outside the weekly template (edge: shown before the 07:00 line)
 *  - W2      : Eve's pending weekly series ×6, one week falling on a whole-day exception
 *  - tomorrow: Alice session ~26h away (cancellable) and Bob ~20h away (NOT cancellable by client)
 *  - W3      : a future cancelled-by-client and a declined request (should not block slots)
 */
import { PrismaClient } from "@prisma/client";
import { addDays, addMinutes, startOfWeek } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const db = new PrismaClient();
const TZ = "Europe/London";

const todayKey = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
const w1 = addDays(startOfWeek(new Date(todayKey), { weekStartsOn: 1 }), 7); // next Monday
const day = (week: number, weekday: number) => formatInTimeZone(addDays(w1, (week - 1) * 7 + (weekday - 1)), TZ, "yyyy-MM-dd");
const at = (date: string, hhmm: string) => fromZonedTime(`${date}T${hhmm}:00`, TZ);

async function client(email: string, name: string, phone: string, loc: { label: string; formatted: string; lat: number; lng: number; areaId?: string }) {
  const u = await db.user.upsert({ where: { email }, update: { name, phone }, create: { email, name, phone, role: "CLIENT" } });
  const id = `fut-loc-${email.split("@")[0]}`;
  const { areaId, ...fields } = loc;
  const l = await db.location.upsert({
    where: { id },
    update: { ...fields, serviceAreaId: areaId ?? null },
    create: { id, userId: u.id, ...fields, serviceAreaId: areaId ?? null },
  });
  return { user: u, loc: l };
}

type Spec = { id: string; who: { user: { id: string }; loc: { id: string } }; date: string; time: string; dur: number; status?: string; note?: string; seriesId?: string; reason?: string };

async function book(s: Spec) {
  const startAt = at(s.date, s.time);
  await db.booking.upsert({
    where: { id: s.id },
    update: { startAt, endAt: addMinutes(startAt, s.dur), status: s.status ?? "PENDING" },
    create: {
      id: s.id,
      clientId: s.who.user.id,
      locationId: s.who.loc.id,
      startAt,
      endAt: addMinutes(startAt, s.dur),
      durationMin: s.dur,
      status: s.status ?? "PENDING",
      clientNote: s.note ?? null,
      seriesId: s.seriesId ?? null,
      cancelReason: s.reason ?? null,
      cancelledAt: s.status?.startsWith("CANCELLED") ? new Date() : null,
    },
  });
}

async function main() {
  const alice = { user: await db.user.findUniqueOrThrow({ where: { email: "alice@example.com" } }), loc: await db.location.findFirstOrThrow({ where: { userId: (await db.user.findUniqueOrThrow({ where: { email: "alice@example.com" } })).id, formatted: { contains: "Esher" } } }) };
  const bob = { user: await db.user.findUniqueOrThrow({ where: { email: "bob@example.com" } }), loc: await db.location.findFirstOrThrow({ where: { userId: (await db.user.findUniqueOrThrow({ where: { email: "bob@example.com" } })).id } }) };
  const carol = await client("carol@example.com", "Carol Nguyen", "07700 900111", { label: "Home", formatted: "Queens Road, Weybridge", lat: 51.3735, lng: -0.4602, areaId: "seed-area-weybridge" });
  const dave = await client("dave@example.com", "Dave O'Brien", "07700 900222", { label: "Office gym", formatted: "Hill Street, Richmond", lat: 51.4605, lng: -0.3055, areaId: "seed-area-richmond" });
  const eve = await client("eve@example.com", "Eve Patel", "07700 900333", { label: "Home", formatted: "Portsmouth Road, Thames Ditton", lat: 51.3902, lng: -0.3345, areaId: "seed-area-thames-ditton" });
  const frank = await client("frank@example.com", "Frank Müller", "07700 900444", { label: "Home", formatted: "Copsem Lane, Esher", lat: 51.3625, lng: -0.3708, areaId: "seed-area-esher" });

  // --- W1 Tue: busy day, back-to-back same address, 120-min session
  const tue = day(1, 2);
  await book({ id: "fut-tue-1", who: carol, date: tue, time: "07:00", dur: 60, status: "ACCEPTED" });
  await book({ id: "fut-tue-2", who: carol, date: tue, time: "08:00", dur: 60, status: "ACCEPTED", note: "Same address as 7am — partner's session" });
  await book({ id: "fut-tue-3", who: eve, date: tue, time: "10:00", dur: 120, status: "ACCEPTED", note: "Double session — strength + mobility" });
  await book({ id: "fut-tue-4", who: frank, date: tue, time: "13:30", dur: 30, status: "ACCEPTED" });
  await book({ id: "fut-tue-5", who: alice, date: tue, time: "17:00", dur: 90, status: "PENDING" });

  // --- W1 Wed: tight commute Weybridge → Richmond with 10 min gap
  const wed = day(1, 3);
  await book({ id: "fut-wed-1", who: carol, date: wed, time: "10:00", dur: 60, status: "ACCEPTED" });
  await book({ id: "fut-wed-2", who: dave, date: wed, time: "11:10", dur: 60, status: "PENDING", note: "Can we do 11:10? Meeting until 11" });

  // --- W1 Thu: three competing overlapping requests
  const thu = day(1, 4);
  await book({ id: "fut-thu-1", who: eve, date: thu, time: "17:00", dur: 60 });
  await book({ id: "fut-thu-2", who: frank, date: thu, time: "17:30", dur: 60 });
  await book({ id: "fut-thu-3", who: dave, date: thu, time: "17:00", dur: 90 });

  // --- W1 Fri: partial exception 15:00–18:00 with an accepted booking inside it
  const fri = day(1, 5);
  await db.availabilityException.upsert({
    where: { id: "fut-exc-fri" },
    update: { date: fri },
    create: { id: "fut-exc-fri", date: fri, type: "UNAVAILABLE", startTime: "15:00", endTime: "18:00", note: "Physio appointment" },
  });
  await book({ id: "fut-fri-1", who: frank, date: fri, time: "16:00", dur: 60, status: "ACCEPTED", note: "Booked before Toby blocked the afternoon" });

  // --- W1 Sat: EXTRA hours with a booking
  const sat = day(1, 6);
  await db.availabilityException.upsert({
    where: { id: "fut-exc-sat" },
    update: { date: sat },
    create: { id: "fut-exc-sat", date: sat, type: "EXTRA", startTime: "09:00", endTime: "12:00", note: "Saturday morning slots" },
  });
  await book({ id: "fut-sat-1", who: dave, date: sat, time: "09:30", dur: 60, status: "ACCEPTED" });

  // --- W2 Mon: outside template hours
  await book({ id: "fut-w2-early", who: carol, date: day(2, 1), time: "06:30", dur: 30, status: "ACCEPTED", note: "Early start agreed by phone" });

  // --- W2+: Eve's pending weekly series ×6 (Tue 18:30), one week on a whole-day exception
  const seriesStart = day(2, 2);
  const offDay = day(4, 2);
  await db.availabilityException.upsert({
    where: { id: "fut-exc-off" },
    update: { date: offDay },
    create: { id: "fut-exc-off", date: offDay, type: "UNAVAILABLE", note: "Course" },
  });
  const series = await db.bookingSeries.upsert({
    where: { id: "fut-series-eve" },
    update: { startDate: seriesStart, endDate: day(7, 2) },
    create: { id: "fut-series-eve", clientId: eve.user.id, locationId: eve.loc.id, weekday: 2, startTime: "18:30", durationMin: 60, startDate: seriesStart, endDate: day(7, 2), status: "PENDING" },
  });
  for (let w = 2; w <= 7; w++) {
    if (day(w, 2) === offDay) continue; // the wizard would have skipped this week
    await book({ id: `fut-series-eve-${w}`, who: eve, date: day(w, 2), time: "18:30", dur: 60, seriesId: series.id, note: w === 2 ? "Weekly evening slot please" : undefined });
  }

  // --- Tomorrow-ish: cancellation-window edge cases (26h vs 20h from now)
  const in26h = addMinutes(new Date(), 26 * 60);
  const in20h = addMinutes(new Date(), 20 * 60);
  for (const [id, who, when, note] of [
    ["fut-soon-alice", alice, in26h, "Just outside the 24h window — client CAN cancel"],
    ["fut-soon-bob", bob, in20h, "Inside the 24h window — client CANNOT cancel"],
  ] as const) {
    await db.booking.upsert({
      where: { id },
      update: { startAt: when, endAt: addMinutes(when, 60) },
      create: { id, clientId: who.user.id, locationId: who.loc.id, startAt: when, endAt: addMinutes(when, 60), durationMin: 60, status: "ACCEPTED", clientNote: note },
    });
  }

  // --- W3: cancelled and declined future entries (must not block slots)
  await book({ id: "fut-w3-cancelled", who: frank, date: day(3, 3), time: "09:00", dur: 60, status: "CANCELLED_BY_CLIENT", reason: "Holiday" });
  await book({ id: "fut-w3-declined", who: dave, date: day(3, 3), time: "09:00", dur: 60, status: "DECLINED" });
  await book({ id: "fut-w3-cancelled-trainer", who: carol, date: day(3, 4), time: "12:00", dur: 60, status: "CANCELLED_BY_TRAINER", reason: "Van in for repair — sorry!" });

  console.log(`Seeded future scenarios starting week of ${day(1, 1)}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
