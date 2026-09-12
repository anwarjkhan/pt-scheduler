import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCoverageSummary, getSchedulingSettings } from "@/lib/settings";
import { dateKey } from "@/lib/scheduling";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Areas, Contact, Hero, Intro, KindWords, MeetToby, Partners, TrainingOptions } from "@/components/site/sections";
import { BookingWizard } from "@/app/app/book/booking-wizard";
import { TrainerCalendarView } from "@/app/trainer/calendar-view";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatInTimeZone } from "date-fns-tz";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const [user, coverage] = await Promise.all([auth().then((s) => s?.user), getCoverageSummary()]);

  return (
    <>
      <SiteHeader calendar={user ? <CalendarModalContent user={user} sp={sp} /> : undefined} calendarOpen={sp.cal === "1"} />
      <main className="flex-1">
        <Hero signedIn={!!user} />
        <Intro />
        <MeetToby />
        <KindWords />
        <TrainingOptions signedIn={!!user} />
        <Partners />
        <Areas covered={coverage.areas} />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}

/** What the account-menu calendar modal shows: the booking wizard for clients, the week calendar for the trainer. */
async function CalendarModalContent({
  user,
  sp,
}: {
  user: { id: string; role: "CLIENT" | "TRAINER" };
  sp: Record<string, string | string[] | undefined>;
}) {
  const settings = await getSchedulingSettings();

  if (user.role === "TRAINER") return <TrainerCalendarView sp={sp} basePath="/" />;

  const [locations, upcoming] = await Promise.all([
    db.location.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, label: true, formatted: true } }),
    db.booking.findMany({
      where: { clientId: user.id, endAt: { gte: new Date() }, status: { in: ["PENDING", "ACCEPTED"] } },
      include: { location: true },
      orderBy: { startAt: "asc" },
      take: 3,
    }),
  ]);

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
          <div className="mb-1 font-heading text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next up</div>
          <ul className="space-y-1">
            {upcoming.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2">
                <span>{formatInTimeZone(b.startAt, settings.timezone, "EEE d MMM, HH:mm")}</span>
                <span className="text-muted-foreground">· {b.location.label ?? b.location.formatted}</span>
                <StatusBadge status={b.status} />
              </li>
            ))}
          </ul>
          <Button variant="link" size="sm" className="mt-1 h-auto p-0" nativeButton={false} render={<Link href="/app" />}>
            All my sessions →
          </Button>
        </div>
      )}
      <BookingWizard locations={locations} todayKey={dateKey(new Date(), settings.timezone)} coverage={(await getCoverageSummary()).text} />
    </div>
  );
}
