import { db } from "@/lib/db";
import { getTrainerSettings } from "@/lib/settings";
import { getPillars } from "@/lib/pillars";
import { SettingsForm } from "./settings-form";
import { ServiceAreas } from "./service-areas";
import { Pillars } from "./pillars";

export default async function SettingsPage() {
  const [s, areas, pillars, pillarCount] = await Promise.all([
    getTrainerSettings(),
    db.serviceArea.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, label: true, formatted: true, placeId: true, lat: true, lng: true, radiusMiles: true } }),
    getPillars(),
    db.pillar.count(),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Settings</h1>
      <Pillars pillars={pillars} usingFallback={pillarCount === 0} />
      <ServiceAreas areas={areas} fallbackMiles={s.maxRadiusMiles} />
      <SettingsForm
        initial={{
          timezone: s.timezone,
          home:
            s.homeAddress && s.homeLat != null && s.homeLng != null
              ? { formatted: s.homeAddress, placeId: s.homePlaceId, lat: s.homeLat, lng: s.homeLng }
              : null,
          maxRadiusMiles: s.maxRadiusMiles,
          bufferMinutes: s.bufferMinutes,
          slotStepMinutes: s.slotStepMinutes,
          minNoticeHours: s.minNoticeHours,
        }}
      />
    </div>
  );
}
