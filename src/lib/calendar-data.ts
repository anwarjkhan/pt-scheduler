import { evaluateExistingBooking, loadDayContext, type BookingWithRefs } from "@/lib/bookings";
import { getCommute } from "@/lib/maps";
import { BLOCKING_STATUSES, coordKey, minutesBetween, timeKey, type Leg, type SlotEvaluation } from "@/lib/scheduling";
import { getSchedulingSettings } from "@/lib/settings";

export type CalendarBooking = {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  clientName: string;
  clientEmail: string;
  locationLabel: string;
  /** Enough to link the address to Google Maps. */
  location: { formatted: string; placeId: string | null; lat: number; lng: number };
  clientNote: string | null;
  seriesId: string | null;
  evaluation: SlotEvaluation;
};

/** Travel between two consecutive blocking bookings, as drawn on the calendar. */
export type CommuteSegment = {
  fromId: string;
  toId: string;
  startAt: string; // prev.end
  endAt: string; // next.start
  startTime: string; // HH:mm in trainer tz
  gapMin: number;
  travelMin: number;
  requiredMin: number;
  shortfallMin: number;
  estimated: boolean;
};

export type CalendarDay = {
  date: string;
  windows: { start: string; end: string; startTime: string; endTime: string }[];
  /** UNAVAILABLE exceptions on this date (whole-day ones span 00:00–24:00). Drawn darker than plain outside-hours. */
  blocks: { startTime: string; endTime: string; note: string | null }[];
  bookings: CalendarBooking[];
  segments: CommuteSegment[];
  /** Home → first and last → home legs, for the day summary. */
  homeLegs: { first?: Leg; last?: Leg };
};

function label(b: BookingWithRefs) {
  return b.location.label ? `${b.location.label} · ${b.location.formatted}` : b.location.formatted;
}

export async function buildCalendarDay(date: string): Promise<CalendarDay> {
  const ctx = await loadDayContext(date);
  const tz = ctx.tz;

  const bookings: CalendarBooking[] = [];
  for (const b of ctx.bookings) {
    const evaluation = await evaluateExistingBooking(b, ctx);
    bookings.push({
      id: b.id,
      status: b.status,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      startTime: timeKey(b.startAt, tz),
      endTime: timeKey(b.endAt, tz),
      durationMin: b.durationMin,
      clientName: b.client.name ?? b.client.email,
      clientEmail: b.client.email,
      locationLabel: label(b),
      location: { formatted: b.location.formatted, placeId: b.location.placeId, lat: b.location.lat, lng: b.location.lng },
      clientNote: b.clientNote,
      seriesId: b.seriesId,
      evaluation,
    });
  }

  // Segments between consecutive blocking bookings in time order.
  const blocking = ctx.bookings.filter((b) => BLOCKING_STATUSES.has(b.status)).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const segments: CommuteSegment[] = [];
  for (let i = 0; i + 1 < blocking.length; i++) {
    const a = blocking[i];
    const b = blocking[i + 1];
    const same = coordKey(a.location) === coordKey(b.location);
    const c = same ? { seconds: 0, meters: 0, estimated: false } : await getCommute(a.location, b.location);
    const travelMin = Math.ceil(c.seconds / 60);
    const requiredMin = same ? 0 : travelMin + ctx.settings.bufferMinutes;
    const gapMin = minutesBetween(a.endAt, b.startAt);
    segments.push({
      fromId: a.id,
      toId: b.id,
      startAt: a.endAt.toISOString(),
      endAt: b.startAt.toISOString(),
      startTime: timeKey(a.endAt, tz),
      gapMin,
      travelMin,
      requiredMin,
      shortfallMin: Math.max(0, requiredMin - gapMin),
      estimated: c.estimated,
    });
  }

  const first = bookings.find((b) => b.id === blocking[0]?.id);
  const last = bookings.find((b) => b.id === blocking[blocking.length - 1]?.id);

  return {
    date,
    windows: ctx.windows.map((w) => ({ start: w.start.toISOString(), end: w.end.toISOString(), startTime: timeKey(w.start, tz), endTime: timeKey(w.end, tz) })),
    blocks: ctx.exceptions
      .filter((e) => e.type === "UNAVAILABLE")
      .map((e) => ({ startTime: e.startTime ?? "00:00", endTime: e.endTime ?? "24:00", note: e.note })),
    bookings,
    segments,
    homeLegs: { first: first?.evaluation.before, last: last?.evaluation.after },
  };
}

export async function buildCalendarDays(dates: string[]) {
  const settings = await getSchedulingSettings();
  const days: CalendarDay[] = [];
  for (const d of dates) days.push(await buildCalendarDay(d));
  return { settings, days };
}
