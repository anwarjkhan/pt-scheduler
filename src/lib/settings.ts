import { db } from "@/lib/db";
import type { SchedulingSettings } from "@/lib/scheduling";

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

export async function getAvailability() {
  const [rules, exceptions] = await Promise.all([
    db.availabilityRule.findMany({ orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }),
    db.availabilityException.findMany({ orderBy: { date: "asc" } }),
  ]);
  return {
    rules,
    exceptions: exceptions.map((e) => ({ ...e, type: e.type as "UNAVAILABLE" | "EXTRA" })),
  };
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
