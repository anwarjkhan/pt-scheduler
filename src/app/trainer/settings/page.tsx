import { getTrainerSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const s = await getTrainerSettings();
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Settings</h1>
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
