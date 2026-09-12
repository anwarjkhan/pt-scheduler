/**
 * Dev seed: trainer settings + Mon–Fri template, two clients with London addresses,
 * and bookings next Monday that include one deliberately tight commute.
 * Re-runnable: everything is keyed by fixed ids.
 */
import { PrismaClient } from "@prisma/client";
import { addDays, addMinutes, startOfWeek } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

const db = new PrismaClient();
const TZ = "Europe/London";
const PT_EMAIL = process.env.PT_EMAIL ?? "trainer@example.com";

async function main() {
  await db.trainerSettings.upsert({
    where: { id: "singleton" },
    update: { homeAddress: "Thames Ditton, Surrey", homeLat: 51.389, homeLng: -0.333 },
    create: {
      id: "singleton",
      timezone: TZ,
      homeAddress: "Thames Ditton, Surrey",
      homeLat: 51.389,
      homeLng: -0.333,
    },
  });

  if ((await db.availabilityRule.count()) === 0) {
    await db.availabilityRule.createMany({
      data: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "07:00", endTime: "20:00" })),
    });
  }

  const trainer = await db.user.upsert({
    where: { email: PT_EMAIL },
    update: { role: "TRAINER" },
    create: { email: PT_EMAIL, name: "Trainer", role: "TRAINER" },
  });
  const alice = await db.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: { email: "alice@example.com", name: "Alice", role: "CLIENT" },
  });
  const bob = await db.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: { email: "bob@example.com", name: "Bob", role: "CLIENT" },
  });

  // Service areas Toby covers (Surrey), each with its own radius.
  const areaDefs = [
    { id: "seed-area-weybridge", label: "Weybridge", formatted: "Weybridge, Surrey", lat: 51.371, lng: -0.457, radiusMiles: 5 },
    { id: "seed-area-esher", label: "Esher", formatted: "Esher, Surrey", lat: 51.369, lng: -0.365, radiusMiles: 5 },
    { id: "seed-area-thames-ditton", label: "Thames Ditton", formatted: "Thames Ditton, Surrey", lat: 51.389, lng: -0.333, radiusMiles: 4 },
    { id: "seed-area-richmond", label: "Richmond", formatted: "Richmond, London", lat: 51.461, lng: -0.303, radiusMiles: 3 },
  ];
  for (const a of areaDefs) await db.serviceArea.upsert({ where: { id: a.id }, update: {}, create: a });

  const aliceHome = await db.location.upsert({
    where: { id: "seed-loc-alice" },
    update: { formatted: "High Street, Esher", lat: 51.3695, lng: -0.3655, serviceAreaId: "seed-area-esher" },
    create: { id: "seed-loc-alice", userId: alice.id, label: "Home", formatted: "High Street, Esher", lat: 51.3695, lng: -0.3655, serviceAreaId: "seed-area-esher" },
  });
  // Bob is in Richmond — far enough from Esher that a 15-minute gap is a tight commute.
  const bobGym = await db.location.upsert({
    where: { id: "seed-loc-bob" },
    update: { label: "Park", formatted: "Richmond Park, Richmond", lat: 51.4471, lng: -0.2741, serviceAreaId: "seed-area-richmond" },
    create: { id: "seed-loc-bob", userId: bob.id, label: "Park", formatted: "Richmond Park, Richmond", lat: 51.4471, lng: -0.2741, serviceAreaId: "seed-area-richmond" },
  });

  // Next Monday (or the one after if today is Monday) in trainer tz.
  const todayKey = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
  const monday = addDays(startOfWeek(new Date(todayKey), { weekStartsOn: 1 }), 7);
  const mondayKey = formatInTimeZone(monday, TZ, "yyyy-MM-dd");
  const at = (hhmm: string) => fromZonedTime(`${mondayKey}T${hhmm}:00`, TZ);

  const seedBookings = [
    // Alice 09:00–10:00 Camden (accepted)
    { id: "seed-b1", clientId: alice.id, locationId: aliceHome.id, start: at("09:00"), dur: 60, status: "ACCEPTED" },
    // Bob 10:15–11:15 Greenwich — only 15 min after Alice, ~9 miles away → tight commute
    { id: "seed-b2", clientId: bob.id, locationId: bobGym.id, start: at("10:15"), dur: 60, status: "PENDING" },
    // Alice 14:00–15:30 Camden (pending) — comfortable gap
    { id: "seed-b3", clientId: alice.id, locationId: aliceHome.id, start: at("14:00"), dur: 90, status: "PENDING" },
  ];
  for (const b of seedBookings) {
    await db.booking.upsert({
      where: { id: b.id },
      update: {},
      create: {
        id: b.id,
        clientId: b.clientId,
        locationId: b.locationId,
        startAt: b.start,
        endAt: addMinutes(b.start, b.dur),
        durationMin: b.dur,
        status: b.status,
      },
    });
  }

  console.log(`Seeded. Trainer: ${trainer.email}. Bookings on ${mondayKey}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
