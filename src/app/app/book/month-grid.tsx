"use client";

import { useEffect, useState } from "react";
import { addMonths, format, parseISO } from "date-fns";
import type { MonthResponse } from "@/app/api/availability/route";
import { monthGrid, WEEKDAY_HEADERS } from "@/lib/month";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

/** Client month overview: free times per day + the client's own bookings. Click a day to book in that week. */
export function ClientMonthGrid({
  anchor,
  duration,
  todayKey,
  onAnchorChange,
  onPickDay,
}: {
  anchor: string;
  duration: number;
  todayKey: string;
  onAnchorChange: (date: string) => void;
  onPickDay: (date: string) => void;
}) {
  const { monthKey, dates } = monthGrid(anchor);
  const [data, setData] = useState<{ key: string; days: MonthResponse["days"] } | null>(null);
  const queryKey = `${monthKey}|${duration}`;
  const loading = data?.key !== queryKey;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/availability?date=${monthKey}-01&duration=${duration}`)
      .then((r) => r.json())
      .then((j: MonthResponse) => {
        if (!cancelled) setData({ key: queryKey, days: j.days });
      });
    return () => {
      cancelled = true;
    };
  }, [queryKey, monthKey, duration]);

  const first = parseISO(`${monthKey}-01`);
  const byDate = new Map((data?.days ?? []).map((d) => [d.date, d]));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="icon" onClick={() => onAnchorChange(format(addMonths(first, -1), "yyyy-MM-dd"))} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-36 text-center font-heading text-sm font-semibold">{format(first, "MMMM yyyy")}</span>
        <Button type="button" variant="outline" size="icon" onClick={() => onAnchorChange(format(addMonths(first, 1), "yyyy-MM-dd"))} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative overflow-hidden rounded-md border bg-card">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        <div className="grid grid-cols-7 bg-tjm-charcoal text-center font-heading text-[11px] font-semibold uppercase text-white/70">
          {WEEKDAY_HEADERS.map((d) => (
            <div key={d} className="py-1.5">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dates.map((date) => {
            const d = byDate.get(date);
            const inMonth = date.startsWith(monthKey);
            const past = date < todayKey;
            const bookable = !!d?.open && (d?.free ?? 0) > 0 && !past;
            return (
              <button
                key={date}
                type="button"
                disabled={!bookable && !(d?.mine.length ?? 0)}
                onClick={() => onPickDay(date)}
                className={cn(
                  "flex min-h-20 flex-col items-start gap-1 border-b border-r p-1.5 text-left text-xs transition-colors",
                  !inMonth && "bg-muted/40 text-muted-foreground",
                  inMonth && !past && d?.exception && !d.open && "bg-exception",
                  bookable ? "hover:bg-accent" : "cursor-default",
                  date === todayKey && "ring-2 ring-inset ring-tjm-yellow",
                )}
              >
                <span className={cn("font-heading text-sm font-semibold", past && "text-muted-foreground")}>{format(parseISO(date), "d")}</span>
                {d?.mine.map((m) => (
                  <span
                    key={m.time}
                    className={cn(
                      "w-full truncate rounded-sm border px-1 font-heading text-[10px] font-semibold",
                      m.status === "ACCEPTED" ? "border-[#166b3a] bg-tjm-confirm text-white" : "border-tjm-orange bg-[#fff1e6] text-[#7a3600]",
                    )}
                  >
                    {m.time} · you
                  </span>
                ))}
                {past ? null : !d?.open ? (
                  <span className="text-[10px] text-muted-foreground">{d?.exception ?? "Off"}</span>
                ) : d.free === 0 ? (
                  <span className="text-[10px] text-muted-foreground">Full</span>
                ) : (
                  <span className="rounded-sm bg-tjm-yellow/40 px-1 text-[10px] font-semibold text-tjm-charcoal">{d.free} times</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Times shown are before travel checks — pick a day to see exact start times.</p>
    </div>
  );
}
