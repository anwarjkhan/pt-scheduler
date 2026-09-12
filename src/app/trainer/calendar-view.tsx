import Link from "next/link";
import { addDays, addMonths, format, parseISO, startOfWeek } from "date-fns";
import { db } from "@/lib/db";
import { buildCalendarDays } from "@/lib/calendar-data";
import { getSchedulingSettings } from "@/lib/settings";
import { dateKey } from "@/lib/scheduling";
import { CalendarGrid } from "./calendar-grid";
import { TrainerMonthGrid } from "./month-grid";
import { monthGrid } from "@/lib/month";
import { getAvailability } from "@/lib/settings";
import { getWindowsForDate, zoned } from "@/lib/scheduling";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Params = { view?: string | string[]; date?: string | string[] };

/** Trainer calendar; `basePath` controls where the prev/next/view links point (page vs. home panel). */
export async function TrainerCalendarView({ sp, basePath = "/trainer" }: { sp: Params; basePath?: string }) {
  const settings = await getSchedulingSettings();
  const todayKey = dateKey(new Date(), settings.timezone);
  const view = sp.view === "day" ? "day" : sp.view === "month" ? "month" : "week";
  const anchor = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayKey;
  const href = (d: string, v = view) => `${basePath}?view=${v}&date=${d}${basePath === "/" ? "&cal=1" : ""}`;

  if (view === "month") return <MonthView anchor={anchor} todayKey={todayKey} tz={settings.timezone} href={href} basePath={basePath} />;

  const dates =
    view === "day"
      ? [anchor]
      : Array.from({ length: 7 }, (_, i) => format(addDays(startOfWeek(parseISO(anchor), { weekStartsOn: 1 }), i), "yyyy-MM-dd"));

  const [{ days }, pendingCount] = await Promise.all([buildCalendarDays(dates), db.booking.count({ where: { status: "PENDING" } })]);

  const step = view === "day" ? 1 : 7;
  const tightCount = days.reduce((n, d) => n + d.segments.filter((s) => s.shortfallMin > 0).length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {basePath !== "/" && <h1 className="font-heading text-2xl font-semibold">Calendar</h1>}
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
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href(anchor, "month")} />}>
            Month
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
        <span><span className="mr-1 inline-block h-3 w-3 rounded-sm border border-[#166b3a] bg-tjm-confirm align-middle" />Confirmed</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-sm bg-tjm-charcoal/15 align-middle" />Drive time</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-sm bg-destructive/30 align-middle" />Not enough travel time</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-sm bg-muted align-middle" />Outside working hours</span>
      </div>
    </div>
  );
}

/** Month grid: all sessions in the visible 6 weeks, with closed days shaded. No commute maths here — the day/week views do that. */
async function MonthView({
  anchor,
  todayKey,
  tz,
  href,
  basePath,
}: {
  anchor: string;
  todayKey: string;
  tz: string;
  href: (d: string, v?: "day" | "week" | "month") => string;
  basePath: string;
}) {
  const { monthKey, dates } = monthGrid(anchor);
  const start = zoned(dates[0], "00:00", tz);
  const end = zoned(format(addDays(parseISO(dates[dates.length - 1]), 1), "yyyy-MM-dd"), "00:00", tz);
  const [bookings, { rules, exceptions }, pendingCount] = await Promise.all([
    db.booking.findMany({
      where: { startAt: { gte: start, lt: end }, status: { in: ["PENDING", "ACCEPTED"] } },
      select: { id: true, startAt: true, status: true, client: { select: { name: true, email: true } } },
      orderBy: { startAt: "asc" },
    }),
    getAvailability(),
    db.booking.count({ where: { status: "PENDING" } }),
  ]);
  const closedDates = new Set(dates.filter((d) => getWindowsForDate(d, tz, rules, exceptions).length === 0));
  const first = parseISO(`${monthKey}-01`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {basePath !== "/" && <h1 className="font-heading text-2xl font-semibold">Calendar</h1>}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="icon" nativeButton={false} render={<Link href={href(format(addMonths(first, -1), "yyyy-MM-dd"))} />} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href(todayKey)} />}>
            Today
          </Button>
          <Button variant="outline" size="icon" nativeButton={false} render={<Link href={href(format(addMonths(first, 1), "yyyy-MM-dd"))} />} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="mx-2 text-sm font-medium">{format(first, "MMMM yyyy")}</span>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href(anchor, "day")} />}>
            Day
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href(anchor, "week")} />}>
            Week
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href={href(anchor, "month")} />}>
            Month
          </Button>
        </div>
      </div>
      {pendingCount > 0 && (
        <div className="text-sm">
          <Link href="/trainer/requests" className="rounded-md border border-tjm-orange bg-tjm-orange/10 px-3 py-1.5 font-heading font-semibold text-[#7a3600] dark:text-orange-100">
            {pendingCount} pending request{pendingCount === 1 ? "" : "s"} →
          </Link>
        </div>
      )}
      <TrainerMonthGrid
        monthKey={monthKey}
        dates={dates}
        bookings={bookings.map((b) => ({ id: b.id, startAt: b.startAt, status: b.status, clientName: b.client.name ?? b.client.email }))}
        closedDates={closedDates}
        todayKey={todayKey}
        tz={tz}
        dayHref={(d) => href(d, "day")}
      />
      <p className="text-xs text-muted-foreground">Click a day to see it with drive times between sessions.</p>
    </div>
  );
}
