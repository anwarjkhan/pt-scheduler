"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTrainer } from "@/lib/session";
import { hhmmToMinutes } from "@/lib/scheduling";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "HH:mm");
const range = z
  .object({ startTime: hhmm, endTime: hhmm })
  .refine((r) => hhmmToMinutes(r.endTime) > hhmmToMinutes(r.startTime), { message: "End must be after start" });

export type ActionState = { ok?: boolean; error?: string };

function fail(e: z.ZodError): ActionState {
  return { error: e.issues.map((i) => i.message).join("; ") };
}

export async function addRule(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireTrainer();
  const parsed = z
    .object({ weekday: z.coerce.number().int().min(0).max(6) })
    .and(range)
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error);
  await db.availabilityRule.create({ data: parsed.data });
  revalidatePath("/trainer", "layout");
  return { ok: true };
}

export async function deleteRule(id: string) {
  await requireTrainer();
  await db.availabilityRule.delete({ where: { id } });
  revalidatePath("/trainer", "layout");
}

/** Replace all weekday rules with a simple Mon–Fri template. */
export async function applyDefaultTemplate() {
  await requireTrainer();
  await db.$transaction([
    db.availabilityRule.deleteMany(),
    db.availabilityRule.createMany({
      data: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "07:00", endTime: "20:00" })),
    }),
  ]);
  revalidatePath("/trainer", "layout");
}

export async function addException(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireTrainer();
  const raw = Object.fromEntries(fd) as Record<string, string>;
  const base = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    type: z.enum(["UNAVAILABLE", "EXTRA"]),
    note: z.string().max(200).optional(),
    allDay: z.string().optional(),
  });
  const parsed = base.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;

  let times: { startTime: string; endTime: string } | null = null;
  const allDay = d.allDay === "on";
  if (d.type === "EXTRA" || !allDay) {
    const r = range.safeParse({ startTime: raw.startTime, endTime: raw.endTime });
    if (!r.success) return fail(r.error);
    times = r.data;
  }

  await db.availabilityException.create({
    data: { date: d.date, type: d.type, note: d.note || null, startTime: times?.startTime ?? null, endTime: times?.endTime ?? null },
  });
  revalidatePath("/trainer", "layout");
  return { ok: true };
}

export async function deleteException(id: string) {
  await requireTrainer();
  await db.availabilityException.delete({ where: { id } });
  revalidatePath("/trainer", "layout");
}
