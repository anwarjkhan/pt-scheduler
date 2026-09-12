import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getSchedulingSettings } from "@/lib/settings";
import { dateKey } from "@/lib/scheduling";
import { BookingWizard } from "./booking-wizard";

export default async function BookPage() {
  const user = await requireUser();
  const [locations, settings] = await Promise.all([
    db.location.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, label: true, formatted: true } }),
    getSchedulingSettings(),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Book a session</h1>
        <p className="text-sm text-muted-foreground">
          Pick a location and duration, then choose a start time. Sessions need {settings.minNoticeHours} hours&apos; notice.
        </p>
      </div>
      <BookingWizard locations={locations} todayKey={dateKey(new Date(), settings.timezone)} />
    </div>
  );
}
