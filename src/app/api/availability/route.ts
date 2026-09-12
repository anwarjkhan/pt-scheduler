import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { loadDayContext } from "@/lib/bookings";
import { generateSlots, timeKey, type CommuteFn } from "@/lib/scheduling";
import { monthGrid } from "@/lib/month";

const query = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.coerce.number().default(60),
});

export type MonthDay = {
  date: string;
  open: boolean;
  /** Free start times ignoring commute (cheap), so the month view can show "12 times" per day. */
  free: number;
  mine: { time: string; status: string }[];
};
export type MonthResponse = { monthKey: string; days: MonthDay[] };

/** Zero-cost commute so month summaries don't hit the Distance Matrix; the week view does the real check. */
const noCommute: CommuteFn = async () => ({ seconds: 0, meters: 0, estimated: true });

/** Month overview for a client: which days have free times, and their own bookings. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Bad query" }, { status: 400 });

  const { monthKey, dates } = monthGrid(parsed.data.date);
  const days: MonthDay[] = [];
  for (const date of dates) {
    const ctx = await loadDayContext(date);
    const slots = ctx.windows.length
      ? await generateSlots(ctx.windows, parsed.data.duration, { lat: 0, lng: 0 }, ctx.existing, ctx.settings, noCommute)
      : [];
    days.push({
      date,
      open: ctx.windows.length > 0,
      free: slots.length,
      mine: ctx.bookings
        .filter((b) => b.clientId === session.user.id && ["PENDING", "ACCEPTED"].includes(b.status))
        .map((b) => ({ time: timeKey(b.startAt, ctx.tz), status: b.status })),
    });
  }
  return NextResponse.json({ monthKey, days } satisfies MonthResponse);
}
