import type { Exception, Rule, Window } from "./types";
import { weekdayOf, zoned } from "./time";

function mergeWindows(ws: Window[]): Window[] {
  const sorted = [...ws].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Window[] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w.start <= last.end) {
      if (w.end > last.end) last.end = w.end;
    } else {
      out.push({ start: new Date(w.start), end: new Date(w.end) });
    }
  }
  return out.filter((w) => w.end > w.start);
}

function subtract(ws: Window[], cut: Window): Window[] {
  const out: Window[] = [];
  for (const w of ws) {
    if (cut.end <= w.start || cut.start >= w.end) {
      out.push(w);
      continue;
    }
    if (cut.start > w.start) out.push({ start: w.start, end: cut.start });
    if (cut.end < w.end) out.push({ start: cut.end, end: w.end });
  }
  return out;
}

/**
 * Open windows for a calendar date in the trainer's timezone.
 * Weekly rules form the base; exceptions for that date subtract (UNAVAILABLE) or add (EXTRA).
 */
export function getWindowsForDate(
  date: string,
  tz: string,
  rules: Rule[],
  exceptions: Exception[],
): Window[] {
  const wd = weekdayOf(date, tz);
  let windows: Window[] = rules
    .filter((r) => r.weekday === wd)
    .map((r) => ({ start: zoned(date, r.startTime, tz), end: zoned(date, r.endTime, tz) }));
  windows = mergeWindows(windows);

  const todays = exceptions.filter((e) => e.date === date);
  for (const e of todays.filter((e) => e.type === "UNAVAILABLE")) {
    if (!e.startTime || !e.endTime) return []; // whole day off
    windows = subtract(windows, { start: zoned(date, e.startTime, tz), end: zoned(date, e.endTime, tz) });
  }
  for (const e of todays.filter((e) => e.type === "EXTRA")) {
    if (e.startTime && e.endTime) {
      windows.push({ start: zoned(date, e.startTime, tz), end: zoned(date, e.endTime, tz) });
    }
  }
  return mergeWindows(windows);
}

export function isWithinWindows(start: Date, end: Date, windows: Window[]): boolean {
  return windows.some((w) => start >= w.start && end <= w.end);
}
