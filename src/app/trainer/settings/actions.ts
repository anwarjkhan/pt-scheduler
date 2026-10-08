"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTrainer } from "@/lib/session";
import { SITE } from "@/content/site";

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

export async function updateServiceArea(id: string, _prev: SettingsState, fd: FormData): Promise<SettingsState> {
  await requireTrainer();
  const raw = Object.fromEntries(fd) as Record<string, string>;
  if (!raw.lat || !raw.lng) return { error: "Pick an address from the suggestions (or enter coordinates)." };
  const parsed = areaSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;
  await db.serviceArea.update({
    where: { id },
    data: { label: d.label, formatted: d.address, placeId: d.placeId || null, lat: d.lat, lng: d.lng, radiusMiles: d.radiusMiles },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Hero pillars ----------

// Kept in step with PILLAR_BODY_MAX in ./pillars.tsx, which enforces it in the UI.
const BODY_MAX = 250;

const pillarSchema = z.object({
  label: z.string().min(1, "Label is required").max(40, "Keep the label short — it's a chip in the hero"),
  body: z
    .string()
    .min(1, "Add some text to show when the chip is hovered")
    .max(BODY_MAX, `Keep it under ${BODY_MAX} characters — it shows over the hero photo`),
});

/**
 * The site falls back to the labels in site.ts while the table is empty. The
 * first edit has to materialise those rows, or saving one pillar would make the
 * other six vanish from the hero.
 */
async function ensurePillarsSeeded() {
  if ((await db.pillar.count()) > 0) return;
  await db.pillar.createMany({
    data: SITE.hero.pillars.map((label, i) => ({ label, body: "", sortOrder: i })),
  });
}

export async function addPillar(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  await requireTrainer();
  const parsed = pillarSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  await ensurePillarsSeeded();
  const last = await db.pillar.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await db.pillar.create({ data: { ...parsed.data, sortOrder: (last?.sortOrder ?? -1) + 1 } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updatePillar(id: string, _prev: SettingsState, fd: FormData): Promise<SettingsState> {
  await requireTrainer();
  const parsed = pillarSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };

  // Editing one of the site.ts fallbacks: materialise the set first, then find
  // the row by the label the fallback id carries.
  if (id.startsWith("fallback-")) {
    await ensurePillarsSeeded();
    const label = id.slice("fallback-".length);
    const row = await db.pillar.findFirst({ where: { label }, select: { id: true } });
    if (!row) return { error: "That chip no longer exists — reload the page." };
    id = row.id;
  }

  await db.pillar.update({ where: { id }, data: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deletePillar(id: string) {
  await requireTrainer();
  await db.pillar.delete({ where: { id } });
  revalidatePath("/", "layout");
}

/** Move one pillar up or down in the hero. */
export async function movePillar(id: string, direction: "up" | "down") {
  await requireTrainer();
  const all = await db.pillar.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = all.findIndex((p) => p.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  // Rewrite the whole order so gaps and ties from earlier edits can't accumulate.
  await db.$transaction(all.map((p, k) => db.pillar.update({ where: { id: p.id }, data: { sortOrder: k } })));
  revalidatePath("/", "layout");
}

// ---------- Instagram clips ----------

/**
 * URLs are stored as given and rendered straight into <img>/<video>, so only
 * http(s) is accepted — no data: or javascript: sneaking into the markup.
 */
const httpUrl = z
  .string()
  .trim()
  .url("Must be a URL")
  .refine((u) => /^https?:\/\//i.test(u), "Must start with http:// or https://");

const socialSchema = z.object({
  caption: z.string().trim().min(1, "Caption is required").max(300),
  posterUrl: httpUrl,
  videoUrl: z.union([httpUrl, z.literal("")]).optional(),
  permalink: httpUrl.refine((u) => /instagram\.com/i.test(u), "Must be an instagram.com link"),
});

export async function addSocialPost(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  await requireTrainer();
  const parsed = socialSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const last = await db.socialPost.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await db.socialPost.create({
    data: { ...parsed.data, videoUrl: parsed.data.videoUrl || null, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateSocialPost(id: string, _prev: SettingsState, fd: FormData): Promise<SettingsState> {
  await requireTrainer();
  const parsed = socialSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  await db.socialPost.update({ where: { id }, data: { ...parsed.data, videoUrl: parsed.data.videoUrl || null } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteSocialPost(id: string) {
  await requireTrainer();
  await db.socialPost.delete({ where: { id } });
  revalidatePath("/", "layout");
}

/** Move one clip up or down in the grid. */
export async function moveSocialPost(id: string, direction: "up" | "down") {
  await requireTrainer();
  const all = await db.socialPost.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true } });
  const i = all.findIndex((p) => p.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((p, k) => db.socialPost.update({ where: { id: p.id }, data: { sortOrder: k } })));
  revalidatePath("/", "layout");
}

// ---------- Billing ----------

/**
 * Prices and the global cancellation policy.
 *
 * Rates are keyed by (sessionType, durationMin) — the pair every booking
 * already carries — so the form posts one field per cell of the grid. A blank
 * cell deletes the rule, which makes that combination unsellable rather than
 * free; booking it then errors instead of quietly pricing at zero.
 */
const billingSchema = z.object({
  currency: z.string().trim().length(3, "Use a 3-letter currency code").toUpperCase(),
  cancellationNoticeHours: z.coerce.number().int().min(0).max(168),
  cancellationDepositPct: z.coerce.number().int().min(0).max(100),
  autoCompleteAfterHours: z.coerce.number().int().min(1).max(720),
});

/** "60" / "60.50" / "" → pence, or null for a blank cell. */
function parsePounds(raw: string): number | null | undefined {
  const v = raw.replace(/[£,\s]/g, "").trim();
  if (v === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return undefined; // invalid
  return Math.round(parseFloat(v) * 100);
}

export async function saveBillingSettings(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  await requireTrainer();
  const raw = Object.fromEntries(fd) as Record<string, string>;
  const parsed = billingSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;

  // Rate cells arrive as "rate:IN_PERSON:60".
  const writes: { sessionType: string; durationMin: number; amountPence: number }[] = [];
  const deletes: { sessionType: string; durationMin: number }[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith("rate:")) continue;
    const [, sessionType, duration] = key.split(":");
    const durationMin = Number(duration);
    if (!sessionType || !Number.isInteger(durationMin)) continue;
    const pence = parsePounds(String(value));
    if (pence === undefined) return { error: `"${value}" isn't a valid price — use a number like 60 or 60.50.` };
    if (pence === null) deletes.push({ sessionType, durationMin });
    else writes.push({ sessionType, durationMin, amountPence: pence });
  }

  await db.$transaction([
    db.trainerSettings.upsert({
      where: { id: "singleton" },
      update: d,
      create: { id: "singleton", ...d },
    }),
    ...writes.map((w) =>
      db.priceRule.upsert({
        where: { sessionType_durationMin: { sessionType: w.sessionType, durationMin: w.durationMin } },
        update: { amountPence: w.amountPence },
        create: w,
      }),
    ),
    ...deletes.map((x) =>
      db.priceRule.deleteMany({ where: { sessionType: x.sessionType, durationMin: x.durationMin } }),
    ),
  ]);

  revalidatePath("/trainer", "layout");
  revalidatePath("/app", "layout");
  return { ok: true };
}
