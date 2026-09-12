import { minutesBetween } from "./time";

/** Clients may cancel only while the session is at least `minNoticeHours` away. */
export function canClientCancel(startAt: Date, minNoticeHours: number, now: Date = new Date()): boolean {
  return minutesBetween(now, startAt) >= minNoticeHours * 60;
}

/** New bookings must start at least `minNoticeHours` from now. Same rule as cancellation. */
export const meetsMinNotice = canClientCancel;
