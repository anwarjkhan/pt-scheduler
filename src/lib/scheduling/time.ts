import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import { addDays, addMinutes } from "date-fns";

/** Build a UTC Date for `date` ("yyyy-MM-dd") at `hhmm` ("HH:mm") in `tz`. */
export function zoned(date: string, hhmm: string, tz: string): Date {
  return fromZonedTime(`${date}T${hhmm}:00`, tz);
}

/** Weekday (0=Sun..6=Sat) of a yyyy-MM-dd date interpreted in tz. */
export function weekdayOf(date: string, tz: string): number {
  return toZonedTime(zoned(date, "12:00", tz), tz).getDay();
}

/** yyyy-MM-dd of an instant in tz. */
export function dateKey(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}

/** HH:mm of an instant in tz. */
export function timeKey(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, "HH:mm");
}

export function addDaysKey(date: string, n: number, tz: string): string {
  return dateKey(addDays(zoned(date, "12:00", tz), n), tz);
}

export function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60_000;
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export { addMinutes };
