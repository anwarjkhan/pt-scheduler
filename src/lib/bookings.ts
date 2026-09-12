import { db } from "@/lib/db";
import { getCommute } from "@/lib/maps";
import { getAvailability, getTrainerSettings, toSchedulingSettings } from "@/lib/settings";
import {
  addDaysKey,
  evaluateSlot,
  getWindowsForDate,
  METERS_PER_MILE,
  rankAreas,
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

export type AreaCheck =
  | { ok: true; areaId: string | null; label: string; miles: number; estimated: boolean }
  | { ok: false; nearest: { label: string; miles: number; radiusMiles: number } | null; estimated: boolean };

/**
 * Is a client address bookable? Inside any ServiceArea (driving distance ≤ its radius), or —
 * when no areas are defined — within `maxRadiusMiles` of the home base.
 */
export async function checkServiceArea(loc: LatLng): Promise<AreaCheck> {
  const areas = await db.serviceArea.findMany();

  if (areas.length === 0) {
    const s = toSchedulingSettings(await getTrainerSettings());
    if (!s.home) return { ok: true, areaId: null, label: "anywhere", miles: 0, estimated: false }; // nothing configured yet
    const c = await getCommute(s.home, loc);
    const miles = c.meters / METERS_PER_MILE;
    return miles <= s.maxRadiusMiles
      ? { ok: true, areaId: null, label: "home", miles, estimated: c.estimated }
      : { ok: false, nearest: { label: "Toby's base", miles, radiusMiles: s.maxRadiusMiles }, estimated: c.estimated };
  }

  const ranked = rankAreas(loc, areas);
  let nearest: { label: string; miles: number; radiusMiles: number } | null = null;
  let estimated = false;
  for (const r of ranked) {
    // Straight-line already too far → skip the Distance Matrix call.
    if (!r.possible) {
      if (!nearest) nearest = { label: r.area.label, miles: r.straightMiles, radiusMiles: r.area.radiusMiles };
      continue;
    }
    const c = await getCommute(r.area, loc);
    const miles = c.meters / METERS_PER_MILE;
    estimated ||= c.estimated;
    if (miles <= r.area.radiusMiles) return { ok: true, areaId: r.area.id, label: r.area.label, miles, estimated };
    if (!nearest || miles < nearest.miles) nearest = { label: r.area.label, miles, radiusMiles: r.area.radiusMiles };
  }
  return { ok: false, nearest, estimated };
}
