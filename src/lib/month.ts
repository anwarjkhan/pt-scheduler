import { addDays, format, parseISO, startOfMonth, startOfWeek } from "date-fns";

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
