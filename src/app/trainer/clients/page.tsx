import { db } from "@/lib/db";
import { getTrainerSettings } from "@/lib/settings";
import { getBalances } from "@/lib/wallet";
import { getAllClientHealth } from "@/lib/client-health-data";
import { ClientDirectory, type ClientCard } from "./client-directory";

export default async function ClientsPage() {
  const settings = await getTrainerSettings();
  const tz = settings.timezone;
  const now = new Date();
  const [clients, areas] = await Promise.all([
    db.user.findMany({
      where: { role: "CLIENT" },
      include: {
        locations: { include: { serviceArea: { select: { id: true, label: true } } } },
        bookings: { select: { startAt: true, endAt: true, status: true, durationMin: true, location: { select: { label: true, formatted: true } } }, orderBy: { startAt: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    db.serviceArea.findMany({ select: { id: true, label: true }, orderBy: { label: "asc" } }),
  ]);

  // One grouped query for every balance, and one pass for every health score,
  // rather than a pair of queries per client.
  const [balances, health] = await Promise.all([getBalances(clients.map((c) => c.id)), getAllClientHealth()]);

  const cards: ClientCard[] = clients.map((c) => {
    const live = c.bookings.filter((b) => b.endAt >= now && ["PENDING", "ACCEPTED"].includes(b.status));
    const past = c.bookings.filter((b) => b.status === "ACCEPTED" && b.endAt < now);
    return {
      id: c.id,
      name: c.name ?? c.email,
      email: c.email,
      phone: c.phone,
      emergencyContact: c.emergencyContact,
      notes: c.notes,
      locations: c.locations.map((l) => ({
        label: l.label,
        formatted: l.formatted,
        placeId: l.placeId,
        lat: l.lat,
        lng: l.lng,
        areaId: l.serviceArea?.id ?? null,
        area: l.serviceArea?.label ?? null,
      })),
      upcoming: live.map((b) => ({ startAt: b.startAt.toISOString(), status: b.status, durationMin: b.durationMin, place: b.location.label ?? b.location.formatted })),
      pendingCount: live.filter((b) => b.status === "PENDING").length,
      completedCount: past.length,
      lastSessionAt: past.at(-1)?.startAt.toISOString() ?? null,
      nextSessionAt: live[0]?.startAt.toISOString() ?? null,
      joinedAt: c.createdAt.toISOString(),
      balancePence: balances.get(c.id) ?? 0,
      billingMode: c.billingMode,
      health: (() => {
        const h = health.get(c.id);
        return h ? { status: h.status, headline: h.headline } : null;
      })(),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Clients</h1>
      <ClientDirectory clients={cards} areas={areas} tz={tz} currency={settings.currency} />
    </div>
  );
}
