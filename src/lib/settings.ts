import { db } from "@/lib/db";
import { addDaysKey, dateKey, weekdayOf, type SchedulingSettings } from "@/lib/scheduling";

export async function getTrainerSettings() {
  return db.trainerSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export function toSchedulingSettings(s: Awaited<ReturnType<typeof getTrainerSettings>>): SchedulingSettings {
  return {
    timezone: s.timezone,
    home: s.homeLat != null && s.homeLng != null ? { lat: s.homeLat, lng: s.homeLng } : null,
    bufferMinutes: s.bufferMinutes,
    slotStepMinutes: s.slotStepMinutes,
    minNoticeHours: s.minNoticeHours,
    maxRadiusMiles: s.maxRadiusMiles,
  };
}

export type AvailabilityException = {
  id: string;
  date: string;
  type: "UNAVAILABLE" | "EXTRA";
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  /** Set when this entry was generated from a RecurringException (not individually deletable). */
  recurringId?: string;
};

/** How far ahead open-ended recurring exceptions are expanded. */
const RECURRING_HORIZON_DAYS = 400;

export async function getAvailability() {
  const [rules, exceptions, recurring, settings] = await Promise.all([
    db.availabilityRule.findMany({ orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }),
    db.availabilityException.findMany({ orderBy: { date: "asc" } }),
    db.recurringException.findMany({ orderBy: { createdAt: "asc" } }),
    getTrainerSettings(),
  ]);

  const out: AvailabilityException[] = exceptions.map((e) => ({ ...e, type: e.type as "UNAVAILABLE" | "EXTRA" }));
  const tz = settings.timezone;
  const horizon = addDaysKey(dateKey(new Date(), tz), RECURRING_HORIZON_DAYS, tz);
  for (const r of recurring) {
    // Walk from the anchor date in steps of intervalWeeks until the end date / horizon.
    let date = r.startDate;
    for (let i = 0; i < 7 && weekdayOf(date, tz) !== r.weekday; i++) date = addDaysKey(date, 1, tz);
    const last = r.endDate && r.endDate < horizon ? r.endDate : horizon;
    while (date <= last) {
      out.push({ id: `rec:${r.id}:${date}`, date, type: r.type as "UNAVAILABLE" | "EXTRA", startTime: r.startTime, endTime: r.endTime, note: r.note, recurringId: r.id });
      date = addDaysKey(date, 7 * r.intervalWeeks, tz);
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return { rules, exceptions: out, recurring };
}

export async function getSchedulingSettings() {
  return toSchedulingSettings(await getTrainerSettings());
}

/** Human-readable coverage summary for client-facing copy, e.g. "Weybridge (5 mi), Esher (4 mi)". */
export async function getCoverageSummary(): Promise<{ areas: { label: string; radiusMiles: number }[]; text: string }> {
  const areas = await db.serviceArea.findMany({ orderBy: { createdAt: "asc" }, select: { label: true, radiusMiles: true } });
  if (areas.length === 0) {
    const s = await getTrainerSettings();
    return { areas, text: `within ${s.maxRadiusMiles} miles of Toby's base` };
  }
  return { areas, text: areas.map((a) => `${a.label} (${a.radiusMiles} mi)`).join(", ") };
}
