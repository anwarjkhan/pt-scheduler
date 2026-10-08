"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTrainer } from "@/lib/session";
import { addEntry, getBalance, BILLING_MODES } from "@/lib/wallet";
import { formatMoney } from "@/lib/pricing";

/**
 * Trainer-side wallet operations.
 *
 * All of these record money that moved elsewhere — a bank transfer, cash at
 * the session. Nothing here talks to a card processor; see the plan's scope
 * boundary. The ledger is append-only, so there is deliberately no "edit
 * entry" or "delete entry" action: a mistake is corrected with an adjustment,
 * which leaves both the error and the correction visible.
 */

export type WalletActionState = { ok?: boolean; error?: string; message?: string };

/** Pounds as typed by a human ("60", "60.50", "£60") → integer pence. */
const poundsToPence = z
  .string()
  .trim()
  .transform((v) => v.replace(/[£,\s]/g, ""))
  .refine((v) => /^-?\d+(\.\d{1,2})?$/.test(v), "Enter an amount like 60 or 60.50")
  .transform((v) => Math.round(parseFloat(v) * 100));

const topUpSchema = z.object({
  clientId: z.string().min(1),
  amount: poundsToPence.refine((n) => n > 0, "A top-up must be more than zero"),
  note: z.string().trim().max(200).optional(),
});

/** Record money received from the client, crediting their wallet. */
export async function recordTopUp(_prev: WalletActionState, fd: FormData): Promise<WalletActionState> {
  const trainer = await requireTrainer();
  const parsed = topUpSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;

  await addEntry({
    clientId: d.clientId,
    amountPence: d.amount,
    reason: "TOPUP",
    createdById: trainer.id,
    note: d.note || null,
  });

  revalidatePath("/trainer", "layout");
  revalidatePath("/app", "layout");
  return { ok: true, message: `Added ${formatMoney(d.amount)} to the wallet.` };
}

const adjustmentSchema = z.object({
  clientId: z.string().min(1),
  amount: poundsToPence.refine((n) => n !== 0, "An adjustment cannot be zero"),
  // Required, unlike a top-up: an unexplained correction is the one entry
  // nobody will be able to account for later.
  note: z.string().trim().min(1, "Say what this adjustment is for").max(200),
});

/** A goodwill credit or a manual correction. Always carries a reason. */
export async function recordAdjustment(_prev: WalletActionState, fd: FormData): Promise<WalletActionState> {
  const trainer = await requireTrainer();
  const parsed = adjustmentSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;

  await addEntry({
    clientId: d.clientId,
    amountPence: d.amount,
    reason: "ADJUSTMENT",
    createdById: trainer.id,
    note: d.note,
  });

  revalidatePath("/trainer", "layout");
  revalidatePath("/app", "layout");
  return { ok: true, message: `Recorded an adjustment of ${formatMoney(d.amount)}.` };
}

const settleSchema = z.object({
  clientId: z.string().min(1),
  amount: poundsToPence.refine((n) => n > 0, "A payment must be more than zero"),
  note: z.string().trim().max(200).optional(),
});

/**
 * Record a month-end payment, clearing what the client owes.
 *
 * Defaults to the outstanding amount but accepts any figure, because part
 * payments happen and refusing them would push the trainer into using an
 * adjustment for something that is plainly a payment.
 */
export async function recordSettlement(_prev: WalletActionState, fd: FormData): Promise<WalletActionState> {
  const trainer = await requireTrainer();
  const parsed = settleSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;

  await addEntry({
    clientId: d.clientId,
    amountPence: d.amount,
    reason: "SETTLEMENT",
    createdById: trainer.id,
    note: d.note || null,
  });

  const balance = await getBalance(d.clientId);
  revalidatePath("/trainer", "layout");
  revalidatePath("/app", "layout");
  return {
    ok: true,
    message:
      balance >= 0
        ? `Recorded ${formatMoney(d.amount)}. Nothing outstanding.`
        : `Recorded ${formatMoney(d.amount)}. ${formatMoney(Math.abs(balance))} still outstanding.`,
  };
}

/** Blank means "inherit the global default" — not zero. */
const optionalInt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((n) => n === null || (Number.isInteger(n) && n >= 0), "Must be a whole number, or blank to use the default");

const billingSchema = z.object({
  clientId: z.string().min(1),
  billingMode: z.enum(BILLING_MODES),
  cancellationNoticeHours: optionalInt.refine((n) => n === null || n <= 168, "Keep the notice period under a week"),
  cancellationDepositPct: optionalInt.refine((n) => n === null || n <= 100, "A deposit cannot exceed 100%"),
});

/** Billing mode and the per-client cancellation overrides. */
export async function saveClientBilling(_prev: WalletActionState, fd: FormData): Promise<WalletActionState> {
  await requireTrainer();
  const parsed = billingSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;

  await db.user.update({
    where: { id: d.clientId },
    data: {
      billingMode: d.billingMode,
      cancellationNoticeHours: d.cancellationNoticeHours,
      cancellationDepositPct: d.cancellationDepositPct,
    },
  });

  revalidatePath("/trainer", "layout");
  revalidatePath("/app", "layout");
  return { ok: true, message: "Billing settings saved." };
}
