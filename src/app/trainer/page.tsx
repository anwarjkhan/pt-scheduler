import Link from "next/link";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { db } from "@/lib/db";
import { buildCalendarDays } from "@/lib/calendar-data";
import { getSchedulingSettings } from "@/lib/settings";
import { dateKey } from "@/lib/scheduling";
import { CalendarGrid } from "./calendar-grid";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default async function TrainerCalendarPage({ searchParams }: PageProps<"/trainer">) {
  const sp = await searchParams;
  const settings = await getSchedulingSettings();
  const todayKey = dateKey(new Date(), settings.timezone);
  const view = sp.view === "day" ? "day" : "week";
  const anchor = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayKey;

  const dates =
    view === "day"
      ? [anchor]
      : Array.from({ length: 7 }, (_, i) => format(addDays(startOfWeek(parseISO(anchor), { weekStartsOn: 1 }), i), "yyyy-MM-dd"));

  const [{ days }, pendingCount] = await Promise.all([buildCalendarDays(dates), db.booking.count({ where: { status: "PENDING" } })]);

  const step = view === "day" ? 1 : 7;
  const href = (d: string, v = view) => `/trainer?view=${v}&date=${d}`;
  const tightCount = days.reduce((n, d) => n + d.segments.filter((s) => s.shortfallMin > 0).length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="icon" nativeButton={false} render={<Link href={href(format(addDays(parseISO(anchor), -step), "yyyy-MM-dd"))} />} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href(todayKey)} />}>
            Today
          </Button>
          <Button variant="outline" size="icon" nativeButton={false} render={<Link href={href(format(addDays(parseISO(anchor), step), "yyyy-MM-dd"))} />} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="mx-2 text-sm font-medium">
            {view === "day" ? format(parseISO(anchor), "EEEE d MMM yyyy") : `${format(parseISO(dates[0]), "d MMM")} – ${format(parseISO(dates[6]), "d MMM yyyy")}`}
          </span>
          <Button variant={view === "day" ? "default" : "outline"} size="sm" nativeButton={false} render={<Link href={href(anchor, "day")} />}>
            Day
          </Button>
          <Button variant={view === "week" ? "default" : "outline"} size="sm" nativeButton={false} render={<Link href={href(anchor, "week")} />}>
            Week
          </Button>
        </div>
      </div>

      {!settings.home && (
        <Alert>
          <AlertDescription>
            Set your home address in <Link href="/trainer/settings" className="underline">Settings</Link> to enable the service radius and home-leg commute checks.
          </AlertDescription>
        </Alert>
      )}
      {(pendingCount > 0 || tightCount > 0) && (
        <div className="flex flex-wrap gap-3 text-sm">
          {pendingCount > 0 && (
            <Link href="/trainer/requests" className="rounded-md border border-tjm-orange bg-tjm-orange/10 px-3 py-1.5 font-heading font-semibold text-[#7a3600] dark:text-orange-100">
              {pendingCount} pending request{pendingCount === 1 ? "" : "s"} →
            </Link>
          )}
          {tightCount > 0 && (
            <span className="rounded-md border border-destructive bg-destructive/10 px-3 py-1.5 font-heading font-semibold text-destructive">
              {tightCount} tight commute{tightCount === 1 ? "" : "s"} this {view}
            </span>
          )}
        </div>
      )}

      <CalendarGrid days={days} todayKey={todayKey} />

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span><span className="mr-1 inline-block h-3 w-3 rounded-sm border border-tjm-orange bg-[#fff1e6] align-middle" />Pending</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-sm border border-tjm-lime bg-[#f5f8d6] align-middle" />Confirmed</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-sm bg-tjm-charcoal/15 align-middle" />Drive time</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-sm bg-destructive/30 align-middle" />Not enough travel time</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-sm bg-muted align-middle" />Outside working hours</span>
      </div>
    </div>
  );
}
