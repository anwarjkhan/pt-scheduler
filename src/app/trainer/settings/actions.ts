"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTrainer } from "@/lib/session";

const schema = z.object({
  timezone: z.string().min(1),
  address: z.string().optional(),
  placeId: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  maxRadiusMiles: z.coerce.number().min(1).max(200),
  bufferMinutes: z.coerce.number().int().min(0).max(120),
  slotStepMinutes: z.coerce.number().int().refine((n) => [15, 30, 60].includes(n)),
  minNoticeHours: z.coerce.number().int().min(0).max(168),
});

export type SettingsState = { ok?: boolean; error?: string };

export async function saveSettings(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  await requireTrainer();
  const raw = Object.fromEntries(fd.entries());
  // empty strings → undefined so optional coercions don't turn "" into 0
  for (const k of ["lat", "lng", "placeId", "address"]) if (raw[k] === "") delete raw[k];
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const d = parsed.data;

  const hasHome = d.address && d.lat != null && d.lng != null;
  await db.trainerSettings.upsert({
    where: { id: "singleton" },
    update: {
      timezone: d.timezone,
      maxRadiusMiles: d.maxRadiusMiles,
      bufferMinutes: d.bufferMinutes,
      slotStepMinutes: d.slotStepMinutes,
      minNoticeHours: d.minNoticeHours,
      ...(hasHome
        ? { homeAddress: d.address, homePlaceId: d.placeId ?? null, homeLat: d.lat, homeLng: d.lng }
        : {}),
    },
    create: {
      id: "singleton",
      timezone: d.timezone,
      maxRadiusMiles: d.maxRadiusMiles,
      bufferMinutes: d.bufferMinutes,
      slotStepMinutes: d.slotStepMinutes,
      minNoticeHours: d.minNoticeHours,
      homeAddress: hasHome ? d.address : null,
      homePlaceId: hasHome ? (d.placeId ?? null) : null,
      homeLat: hasHome ? d.lat : null,
      homeLng: hasHome ? d.lng : null,
    },
  });
  revalidatePath("/trainer", "layout");
  return { ok: true };
}

// ---------- Service areas ----------

const areaSchema = z.object({
  label: z.string().trim().min(1, "Give the area a name").max(60),
  address: z.string().min(3, "Enter an address"),
  placeId: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMiles: z.coerce.number().min(0.5).max(50),
});

export async function addServiceArea(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  await requireTrainer();
  const raw = Object.fromEntries(fd) as Record<string, string>;
  if (!raw.lat || !raw.lng) return { error: "Pick an address from the suggestions (or enter coordinates)." };
  const parsed = areaSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;
  await db.serviceArea.create({
    data: { label: d.label, formatted: d.address, placeId: d.placeId || null, lat: d.lat, lng: d.lng, radiusMiles: d.radiusMiles },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteServiceArea(id: string) {
  await requireTrainer();
  await db.serviceArea.delete({ where: { id } });
  revalidatePath("/", "layout");
}
