import Link from "next/link";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { WEEKDAY_HEADERS } from "@/lib/month";
import { cn } from "@/lib/utils";

export type MonthBooking = { id: string; startAt: Date; status: string; clientName: string };

const CHIP: Record<string, string> = {
  PENDING: "border-tjm-orange bg-[#fff1e6] text-[#7a3600]",
  ACCEPTED: "border-[#166b3a] bg-tjm-confirm text-white",
};

/** Trainer month overview: sessions per day as status chips; each day links to its day view. */
export function TrainerMonthGrid({
  monthKey,
  dates,
  bookings,
  closedDates,
  exceptionNotes,
  todayKey,
  tz,
  dayHref,
}: {
  monthKey: string;
  dates: string[];
  bookings: MonthBooking[];
  /** Dates with no open availability window (weekly template + exceptions). */
  closedDates: Set<string>;
  /** date → note for days with an UNAVAILABLE exception (drawn darker than template-closed days). */
  exceptionNotes: Map<string, string>;
  todayKey: string;
  tz: string;
  dayHref: (date: string) => string;
}) {
  const byDate = new Map<string, MonthBooking[]>();
  for (const b of bookings) {
    const k = formatInTimeZone(b.startAt, tz, "yyyy-MM-dd");
    byDate.set(k, [...(byDate.get(k) ?? []), b]);
  }

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="grid grid-cols-7 bg-tjm-charcoal text-center font-heading text-[11px] font-semibold uppercase text-white/70">
        {WEEKDAY_HEADERS.map((d) => (
          <div key={d} className="py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dates.map((date) => {
          const inMonth = date.startsWith(monthKey);
          const list = (byDate.get(date) ?? []).filter((b) => ["PENDING", "ACCEPTED"].includes(b.status));
          const closed = closedDates.has(date);
          const note = exceptionNotes.get(date);
          return (
            <Link
              key={date}
              href={dayHref(date)}
              className={cn(
                "flex min-h-24 flex-col gap-1 border-b border-r p-1.5 text-xs transition-colors hover:bg-accent",
                !inMonth && "bg-muted/40 text-muted-foreground",
                closed && inMonth && !note && "bg-muted/60",
                note && inMonth && "bg-exception",
                date === todayKey && "ring-2 ring-inset ring-tjm-yellow",
              )}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-heading text-sm font-semibold">{format(parseISO(date), "d")}</span>
                {closed && inMonth && !note && <span className="text-[10px] text-muted-foreground">Off</span>}
                {!closed && !note && list.length > 0 && <span className="text-[10px] text-muted-foreground">{list.length}</span>}
              </div>
              {note && inMonth && <span className="truncate rounded-sm bg-background/80 px-1 text-[10px] text-muted-foreground">{note}</span>}
              {list.slice(0, 3).map((b) => (
                <span key={b.id} className={cn("truncate rounded-sm border px-1 font-heading text-[10px] font-semibold", CHIP[b.status])}>
                  {formatInTimeZone(b.startAt, tz, "HH:mm")} {b.clientName}
                </span>
              ))}
              {list.length > 3 && <span className="text-[10px] text-muted-foreground">+{list.length - 3} more</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
