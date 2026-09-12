import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { getSchedulingSettings } from "@/lib/settings";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClientsPage() {
  const { timezone: tz } = await getSchedulingSettings();
  const clients = await db.user.findMany({
    where: { role: "CLIENT" },
    include: {
      locations: true,
      bookings: { where: { endAt: { gte: new Date() }, status: { in: ["PENDING", "ACCEPTED"] } }, orderBy: { startAt: "asc" }, include: { location: true } },
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Clients</h1>
      {clients.length === 0 && <p className="text-sm text-muted-foreground">No clients have signed up yet.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {clients.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{c.name ?? c.email}</span>
                <Link href={`/trainer/clients/${c.id}`} className="font-heading text-xs font-semibold text-tjm-orange hover:underline">
                  History →
                </Link>
              </CardTitle>
              <CardDescription>
                {c.email}
                {c.phone ? ` · ${c.phone}` : ""} · {c._count.bookings} booking{c._count.bookings === 1 ? "" : "s"} total
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(c.emergencyContact || c.notes) && (
                <div className="rounded-md border border-tjm-yellow/60 bg-accent/40 p-3">
                  {c.emergencyContact && (
                    <div>
                      <span className="font-medium">Emergency contact:</span> {c.emergencyContact}
                    </div>
                  )}
                  {c.notes && (
                    <div className={c.emergencyContact ? "mt-1" : ""}>
                      <span className="font-medium">Notes:</span> {c.notes}
                    </div>
                  )}
                </div>
              )}
              {c.locations.length > 0 && (
                <div>
                  <div className="mb-1 font-medium">Locations</div>
                  <ul className="text-muted-foreground">
                    {c.locations.map((l) => (
                      <li key={l.id}>{l.label ? `${l.label} · ` : ""}{l.formatted}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <div className="mb-1 font-medium">Upcoming</div>
                {c.bookings.length === 0 ? (
                  <p className="text-muted-foreground">None</p>
                ) : (
                  <ul className="space-y-1">
                    {c.bookings.slice(0, 6).map((b) => (
                      <li key={b.id} className="flex items-center gap-2">
                        <span>{formatInTimeZone(b.startAt, tz, "EEE d MMM, HH:mm")}</span>
                        <span className="text-muted-foreground">· {b.durationMin} min</span>
                        <StatusBadge status={b.status} className="ml-auto" />
                      </li>
                    ))}
                    {c.bookings.length > 6 && <li className="text-muted-foreground">+{c.bookings.length - 6} more</li>}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
