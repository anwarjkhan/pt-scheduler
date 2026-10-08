import { addDays, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { dateKey, zoned } from "@/lib/scheduling";

/** The 6×7 Monday-first grid of yyyy-MM-dd keys covering the month of `anchor` (yyyy-MM-dd). */
export function monthGrid(anchor: string): { monthKey: string; dates: string[] } {
  const first = startOfMonth(parseISO(anchor));
  const gridStart = startOfWeek(first, { weekStartsOn: 1 });
  return {
    monthKey: format(first, "yyyy-MM"),
    dates: Array.from({ length: 42 }, (_, i) => format(addDays(gridStart, i), "yyyy-MM-dd")),
  };
}

export const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The calendar month containing `at`, as a half-open [from, to) instant range
 * in the given timezone.
 *
 * Resolved through `zoned` rather than by arithmetic on UTC dates so a month
 * that straddles a DST change still starts and ends at local midnight — the
 * same care the scheduling code takes, applied to statements.
 */
export function monthRange(at: Date, tz: string): { from: Date; to: Date; label: string; monthKey: string } {
  const key = dateKey(at, tz); // yyyy-MM-dd in the trainer's timezone
  const [y, m] = key.split("-").map(Number);
  const firstOfThis = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const firstOfNext = `${String(nextY).padStart(4, "0")}-${String(nextM).padStart(2, "0")}-01`;
  return {
    from: zoned(firstOfThis, "00:00", tz),
    to: zoned(firstOfNext, "00:00", tz),
    label: format(parseISO(firstOfThis), "MMMM yyyy"),
    monthKey: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`,
  };
}
