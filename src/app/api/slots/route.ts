import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCommute } from "@/lib/maps";
import { loadDayContext, sessionCoords, SESSION_TYPES } from "@/lib/bookings";
import { addDaysKey, DURATIONS, generateSlots, timeKey, type SlotEvaluation } from "@/lib/scheduling";

const query = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.coerce.number().refine((n) => (DURATIONS as readonly number[]).includes(n)),
  locationId: z.string().min(1),
  sessionType: z.enum(SESSION_TYPES).default("IN_PERSON"),
  days: z.coerce.number().int().min(1).max(7).default(1),
});

export type SlotDto = { start: string; end: string; time: string; evaluation: SlotEvaluation };
export type DaySlots = { date: string; open: boolean; slots: SlotDto[] };
export type SlotsResponse = { days: DaySlots[] };

/** Bookable start times for a client on one date, annotated with commute warnings. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Bad query" }, { status: 400 });
  const { date, duration, locationId, sessionType, days } = parsed.data;

  const loc = await db.location.findFirst({ where: { id: locationId, userId: session.user.id } });
  if (!loc) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const out: DaySlots[] = [];
  let d = date;
  for (let i = 0; i < days; i++) {
    const ctx = await loadDayContext(d);
    // Online sessions run from the trainer's home, so slots are generated
    // against the home coordinates and inherit the drive-home requirement.
    const at = sessionCoords(sessionType, loc, ctx.settings.home);
    const slots = await generateSlots(ctx.windows, duration, at, ctx.existing, ctx.settings, getCommute);
    out.push({
      date: d,
      open: ctx.windows.length > 0,
      slots: slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        time: timeKey(s.start, ctx.tz),
        evaluation: s.evaluation,
      })),
    });
    d = addDaysKey(d, 1, ctx.tz);
  }
  const body: SlotsResponse = { days: out };
  return NextResponse.json(body);
}
