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
