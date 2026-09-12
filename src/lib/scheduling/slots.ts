import type { Candidate, CommuteFn, ExistingBooking, SchedulingSettings, SlotEvaluation, Window } from "./types";
import { evaluateSlot } from "./conflicts";
import { addMinutes } from "./time";

export type Slot = { start: Date; end: Date; evaluation: SlotEvaluation };

/**
 * Candidate start times within the day's windows at `slotStepMinutes` intervals that
 * (a) fit the duration, (b) respect minimum notice, (c) don't overlap existing bookings.
 * Each is annotated with its commute evaluation.
 */
export async function generateSlots(
  windows: Window[],
  durationMin: number,
  loc: Candidate["loc"],
  bookings: ExistingBooking[],
  settings: SchedulingSettings,
  commute: CommuteFn,
  now: Date = new Date(),
): Promise<Slot[]> {
  const earliest = addMinutes(now, settings.minNoticeHours * 60);
  const out: Slot[] = [];
  for (const w of windows) {
    for (let s = w.start; addMinutes(s, durationMin) <= w.end; s = addMinutes(s, settings.slotStepMinutes)) {
      if (s < earliest) continue;
      const cand: Candidate = { start: s, end: addMinutes(s, durationMin), loc };
      const evaluation = await evaluateSlot(cand, bookings, windows, settings, commute);
      if (evaluation.overlaps) continue;
      out.push({ start: cand.start, end: cand.end, evaluation });
    }
  }
  return out;
}
