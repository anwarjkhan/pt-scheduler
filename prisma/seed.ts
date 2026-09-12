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
    update: {},
    create: {
      id: "singleton",
      timezone: TZ,
      homeAddress: "1 Trainer Way, London",
      homeLat: 51.5074,
      homeLng: -0.1278,
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

  const aliceHome = await db.location.upsert({
    where: { id: "seed-loc-alice" },
    update: {},
    create: { id: "seed-loc-alice", userId: alice.id, label: "Home", formatted: "10 Camden High St, London", lat: 51.539, lng: -0.1426 },
  });
  const bobGym = await db.location.upsert({
    where: { id: "seed-loc-bob" },
    update: {},
    create: { id: "seed-loc-bob", userId: bob.id, label: "Park", formatted: "Greenwich Park, London", lat: 51.4769, lng: 0.0005 },
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
