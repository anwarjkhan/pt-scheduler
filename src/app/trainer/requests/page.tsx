import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { bookingInclude, evaluateExistingBooking, loadDayContext } from "@/lib/bookings";
import { getSchedulingSettings } from "@/lib/settings";
import { dateKey, type SlotEvaluation } from "@/lib/scheduling";
import { CommuteSummary } from "@/components/commute-summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SeriesActions, SingleActions } from "./request-actions";
import { MapPin, Repeat, StickyNote } from "lucide-react";

export default async function RequestsPage() {
  const settings = await getSchedulingSettings();
  const tz = settings.timezone;
  const pending = await db.booking.findMany({
    where: { status: "PENDING", startAt: { gte: new Date() } },
    include: bookingInclude,
    orderBy: { startAt: "asc" },
  });

  // Evaluate each against current neighbours (cache day contexts).
  const ctxCache = new Map<string, Awaited<ReturnType<typeof loadDayContext>>>();
  const evals = new Map<string, SlotEvaluation>();
  for (const b of pending) {
    const d = dateKey(b.startAt, tz);
    let ctx = ctxCache.get(d);
    if (!ctx) {
      ctx = await loadDayContext(d);
      ctxCache.set(d, ctx);
    }
    evals.set(b.id, await evaluateExistingBooking(b, ctx));
  }

  const singles = pending.filter((b) => !b.seriesId);
  const seriesMap = new Map<string, typeof pending>();
  for (const b of pending.filter((b) => b.seriesId)) {
    const arr = seriesMap.get(b.seriesId!) ?? [];
    arr.push(b);
    seriesMap.set(b.seriesId!, arr);
  }

  const when = (d: Date) => formatInTimeZone(d, tz, "EEE d MMM, HH:mm");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Requests</h1>
      {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending requests.</p>}

      {[...seriesMap.entries()].map(([seriesId, occ]) => {
        const first = occ[0];
        return (
          <Card key={seriesId} className="border-tjm-orange/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Repeat className="h-4 w-4" /> Weekly series · {first.client.name ?? first.client.email}
              </CardTitle>
              <CardDescription>
                {formatInTimeZone(first.startAt, tz, "EEEE")}s at {formatInTimeZone(first.startAt, tz, "HH:mm")} · {first.durationMin} min · {occ.length} session
                {occ.length === 1 ? "" : "s"} from {formatInTimeZone(first.startAt, tz, "d MMM")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {first.location.label ? `${first.location.label} · ` : ""}
                {first.location.formatted}
              </div>
              {first.clientNote && (
                <div className="flex items-start gap-2 text-sm">
                  <StickyNote className="mt-0.5 h-4 w-4 text-muted-foreground" /> {first.clientNote}
                </div>
              )}
              <SeriesActions
                seriesId={seriesId}
                occurrences={occ.map((b) => ({ id: b.id, label: when(b.startAt), warning: evals.get(b.id)!.warning }))}
              />
            </CardContent>
          </Card>
        );
      })}

      {singles.map((b) => {
        const ev = evals.get(b.id)!;
        return (
          <Card key={b.id} className={ev.warning ? "border-destructive/60" : "border-tjm-orange/60"}>
            <CardHeader>
              <CardTitle>
                {when(b.startAt)} · {b.durationMin} min · {b.client.name ?? b.client.email}
              </CardTitle>
              <CardDescription className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {b.location.label ? `${b.location.label} · ` : ""}
                {b.location.formatted}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {b.clientNote && (
                <div className="flex items-start gap-2 text-sm">
                  <StickyNote className="mt-0.5 h-4 w-4 text-muted-foreground" /> {b.clientNote}
                </div>
              )}
              <CommuteSummary evaluation={ev} />
              <SingleActions id={b.id} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
