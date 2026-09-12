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
