"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export type AccountState = { ok?: boolean; error?: string };

const profile = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  phone: z.string().trim().max(30).optional(),
  emergencyContact: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function saveProfile(_p: AccountState, fd: FormData): Promise<AccountState> {
  const user = await requireUser();
  const parsed = profile.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;
  await db.user.update({
    where: { id: user.id },
    data: { name: d.name, phone: d.phone || null, emergencyContact: d.emergencyContact || null, notes: d.notes || null },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Stored only for now — no mail service is wired up yet. Booking actions can read these when one is. */
export async function saveNotifications(_p: AccountState, fd: FormData): Promise<AccountState> {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: { notifyEmail: fd.get("notifyEmail") === "on", notifyReminders: fd.get("notifyReminders") === "on" },
  });
  revalidatePath("/account");
  return { ok: true };
}
