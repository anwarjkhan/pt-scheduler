"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import type { CalendarBooking, CalendarDay } from "@/lib/calendar-data";
import { hhmmToMinutes } from "@/lib/scheduling";
import { cn } from "@/lib/utils";
import { BookingDialog } from "./booking-dialog";
import { rescheduleBooking } from "./actions";
import { useDragReschedule } from "./use-drag-reschedule";
import { AlertTriangle, Car } from "lucide-react";

/** Sessions that can be moved. Past and closed bookings stay put. */
const MOVABLE = new Set(["PENDING", "ACCEPTED"]);

function minutesToHHMM(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const PX_PER_MIN = 1.1;

const STATUS_STYLE: Record<string, string> = {
  PENDING: "border-tjm-orange bg-[#fff1e6] text-[#7a3600] dark:bg-tjm-orange/20 dark:text-orange-100",
  ACCEPTED: "border-[#166b3a] bg-tjm-confirm text-white font-semibold shadow-md",
  DECLINED: "border-dashed opacity-40",
  CANCELLED_BY_CLIENT: "border-dashed border-destructive/60 bg-destructive/10 text-destructive line-through",
  CANCELLED_BY_TRAINER: "border-dashed border-destructive/60 bg-destructive/10 text-destructive line-through",
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
  const router = useRouter();
  const [, startMove] = useTransition();
  // Optimistic position while the server confirms; cleared on refresh or revert.
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);

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

  const handleDrop = (id: string, startTime: string) => {
    const previous = moved[id];
    setMoved((m) => ({ ...m, [id]: startTime })); // optimistic
    setToast(null);
    startMove(async () => {
      const r = await rescheduleBooking(id, startTime);
      if (r.error) {
        // Revert to wherever it was before this drag.
        setMoved((m) => {
          const n = { ...m };
          if (previous) n[id] = previous;
          else delete n[id];
          return n;
        });
        setToast({ text: r.error, error: true });
        return;
      }
      if (r.warnings?.length) setToast({ text: r.warnings.join(" "), error: false });
      // Server state now matches; drop the override so fresh data wins.
      setMoved((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
      router.refresh();
    });
  };

  const { drag, begin, move, end, didMove } = useDragReschedule({ pxPerMin: PX_PER_MIN, minM, maxM, onDrop: handleDrop });

  /** Apply any optimistic move to a booking before layout. */
  const positioned = (b: CalendarBooking): CalendarBooking => {
    const override = moved[b.id];
    if (!override) return b;
    const startMin = hhmmToMinutes(override);
    return { ...b, startTime: override, endTime: minutesToHHMM(startMin + b.durationMin) };
  };

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
                <div className={cn("font-heading text-sm font-semibold", isToday && "text-role")}>{format(d, "d MMM")}</div>
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
                {/* exceptions (days off / blocked hours): darker, striped, note on hover */}
                {day.blocks.map((bl, i) => {
                  const top = Math.max(0, y(bl.startTime));
                  const bottom = Math.min(height, y(bl.endTime));
                  return (
                    <div
                      key={`x${i}`}
                      className="absolute inset-x-0 bg-exception"
                      style={{ top, height: Math.max(0, bottom - top) }}
                      title={bl.note ? `Unavailable: ${bl.note}` : "Unavailable"}
                    >
                      {bl.note && bottom - top > 24 && (
                        <span className="absolute left-1 top-1 rounded-sm bg-background/80 px-1 text-[10px] text-muted-foreground">{bl.note}</span>
                      )}
                    </div>
                  );
                })}
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
                {layoutLanes(visible.map(positioned)).map(({ b, lane, lanes }) => {
                  const dragging = drag?.id === b.id;
                  const movable = MOVABLE.has(b.status);
                  const top = dragging ? (drag!.startMin - minM) * PX_PER_MIN : y(b.startTime);
                  return (
                  <button
                    key={b.id}
                    type="button"
                    onPointerDown={
                      movable
                        ? (e) => begin(e, { id: b.id, startMin: hhmmToMinutes(b.startTime), durationMin: b.durationMin, date: day.date })
                        : undefined
                    }
                    onPointerMove={movable ? move : undefined}
                    onPointerUp={movable ? end : undefined}
                    onPointerCancel={movable ? end : undefined}
                    // A drag ends with a click event; ignore it so the dialog doesn't open.
                    onClick={() => {
                      if (!didMove()) setOpen(b);
                    }}
                    className={cn(
                      "absolute z-[2] overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-xs shadow-sm hover:brightness-95",
                      STATUS_STYLE[b.status] ?? "",
                      b.evaluation.warning && ["PENDING", "ACCEPTED"].includes(b.status) && "ring-2 ring-destructive",
                      movable && "cursor-grab touch-none",
                      dragging && "z-20 cursor-grabbing opacity-90 shadow-lg ring-2 ring-tjm-yellow",
                    )}
                    style={{
                      top,
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
                      {dragging ? `${minutesToHHMM(drag!.startMin)}–${minutesToHHMM(drag!.startMin + b.durationMin)}` : `${b.startTime}–${b.endTime}`}
                    </div>
                    {b.durationMin >= 60 && <div className="truncate opacity-70">{b.locationLabel}</div>}
                  </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {toast && (
        <div
          role="status"
          className={cn(
            "sticky bottom-2 z-30 mx-2 mb-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs shadow-lg",
            toast.error ? "border-destructive bg-destructive/10 text-destructive" : "border-tjm-orange bg-[#fff1e6] text-[#7a3600]",
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="underline opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}
      {open && <BookingDialog booking={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
