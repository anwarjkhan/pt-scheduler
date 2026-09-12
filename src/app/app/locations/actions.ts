"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { checkServiceArea } from "@/lib/bookings";

const schema = z.object({
  label: z.string().max(60).optional(),
  address: z.string().min(3, "Enter an address"),
  placeId: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export type LocationState = { ok?: boolean; error?: string; id?: string };

export async function addLocation(_p: LocationState, fd: FormData): Promise<LocationState> {
  const user = await requireUser();
  const raw = Object.fromEntries(fd) as Record<string, string>;
  if (!raw.lat || !raw.lng) return { error: "Pick an address from the suggestions (or enter coordinates)." };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;

  const check = await checkServiceArea({ lat: d.lat, lng: d.lng });
  if (!check.ok) {
    const n = check.nearest;
    return {
      error: n
        ? `That address is about ${n.miles.toFixed(1)} miles from ${n.label} (Toby covers ${n.radiusMiles} miles around it). Get in touch if you'd like to check.`
        : "That address is outside the areas Toby covers.",
    };
  }

  const loc = await db.location.create({
    data: {
      userId: user.id,
      label: d.label || null,
      formatted: d.address,
      placeId: d.placeId || null,
      lat: d.lat,
      lng: d.lng,
      serviceAreaId: check.areaId,
    },
  });
  revalidatePath("/app", "layout");
  return { ok: true, id: loc.id };
}

export async function deleteLocation(id: string) {
  const user = await requireUser();
  const loc = await db.location.findFirst({ where: { id, userId: user.id }, include: { _count: { select: { bookings: true } } } });
  if (!loc) return;
  if (loc._count.bookings > 0) return; // keep history intact
  await db.location.delete({ where: { id } });
  revalidatePath("/app", "layout");
}
