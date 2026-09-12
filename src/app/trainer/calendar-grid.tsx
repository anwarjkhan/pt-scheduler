"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import type { CalendarBooking, CalendarDay } from "@/lib/calendar-data";
import { hhmmToMinutes } from "@/lib/scheduling";
import { cn } from "@/lib/utils";
import { BookingDialog } from "./booking-dialog";
import { AlertTriangle, Car } from "lucide-react";

const PX_PER_MIN = 1.1;

const STATUS_STYLE: Record<string, string> = {
  PENDING: "border-tjm-orange bg-[#fff1e6] text-[#7a3600] dark:bg-tjm-orange/20 dark:text-orange-100",
  ACCEPTED: "border-[#166b3a] bg-tjm-confirm text-white font-semibold shadow-md",
  DECLINED: "border-dashed opacity-40",
  CANCELLED_BY_CLIENT: "border-dashed opacity-40 line-through",
  CANCELLED_BY_TRAINER: "border-dashed opacity-40 line-through",
  COMPLETED: "opacity-70",
};

/** Assign overlapping bookings to side-by-side lanes so none are hidden. */
function layoutLanes(bookings: CalendarBooking[]) {
  const sorted = [...bookings].sort((a, b) => hhmmToMinutes(a.startTime) - hhmmToMinutes(b.startTime));
  const placed: { b: CalendarBooking; lane: number; group: number }[] = [];
  let group = -1;
  let groupEnd = -1;
  const laneEnds: number[] = [];
  for (const b of sorted) {
    const s = hhmmToMinutes(b.startTime);
    const e = hhmmToMinutes(b.endTime);
    if (s >= groupEnd) {
      group++;
      laneEnds.length = 0;
    }
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = e;
    groupEnd = Math.max(groupEnd, e);
    placed.push({ b, lane, group });
  }
  const lanesPerGroup = new Map<number, number>();
  for (const p of placed) lanesPerGroup.set(p.group, Math.max(lanesPerGroup.get(p.group) ?? 0, p.lane + 1));
  return placed.map((p) => ({ ...p, lanes: lanesPerGroup.get(p.group)! }));
}

export function CalendarGrid({ days, todayKey }: { days: CalendarDay[]; todayKey: string }) {
  const [open, setOpen] = useState<CalendarBooking | null>(null);

  // Visible range: union of windows and bookings, padded to whole hours, min 07:00–20:00.
  let minM = 7 * 60;
  let maxM = 20 * 60;
  for (const d of days) {
    for (const w of d.windows) {
      minM = Math.min(minM, hhmmToMinutes(w.startTime));
      maxM = Math.max(maxM, hhmmToMinutes(w.endTime));
    }
    for (const b of d.bookings) {
      minM = Math.min(minM, hhmmToMinutes(b.startTime));
      maxM = Math.max(maxM, hhmmToMinutes(b.endTime));
    }
  }
  minM = Math.floor(minM / 60) * 60;
  maxM = Math.ceil(maxM / 60) * 60;
  const height = (maxM - minM) * PX_PER_MIN;
  const y = (hhmm: string) => (hhmmToMinutes(hhmm) - minM) * PX_PER_MIN;
  const hours = Array.from({ length: (maxM - minM) / 60 + 1 }, (_, i) => minM + i * 60);

  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="flex min-w-[640px]">
        {/* time axis */}
        <div className="relative w-14 shrink-0 border-r text-[11px] text-muted-foreground" style={{ height: height + 40 }}>
          {hours.map((m) => (
            <div key={m} className="absolute right-1" style={{ top: 40 + (m - minM) * PX_PER_MIN - 7 }}>
              {String(m / 60).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {days.map((day) => {
          const d = parseISO(day.date);
          const isToday = day.date === todayKey;
          const visible = day.bookings.filter((b) => b.status !== "DECLINED");
          return (
            <div key={day.date} className="relative min-w-0 flex-1 border-r last:border-r-0">
              <div className={cn("sticky top-0 z-10 h-10 border-b bg-tjm-charcoal px-2 py-1 text-center text-white", isToday && "bg-tjm-ink")}>
                <div className="font-heading text-[11px] uppercase text-white/60">{format(d, "EEE")}</div>
                <div className={cn("font-heading text-sm font-semibold", isToday && "text-tjm-yellow")}>{format(d, "d MMM")}</div>
              </div>
              <div className="relative bg-muted/40" style={{ height }}>
                {/* open windows */}
                {day.windows.map((w, i) => (
                  <div
                    key={i}
                    className="absolute inset-x-0 bg-background"
                    style={{ top: y(w.startTime), height: (hhmmToMinutes(w.endTime) - hhmmToMinutes(w.startTime)) * PX_PER_MIN }}
                  />
                ))}
                {/* hour lines */}
                {hours.map((m) => (
                  <div key={m} className="absolute inset-x-0 border-t border-dashed border-border/60" style={{ top: (m - minM) * PX_PER_MIN }} />
                ))}
                {/* commute segments */}
                {day.segments.map((s) => {
                  const top = y(s.startTime);
                  const h = s.gapMin * PX_PER_MIN;
                  const tight = s.shortfallMin > 0;
                  return (
                    <div
                      key={s.fromId + s.toId}
                      className={cn(
                        "absolute left-1 right-1 z-[1] flex items-center justify-center gap-1 overflow-hidden rounded-sm text-[10px] leading-none",
                        tight ? "bg-destructive/30 text-[#7a2a00] dark:text-orange-200" : "bg-tjm-charcoal/15 text-tjm-charcoal dark:bg-white/10 dark:text-white/80",
                      )}
                      style={{ top, height: Math.max(h, 2) }}
                      title={
                        s.requiredMin === 0
                          ? "Same location"
                          : `${s.travelMin} min drive + buffer = ${s.requiredMin} min needed, ${s.gapMin} min gap${tight ? ` (${s.shortfallMin} min short)` : ""}`
                      }
                    >
                      {h >= 14 && s.requiredMin > 0 && (
                        <>
                          {tight ? <AlertTriangle className="h-3 w-3" /> : <Car className="h-3 w-3" />}
                          {s.travelMin}m{tight ? ` · ${s.shortfallMin}m short` : ""}
                        </>
                      )}
                    </div>
                  );
                })}
                {/* bookings */}
                {layoutLanes(visible).map(({ b, lane, lanes }) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setOpen(b)}
                    className={cn(
                      "absolute z-[2] overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-xs shadow-sm hover:brightness-95",
                      STATUS_STYLE[b.status] ?? "",
                      b.evaluation.warning && ["PENDING", "ACCEPTED"].includes(b.status) && "ring-2 ring-destructive",
                    )}
                    style={{
                      top: y(b.startTime),
                      height: b.durationMin * PX_PER_MIN - 2,
                      left: `calc(${(lane / lanes) * 100}% + 4px)`,
                      width: `calc(${100 / lanes}% - 8px)`,
                    }}
                  >
                    <div className="flex items-center gap-1 font-medium">
                      {b.evaluation.warning && <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />}
                      <span className="truncate">{b.clientName}</span>
                    </div>
                    <div className="truncate opacity-80">
                      {b.startTime}–{b.endTime}
                    </div>
                    {b.durationMin >= 60 && <div className="truncate opacity-70">{b.locationLabel}</div>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {open && <BookingDialog booking={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
