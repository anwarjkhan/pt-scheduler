"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { createBooking, createSeries, previewSeries, type OccurrencePreview } from "@/app/app/actions";
import type { DaySlots, SlotDto, SlotsResponse } from "@/app/api/slots/route";
import { LocationForm } from "@/components/location-form";
import { CommuteSummary } from "@/components/commute-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DURATIONS, MAX_SERIES_WEEKS } from "@/lib/scheduling";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Video } from "lucide-react";
import { ClientMonthGrid } from "./month-grid";

type Location = { id: string; label: string | null; formatted: string };

export function BookingWizard({ locations, todayKey, coverage }: { locations: Location[]; todayKey: string; coverage?: string }) {
  const router = useRouter();
  const [locationId, setLocationId] = useState<string>(locations[0]?.id ?? "");
  const [duration, setDuration] = useState<number>(60);
  const [sessionType, setSessionType] = useState<"IN_PERSON" | "ONLINE">("IN_PERSON");
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = parseISO(todayKey);
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    // On a weekend the current Mon–Sun week is all in the past; open on next week instead.
    return today.getDay() === 0 || today.getDay() === 6 ? addDays(monday, 7) : monday;
  });
  const [view, setView] = useState<"week" | "month">("week");
  const [result, setResult] = useState<{ key: string; days: DaySlots[] } | null>(null);
  const [selected, setSelected] = useState<{ day: DaySlots; slot: SlotDto } | null>(null);

  const weekKey = format(weekStart, "yyyy-MM-dd");
  const queryKey = `${weekKey}|${duration}|${locationId}|${sessionType}`;
  const days = result?.days ?? null;
  const loading = !!locationId && result?.key !== queryKey;

  useEffect(() => {
    if (!locationId || view !== "week") return;
    let cancelled = false;
    fetch(`/api/slots?date=${weekKey}&days=7&duration=${duration}&locationId=${locationId}&sessionType=${sessionType}`)
      .then((r) => r.json())
      .then((j: SlotsResponse) => {
        if (!cancelled) setResult({ key: queryKey, days: j.days });
      });
    return () => {
      cancelled = true;
    };
  }, [weekKey, duration, locationId, sessionType, queryKey, view]);

  const onCreated = useCallback(
    (id: string) => {
      setLocationId(id);
      router.refresh();
    },
    [router],
  );

  if (locations.length === 0) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Where will we train?</CardTitle>
          <CardDescription>Add a location first. Toby covers: {coverage ?? "his service areas"}.</CardDescription>
        </CardHeader>
        <CardContent>
          <LocationForm onCreated={onCreated} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label>Session</Label>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant={sessionType === "IN_PERSON" ? "default" : "outline"} onClick={() => setSessionType("IN_PERSON")}>
              One-to-one
            </Button>
            <Button type="button" size="sm" variant={sessionType === "ONLINE" ? "default" : "outline"} onClick={() => setSessionType("ONLINE")}>
              <Video className="mr-1 h-4 w-4" /> Online
            </Button>
          </div>
        </div>
        {sessionType === "IN_PERSON" ? (
          <div className="space-y-1">
            <Label>Location</Label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="h-9 min-w-56 rounded-md border bg-transparent px-3 text-sm"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label ? `${l.label} — ` : ""}
                  {l.formatted}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="max-w-xs text-sm text-muted-foreground">
            Toby runs online sessions from home, so the times below allow for his journey back from any session before yours.
          </p>
        )}
        <div className="space-y-1">
          <Label>Duration</Label>
          <div className="flex gap-1">
            {DURATIONS.map((d) => (
              <Button key={d} type="button" size="sm" variant={duration === d ? "default" : "outline"} onClick={() => setDuration(d)}>
                {d} min
              </Button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="mr-2 flex gap-1">
            <Button type="button" size="sm" variant={view === "week" ? "default" : "outline"} onClick={() => setView("week")}>
              Week
            </Button>
            <Button type="button" size="sm" variant={view === "month" ? "default" : "outline"} onClick={() => setView("month")}>
              Month
            </Button>
          </div>
          {view === "week" && (
            <>
              <Button type="button" variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-44 text-center text-sm font-medium">
                {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
              </span>
              <Button type="button" variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {view === "month" ? (
        <ClientMonthGrid
          anchor={weekKey}
          duration={duration}
          todayKey={todayKey}
          onAnchorChange={(d) => setWeekStart(startOfWeek(parseISO(d), { weekStartsOn: 1 }))}
          onPickDay={(d) => {
            setWeekStart(startOfWeek(parseISO(d), { weekStartsOn: 1 }));
            setView("week");
          }}
        />
      ) : (
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {(days ?? Array.from({ length: 7 }, (_, i) => ({ date: format(addDays(weekStart, i), "yyyy-MM-dd"), open: false, slots: [] }))).map(
            (day) => {
              const d = parseISO(day.date);
              const past = day.date < todayKey;
              return (
                <div key={day.date} className={cn("overflow-hidden rounded-md border bg-card", past && "opacity-50")}>
                  <div className="mb-2 bg-tjm-charcoal py-1.5 text-center text-white">
                    <div className="font-heading text-[11px] uppercase text-white/60">{format(d, "EEE")}</div>
                    <div className="font-heading text-lg font-semibold">{format(d, "d")}</div>
                  </div>
                  <div className="px-2 pb-2">
                  {past ? (
                    <p className="text-center text-xs text-muted-foreground">Past</p>
                  ) : !day.open ? (
                    <p className="text-center text-xs text-muted-foreground">Unavailable</p>
                  ) : day.slots.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground">No times left</p>
                  ) : (
                    <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                      {day.slots.map((s) => (
                        <button
                          key={s.start}
                          type="button"
                          onClick={() => setSelected({ day, slot: s })}
                          className={cn(
                            "flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-accent",
                            s.evaluation.warning && "border-tjm-orange bg-[#fff1e6] text-[#7a3600] dark:bg-tjm-orange/20 dark:text-orange-100",
                          )}
                          title={s.evaluation.warning ? "Tight commute — will be flagged for your trainer" : undefined}
                        >
                          {s.time}
                          {s.evaluation.warning && <AlertTriangle className="h-3 w-3" />}
                        </button>
                      ))}
                    </div>
                  )}
                  </div>
                </div>
              );
            },
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          <AlertTriangle className="mr-1 inline h-3 w-3 text-tjm-orange" />
          Orange slots leave your trainer little travel time from the previous session — you can still request them, but they may be declined.
        </p>
      </div>
      )}

      {selected && (
        <ConfirmDialog
          key={selected.slot.start}
          locationId={locationId}
          sessionType={sessionType}
          duration={duration}
          day={selected.day}
          slot={selected.slot}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function ConfirmDialog({
  locationId,
  sessionType,
  duration,
  day,
  slot,
  onClose,
}: {
  locationId: string;
  sessionType: "IN_PERSON" | "ONLINE";
  duration: number;
  day: DaySlots;
  slot: SlotDto;
  onClose: () => void;
}) {
  const router = useRouter();
  const [recurring, setRecurring] = useState(false);
  const [weeks, setWeeks] = useState(4);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<OccurrencePreview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const seriesArgs = useMemo(
    () => ({ locationId, sessionType, firstStart: slot.start, duration, weeks, note }),
    [locationId, sessionType, slot.start, duration, weeks, note],
  );

  useEffect(() => {
    if (!recurring) return;
    let cancelled = false;
    previewSeries(seriesArgs).then((r) => {
      if (cancelled) return;
      if (r.error) setError(r.error);
      else setPreview(r.occurrences ?? null);
    });
    return () => {
      cancelled = true;
    };
    // note isn't needed for preview
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurring, weeks, slot.start, duration, locationId, sessionType]);

  const submit = () =>
    start(async () => {
      setError(null);
      const r = recurring ? await createSeries(seriesArgs) : await createBooking({ locationId, sessionType, start: slot.start, duration, note });
      if (r.error && !r.ok) return setError(r.error);
      router.push("/app?requested=1");
    });

  const d = parseISO(day.date);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {format(d, "EEEE d MMMM")} at {slot.time}
          </DialogTitle>
          <DialogDescription>{duration}-minute session · request goes to your trainer for approval</DialogDescription>
        </DialogHeader>

        <CommuteSummary evaluation={slot.evaluation} />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => {
              setRecurring(e.target.checked);
              if (!e.target.checked) setPreview(null);
            }}
          />
          Repeat weekly
        </label>
        {recurring && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span>for</span>
              <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="h-8 rounded-md border bg-transparent px-2">
                {Array.from({ length: MAX_SERIES_WEEKS - 1 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {n} weeks
                  </option>
                ))}
              </select>
            </div>
            {preview ? (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
                {preview.map((o) => (
                  <li key={o.date} className="flex items-center justify-between gap-2">
                    <span>{format(parseISO(o.date), "EEE d MMM")}</span>
                    <Badge
                      variant={o.status === "ok" ? "secondary" : o.status === "warning" ? "outline" : "destructive"}
                      className={cn(o.status === "warning" && "border-tjm-orange text-[#b45200]")}
                    >
                      {o.status === "ok" ? "Available" : o.status === "warning" ? "Tight commute" : o.status === "taken" ? "Taken — skipped" : "Trainer off — skipped"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Checking each week…</p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="note">Note for your trainer (optional)</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Gate code, parking, goals…" />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Back
          </Button>
          <Button onClick={submit} disabled={pending || (recurring && !preview)}>
            {pending ? "Requesting…" : recurring ? "Request series" : "Request session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
