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
 * boundary. A row can be corrected in place, but the figures as first written
 * are kept and surfaced, so the history always reconstructs. There is
 * deliberately no delete: a removed row is one nobody can account for later.
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

/**
 * Correct a ledger row in place.
 *
 * The ledger is still reconstructable: the first edit captures the amount and
 * note as originally written, and later edits leave that untouched, so the
 * true original is never lost. The client sees the corrected figure with an
 * "edited" marker rather than a silent change.
 */
const editSchema = z.object({
  entryId: z.string().min(1),
  amount: poundsToPence.refine((n) => n !== 0, "An entry cannot be zero"),
  note: z.string().trim().max(200).optional(),
});

/**
 * Correcting an amount must not silently reverse its direction.
 *
 * The form shows a charge as a negative number, so a trainer fixing "-60.00"
 * by typing "120" means £120 *charged*, not £120 credited. Taking the
 * magnitude and reapplying the row's original sign keeps a typo from turning
 * a debit into a credit — which would move the balance by double the amount
 * and in the wrong direction.
 *
 * An adjustment is the one entry that is genuinely bidirectional, so there the
 * typed sign is honoured.
 */
function directedAmount(typed: number, existing: { amountPence: number; reason: string }): number {
  if (existing.reason === "ADJUSTMENT") return typed;
  const magnitude = Math.abs(typed);
  return existing.amountPence < 0 ? -magnitude : magnitude;
}

export async function editEntry(_prev: WalletActionState, fd: FormData): Promise<WalletActionState> {
  const trainer = await requireTrainer();
  const parsed = editSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;

  const existing = await db.walletEntry.findUnique({ where: { id: d.entryId } });
  if (!existing) return { error: "That entry no longer exists." };

  // A card payment is a record of money Stripe actually moved. Editing it
  // would put the ledger out of step with the payment processor, so corrections
  // there go through an adjustment instead.
  if (existing.stripeSessionId) {
    return { error: "Card payments can't be edited — add an adjustment instead, so the ledger still matches Stripe." };
  }

  await db.walletEntry.update({
    where: { id: d.entryId },
    data: {
      amountPence: directedAmount(d.amount, existing),
      note: d.note || null,
      editedAt: new Date(),
      editedById: trainer.id,
      // Only on the first edit, so the original survives repeated corrections.
      originalAmountPence: existing.originalAmountPence ?? existing.amountPence,
      originalNote: existing.originalNote ?? existing.note,
    },
  });

  revalidatePath("/trainer", "layout");
  revalidatePath("/app", "layout");
  return { ok: true, message: "Entry updated." };
}

/**
 * Close out a wallet: zero the balance and record why.
 *
 * Refunds are handled offline — the trainer hands back the money however they
 * normally would — so this is the bookkeeping half of that. Writing a single
 * CLEARDOWN entry keeps the ledger's sum honest without pretending the app
 * moved any money.
 */
const clearDownSchema = z.object({
  clientId: z.string().min(1),
  note: z.string().trim().min(1, "Say what happened to the balance").max(200),
});

export async function clearDownWallet(_prev: WalletActionState, fd: FormData): Promise<WalletActionState> {
  const trainer = await requireTrainer();
  const parsed = clearDownSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;

  const balance = await getBalance(d.clientId);
  if (balance === 0) return { error: "This wallet is already at zero." };

  await addEntry({
    clientId: d.clientId,
    // The inverse of whatever is there, so the balance lands exactly on zero.
    amountPence: -balance,
    reason: "CLEARDOWN",
    createdById: trainer.id,
    note: d.note,
  });

  revalidatePath("/trainer", "layout");
  revalidatePath("/app", "layout");
  return {
    ok: true,
    message:
      balance > 0
        ? `Cleared ${formatMoney(balance)} of credit. Balance is now zero.`
        : `Wrote off ${formatMoney(Math.abs(balance))}. Balance is now zero.`,
  };
}

/**
 * Leave a client out of health scoring, or put them back in.
 *
 * The numbers are sometimes wrong about a person — illness, bereavement, a
 * long planned break — and repeated cancellations then say nothing about
 * whether they are a good client. The reason is private to the trainer and is
 * never rendered on a client-facing page.
 */
const exemptionSchema = z.object({
  clientId: z.string().min(1),
  exempt: z.enum(["true", "false"]).transform((v) => v === "true"),
  reason: z.string().trim().max(200).optional(),
});

export async function saveHealthExemption(_prev: WalletActionState, fd: FormData): Promise<WalletActionState> {
  await requireTrainer();
  const parsed = exemptionSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;

  await db.user.update({
    where: { id: d.clientId },
    data: {
      healthExempt: d.exempt,
      // Clear the note when scoring resumes, so a stale reason cannot reappear
      // the next time someone is exempted.
      healthExemptReason: d.exempt ? d.reason || null : null,
    },
  });

  revalidatePath("/trainer", "layout");
  return { ok: true, message: d.exempt ? "Left out of scoring." : "Scoring resumed." };
}
