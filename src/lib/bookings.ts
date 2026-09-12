import { db } from "@/lib/db";
import { getCommute } from "@/lib/maps";
import { getAvailability, getTrainerSettings, toSchedulingSettings } from "@/lib/settings";
import {
  addDaysKey,
  evaluateSlot,
  getWindowsForDate,
  METERS_PER_MILE,
  zoned,
  type ExistingBooking,
  type LatLng,
  type SlotEvaluation,
} from "@/lib/scheduling";

export const bookingInclude = {
  client: { select: { id: true, name: true, email: true, phone: true } },
  location: true,
  series: { select: { id: true, status: true, endDate: true } },
} as const;

export type BookingWithRefs = Awaited<ReturnType<typeof loadBookingsBetween>>[number];

export async function loadBookingsBetween(start: Date, end: Date) {
  return db.booking.findMany({
    where: { startAt: { gte: start, lt: end } },
    include: bookingInclude,
    orderBy: { startAt: "asc" },
  });
}

export function toExisting(b: { id: string; startAt: Date; endAt: Date; status: string; location: LatLng }): ExistingBooking {
  return { id: b.id, start: b.startAt, end: b.endAt, status: b.status, loc: { lat: b.location.lat, lng: b.location.lng } };
}

/** Everything needed to evaluate slots on one calendar date. */
export async function loadDayContext(date: string) {
  const [settingsRow, { rules, exceptions }] = await Promise.all([getTrainerSettings(), getAvailability()]);
  const settings = toSchedulingSettings(settingsRow);
  const tz = settings.timezone;
  const dayStart = zoned(date, "00:00", tz);
  const dayEnd = zoned(addDaysKey(date, 1, tz), "00:00", tz);
  const bookings = await loadBookingsBetween(dayStart, dayEnd);
  const windows = getWindowsForDate(date, tz, rules, exceptions);
  return { settings, settingsRow, tz, windows, bookings, existing: bookings.map(toExisting) };
}

/** Re-evaluate a stored booking against its current neighbours (excluding itself). */
export async function evaluateExistingBooking(
  b: BookingWithRefs,
  ctx: Awaited<ReturnType<typeof loadDayContext>>,
): Promise<SlotEvaluation> {
  const others = ctx.existing.filter((x) => x.id !== b.id);
  return evaluateSlot(
    { start: b.startAt, end: b.endAt, loc: { lat: b.location.lat, lng: b.location.lng } },
    others,
    ctx.windows,
    ctx.settings,
    getCommute,
  );
}

/** Driving distance from home base in miles, or null when no home is configured. */
export async function milesFromHome(loc: LatLng): Promise<{ miles: number; estimated: boolean } | null> {
  const s = toSchedulingSettings(await getTrainerSettings());
  if (!s.home) return null;
  const c = await getCommute(s.home, loc);
  return { miles: c.meters / METERS_PER_MILE, estimated: c.estimated };
}
