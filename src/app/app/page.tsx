import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getSchedulingSettings } from "@/lib/settings";
import { canClientCancel } from "@/lib/scheduling";
import { canJoin } from "@/lib/video-window";
import { StatusBadge } from "@/components/status-badge";
import { CancelButton } from "./cancel-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Repeat, Video } from "lucide-react";
import { MapLink } from "@/components/map-link";

export default async function ClientHome({ searchParams }: PageProps<"/app">) {
  const user = await requireUser();
  const { requested } = await searchParams;
  const settings = await getSchedulingSettings();
  const tz = settings.timezone;
  const now = new Date();

  const bookings = await db.booking.findMany({
    where: { clientId: user.id },
    include: { location: true, series: { select: { id: true } } },
    orderBy: { startAt: "asc" },
  });
  const upcoming = bookings.filter((b) => b.endAt >= now && !["DECLINED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_TRAINER"].includes(b.status));
  const history = bookings.filter((b) => !upcoming.includes(b)).reverse().slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">My sessions</h1>
        <Button nativeButton={false} render={<Link href="/?cal=1" />}>Book a session</Button>
      </div>

      {requested && (
        <Alert>
          <AlertDescription>Request sent — you&apos;ll see it change to Confirmed once your trainer accepts.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing booked yet.</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-40">
                    <div className="font-medium">{formatInTimeZone(b.startAt, tz, "EEE d MMM")}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatInTimeZone(b.startAt, tz, "HH:mm")}–{formatInTimeZone(b.endAt, tz, "HH:mm")} · {b.durationMin} min
                    </div>
                  </div>
                  <div className="flex flex-1 items-center gap-1 text-sm text-muted-foreground">
                    {b.sessionType === "ONLINE" ? (
                      <>
                        <Video className="h-4 w-4" aria-hidden />
                        <span className="truncate">Online session</span>
                      </>
                    ) : (
                      <>
                        <MapLink target={b.location} className="h-4 w-4" label={b.location.label ?? b.location.formatted} />
                        <span className="truncate">{b.location.label ?? b.location.formatted}</span>
                      </>
                    )}
                    {b.seriesId && <Repeat className="ml-1 h-3.5 w-3.5" aria-label="Weekly series" />}
                  </div>
                  <StatusBadge status={b.status} />
                  {canJoin(b, now) && (
                    <Button nativeButton={false} size="sm" render={<Link href={`/app/session/${b.id}`} />}>
                      <Video className="h-4 w-4" /> Join
                    </Button>
                  )}
                  {b.status === "CANCELLED_BY_TRAINER" && b.cancelReason && (
                    <span className="text-xs text-muted-foreground">{b.cancelReason}</span>
                  )}
                  <CancelButton
                    bookingId={b.id}
                    inSeries={!!b.seriesId}
                    allowed={canClientCancel(b.startAt, settings.minNoticeHours, now)}
                    minNoticeHours={settings.minNoticeHours}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {history.map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="min-w-40">{formatInTimeZone(b.startAt, tz, "EEE d MMM, HH:mm")}</span>
                  <span className="flex-1 truncate text-muted-foreground">
                    {b.sessionType === "ONLINE" ? "Online session" : (b.location.label ?? b.location.formatted)}
                  </span>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
