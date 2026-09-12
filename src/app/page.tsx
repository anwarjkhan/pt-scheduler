import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getSchedulingSettings } from "@/lib/settings";
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
  const session = await auth();
  const user = session?.user;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {user ? (
          <BookingPanel user={user} sp={await searchParams} />
        ) : (
          <>
            <Hero />
            <Intro />
          </>
        )}
        <MeetToby />
        <KindWords />
        <TrainingOptions />
        <Partners />
        <Areas />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}

/** Signed-in view at the top of the home page: the booking app for clients, the calendar for the trainer. */
async function BookingPanel({
  user,
  sp,
}: {
  user: { id: string; name?: string | null; role: "CLIENT" | "TRAINER" };
  sp: Record<string, string | string[] | undefined>;
}) {
  const settings = await getSchedulingSettings();
  const firstName = user.name?.split(" ")[0];

  if (user.role === "TRAINER") {
    return (
      <section id="book" className="scroll-mt-16 border-b bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="mb-4 font-heading text-sm font-semibold uppercase tracking-widest text-tjm-orange">Welcome back{firstName ? `, ${firstName}` : ""}</p>
          <TrainerCalendarView sp={sp} basePath="/" />
        </div>
      </section>
    );
  }

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
    <section id="book" className="scroll-mt-16 border-b bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-heading text-sm font-semibold uppercase tracking-widest text-tjm-orange">Welcome back{firstName ? `, ${firstName}` : ""}</p>
            <h1 className="font-heading text-3xl font-bold">Book a session with Toby</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a location and duration, then choose a start time. Sessions need {settings.minNoticeHours} hours&apos; notice.
            </p>
          </div>
          {upcoming.length > 0 && (
            <div className="rounded-md border bg-card px-4 py-3 text-sm">
              <div className="mb-1 font-heading text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next up</div>
              <ul className="space-y-1">
                {upcoming.map((b) => (
                  <li key={b.id} className="flex items-center gap-2">
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
        </div>
        <BookingWizard locations={locations} todayKey={dateKey(new Date(), settings.timezone)} />
      </div>
    </section>
  );
}
