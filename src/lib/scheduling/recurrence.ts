import { addDaysKey, weekdayOf, zoned, addMinutes } from "./time";

export type SeriesSpec = {
  weekday: number;
  startTime: string; // HH:mm
  durationMin: number;
  startDate: string; // yyyy-MM-dd (first occurrence on/after this date)
  endDate: string; // yyyy-MM-dd inclusive
};

export type Occurrence = { date: string; start: Date; end: Date };

export const MAX_SERIES_WEEKS = 12;

/** Weekly occurrences of a series in the trainer timezone. */
export function expandSeries(spec: SeriesSpec, tz: string): Occurrence[] {
  let date = spec.startDate;
  // advance to the first matching weekday
  for (let i = 0; i < 7 && weekdayOf(date, tz) !== spec.weekday; i++) date = addDaysKey(date, 1, tz);
  const out: Occurrence[] = [];
  while (date <= spec.endDate && out.length < MAX_SERIES_WEEKS) {
    const start = zoned(date, spec.startTime, tz);
    out.push({ date, start, end: addMinutes(start, spec.durationMin) });
    date = addDaysKey(date, 7, tz);
  }
  return out;
}
