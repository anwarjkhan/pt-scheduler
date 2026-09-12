import type {
  Candidate,
  CommuteFn,
  ExistingBooking,
  LatLng,
  Leg,
  SchedulingSettings,
  SlotEvaluation,
  Window,
} from "./types";
import { isWithinWindows } from "./availability";
import { coordKey } from "./geo";
import { minutesBetween } from "./time";

export const BLOCKING_STATUSES = new Set(["PENDING", "ACCEPTED"]);

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

async function leg(
  from: LatLng,
  to: LatLng,
  anchor: Leg["anchor"],
  bookingId: string | undefined,
  gapMin: number | undefined,
  buffer: number,
  commute: CommuteFn,
): Promise<Leg> {
  const same = coordKey(from) === coordKey(to);
  const c = same ? { seconds: 0, meters: 0, estimated: false } : await commute(from, to);
  const travelMin = Math.ceil(c.seconds / 60);
  const requiredMin = same ? 0 : travelMin + buffer;
  const shortfallMin = gapMin === undefined ? 0 : Math.max(0, requiredMin - gapMin);
  return { anchor, bookingId, travelMin, requiredMin, gapMin, shortfallMin, estimated: c.estimated };
}

/**
 * Evaluate whether a candidate session fits between its neighbours on the same day.
 * `bookings` should be the other bookings on that day (exclude the candidate itself when re-evaluating).
 */
export async function evaluateSlot(
  cand: Candidate,
  bookings: ExistingBooking[],
  windows: Window[],
  settings: Pick<SchedulingSettings, "home" | "bufferMinutes">,
  commute: CommuteFn,
): Promise<SlotEvaluation> {
  const blocking = bookings.filter((b) => BLOCKING_STATUSES.has(b.status));

  const clash = blocking.find((b) => overlaps(cand.start, cand.end, b.start, b.end));
  const outsideAvailability = !isWithinWindows(cand.start, cand.end, windows);

  let prev: ExistingBooking | undefined;
  let next: ExistingBooking | undefined;
  for (const b of blocking) {
    if (b.end <= cand.start && (!prev || b.end > prev.end)) prev = b;
    if (b.start >= cand.end && (!next || b.start < next.start)) next = b;
  }

  const buffer = settings.bufferMinutes;
  let before: Leg | undefined;
  let after: Leg | undefined;

  if (prev) {
    before = await leg(prev.loc, cand.loc, "booking", prev.id, minutesBetween(prev.end, cand.start), buffer, commute);
  } else if (settings.home) {
    before = await leg(settings.home, cand.loc, "home", undefined, undefined, buffer, commute);
  }

  if (next) {
    after = await leg(cand.loc, next.loc, "booking", next.id, minutesBetween(cand.end, next.start), buffer, commute);
  } else if (settings.home) {
    after = await leg(cand.loc, settings.home, "home", undefined, undefined, buffer, commute);
  }

  const warning = (before?.shortfallMin ?? 0) > 0 || (after?.shortfallMin ?? 0) > 0;
  return {
    ok: !clash && !outsideAvailability,
    warning,
    overlaps: !!clash,
    overlapWith: clash?.id,
    outsideAvailability,
    before,
    after,
  };
}
