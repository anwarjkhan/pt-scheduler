import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { getSchedulingSettings } from "@/lib/settings";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MapPin, Phone, Repeat, StickyNote } from "lucide-react";

/** Past accepted sessions read as completed in history; everything else keeps its stored status. */
function displayStatus(status: string, endAt: Date, now: Date) {
  return status === "ACCEPTED" && endAt < now ? "COMPLETED" : status;
}

export default async function ClientHistoryPage({ params }: PageProps<"/trainer/clients/[id]">) {
  const { id } = await params;
  const { timezone: tz } = await getSchedulingSettings();
  const client = await db.user.findFirst({
    where: { id, role: "CLIENT" },
    include: {
      locations: { orderBy: { createdAt: "asc" } },
      bookings: { include: { location: true }, orderBy: { startAt: "desc" } },
    },
  });
  if (!client) notFound();

  const now = new Date();
  const rows = client.bookings.map((b) => ({ ...b, shown: displayStatus(b.status, b.endAt, now) }));
  const upcoming = rows.filter((b) => b.endAt >= now && ["PENDING", "ACCEPTED"].includes(b.status)).reverse();
  const history = rows.filter((b) => !upcoming.includes(b));

  const count = (s: string) => rows.filter((b) => b.shown === s).length;
  const completed = count("COMPLETED");
  const minutes = rows.filter((b) => b.shown === "COMPLETED").reduce((n, b) => n + b.durationMin, 0);
  const cancelled = count("CANCELLED_BY_CLIENT") + count("CANCELLED_BY_TRAINER");
  const firstSession = rows.filter((b) => b.shown === "COMPLETED").at(-1);

  const stats = [
    { label: "Completed", value: completed },
    { label: "Hours trained", value: (minutes / 60).toFixed(1) },
    { label: "Upcoming", value: upcoming.length },
    { label: "Cancelled", value: cancelled },
    { label: "Declined", value: count("DECLINED") },
    { label: "Client since", value: firstSession ? formatInTimeZone(firstSession.startAt, tz, "MMM yyyy") : "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/trainer/clients" className="text-sm text-muted-foreground hover:underline">
          ← All clients
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-semibold">{client.name ?? client.email}</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Mail className="h-4 w-4" /> {client.email}
          </span>
          {client.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-4 w-4" /> {client.phone}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-md border bg-card p-3">
            <div className="font-heading text-2xl font-semibold">{s.value}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {(client.emergencyContact || client.notes || client.locations.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <div className="space-y-2">
              {client.emergencyContact && (
                <div>
                  <span className="font-medium">Emergency contact:</span> {client.emergencyContact}
                </div>
              )}
              {client.notes && (
                <div className="flex items-start gap-2">
                  <StickyNote className="mt-0.5 h-4 w-4 text-muted-foreground" /> {client.notes}
                </div>
              )}
            </div>
            <ul className="space-y-1">
              {client.locations.map((l) => (
                <li key={l.id} className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {l.label ? `${l.label} · ` : ""}
                  {l.formatted}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
        </CardHeader>
        <CardContent>{upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Nothing booked.</p> : <SessionList rows={upcoming} tz={tz} />}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>{history.length} past session{history.length === 1 ? "" : "s"}, newest first.</CardDescription>
        </CardHeader>
        <CardContent>{history.length === 0 ? <p className="text-sm text-muted-foreground">No history yet.</p> : <SessionList rows={history} tz={tz} />}</CardContent>
      </Card>
    </div>
  );
}

function SessionList({
  rows,
  tz,
}: {
  rows: { id: string; startAt: Date; endAt: Date; durationMin: number; shown: string; seriesId: string | null; clientNote: string | null; trainerNote: string | null; cancelReason: string | null; location: { label: string | null; formatted: string } }[];
  tz: string;
}) {
  return (
    <ul className="divide-y">
      {rows.map((b) => (
        <li key={b.id} className="flex flex-wrap items-start gap-3 py-3 text-sm">
          <div className="min-w-44">
            <div className="font-medium">{formatInTimeZone(b.startAt, tz, "EEE d MMM yyyy")}</div>
            <div className="text-muted-foreground">
              {formatInTimeZone(b.startAt, tz, "HH:mm")}–{formatInTimeZone(b.endAt, tz, "HH:mm")} · {b.durationMin} min
              {b.seriesId && <Repeat className="ml-1 inline h-3.5 w-3.5" aria-label="Weekly series" />}
            </div>
          </div>
          <div className="min-w-0 flex-1 text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{b.location.label ?? b.location.formatted}</span>
            </div>
            {b.clientNote && <div className="mt-0.5 text-xs">Client: {b.clientNote}</div>}
            {b.trainerNote && <div className="mt-0.5 text-xs">You: {b.trainerNote}</div>}
            {b.cancelReason && <div className="mt-0.5 text-xs">Reason: {b.cancelReason}</div>}
          </div>
          <StatusBadge status={b.shown} />
        </li>
      ))}
    </ul>
  );
}
