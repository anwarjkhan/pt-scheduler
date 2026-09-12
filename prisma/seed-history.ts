/**
 * Fabricate ~3 months of past sessions for the demo clients so the trainer's client history has data.
 * Re-runnable: bookings are keyed by fixed ids. Run with: npx tsx prisma/seed-history.ts
 */
import { PrismaClient } from "@prisma/client";
import { addMinutes, subWeeks } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const db = new PrismaClient();
const TZ = "Europe/London";

type Past = { weeksAgo: number; weekday: number; time: string; dur: number; status: string; clientNote?: string; trainerNote?: string; cancelReason?: string };

/** Local date key for `weeksAgo` weeks before now, moved to the given weekday (1 = Mon). */
function dateFor(weeksAgo: number, weekday: number) {
  const base = subWeeks(new Date(), weeksAgo);
  const day = Number(formatInTimeZone(base, TZ, "i")); // 1..7
  const shifted = new Date(base.getTime() + (weekday - day) * 86_400_000);
  return formatInTimeZone(shifted, TZ, "yyyy-MM-dd");
}

async function main() {
  const alice = await db.user.findUniqueOrThrow({ where: { email: "alice@example.com" } });
  const bob = await db.user.findUniqueOrThrow({ where: { email: "bob@example.com" } });
  const aliceLoc = await db.location.findFirstOrThrow({ where: { userId: alice.id } });
  const bobLoc = await db.location.findFirstOrThrow({ where: { userId: bob.id } });

  // Alice: weekly Monday 09:00 for 12 weeks, mostly attended, a couple of cancellations, one declined change request.
  const alicePlan: Past[] = [];
  for (let w = 12; w >= 1; w--) {
    const status = w === 9 ? "CANCELLED_BY_CLIENT" : w === 4 ? "CANCELLED_BY_TRAINER" : "ACCEPTED";
    alicePlan.push({
      weeksAgo: w,
      weekday: 1,
      time: "09:00",
      dur: 60,
      status,
      clientNote: w === 12 ? "First session — knee rehab focus" : undefined,
      trainerNote: w === 12 ? "Assessed knee ROM, started band work" : w === 6 ? "Progressed to single-leg work" : undefined,
      cancelReason: status === "CANCELLED_BY_CLIENT" ? "Work trip" : status === "CANCELLED_BY_TRAINER" ? "Toby unwell — rebooked next week" : undefined,
    });
  }
  alicePlan.push({ weeksAgo: 7, weekday: 4, time: "18:00", dur: 30, status: "DECLINED", trainerNote: "Fully booked that evening" });
  alicePlan.push({ weeksAgo: 3, weekday: 3, time: "07:30", dur: 90, status: "ACCEPTED", clientNote: "Extra session before half marathon" });

  // Bob: fortnightly Wednesday 10:15, started 8 weeks ago, one no-show style cancellation.
  const bobPlan: Past[] = [];
  for (let w = 8; w >= 2; w -= 2) {
    bobPlan.push({
      weeksAgo: w,
      weekday: 3,
      time: "10:15",
      dur: 60,
      status: w === 4 ? "CANCELLED_BY_CLIENT" : "ACCEPTED",
      trainerNote: w === 8 ? "Lower back assessment; hip mobility programme" : undefined,
      cancelReason: w === 4 ? "Forgot — apologies" : undefined,
    });
  }

  const plans: [typeof alice, typeof aliceLoc, Past[], string][] = [
    [alice, aliceLoc, alicePlan, "alice"],
    [bob, bobLoc, bobPlan, "bob"],
  ];

  let n = 0;
  for (const [user, loc, plan, tag] of plans) {
    for (const [i, p] of plan.entries()) {
      const date = dateFor(p.weeksAgo, p.weekday);
      const startAt = fromZonedTime(`${date}T${p.time}:00`, TZ);
      await db.booking.upsert({
        where: { id: `hist-${tag}-${i}` },
        update: {},
        create: {
          id: `hist-${tag}-${i}`,
          clientId: user.id,
          locationId: loc.id,
          startAt,
          endAt: addMinutes(startAt, p.dur),
          durationMin: p.dur,
          status: p.status,
          clientNote: p.clientNote ?? null,
          trainerNote: p.trainerNote ?? null,
          cancelReason: p.cancelReason ?? null,
          cancelledAt: p.status.startsWith("CANCELLED") ? addMinutes(startAt, -36 * 60) : null,
          createdAt: addMinutes(startAt, -7 * 24 * 60),
        },
      });
      n++;
    }
  }
  console.log(`Seeded ${n} historical bookings for Alice and Bob.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
