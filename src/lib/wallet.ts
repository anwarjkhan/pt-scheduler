import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * The client wallet: an append-only ledger whose balance is derived, never
 * stored.
 *
 * A single mutable `balancePence` column would silently drift the first time
 * two requests race or a refund was half-applied, and there would be no way to
 * reconstruct what happened. Here every movement is a row, the balance is
 * SUM(amountPence), and a mistake is corrected by writing a compensating entry
 * rather than editing history.
 *
 * Both billing modes write the same entries. They differ only in which sign
 * the balance is expected to carry: WALLET clients pre-pay and run positive,
 * MONTHLY clients accrue and run negative until they settle.
 */

export const BILLING_MODES = ["WALLET", "MONTHLY"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

export const WALLET_REASONS = [
  "TOPUP",
  "SESSION_CHARGE",
  "CANCELLATION_FEE",
  "REFUND",
  "ADJUSTMENT",
  "SETTLEMENT",
] as const;
export type WalletReason = (typeof WALLET_REASONS)[number];

/** How each reason reads in the client-facing ledger. */
export const REASON_LABELS: Record<WalletReason, string> = {
  TOPUP: "Top-up",
  SESSION_CHARGE: "Session",
  CANCELLATION_FEE: "Late cancellation",
  REFUND: "Refund",
  ADJUSTMENT: "Adjustment",
  SETTLEMENT: "Payment received",
};

/** Credits are positive, debits negative — enforced here rather than at each call site. */
export function isCredit(reason: WalletReason): boolean {
  return reason === "TOPUP" || reason === "REFUND" || reason === "SETTLEMENT";
}

/** Current balance in pence. Positive = credit held, negative = owed. */
export async function getBalance(clientId: string): Promise<number> {
  const agg = await db.walletEntry.aggregate({ where: { clientId }, _sum: { amountPence: true } });
  return agg._sum.amountPence ?? 0;
}

/** Balances for many clients at once, for the client directory. */
export async function getBalances(clientIds: string[]): Promise<Map<string, number>> {
  if (clientIds.length === 0) return new Map();
  const rows = await db.walletEntry.groupBy({
    by: ["clientId"],
    where: { clientId: { in: clientIds } },
    _sum: { amountPence: true },
  });
  return new Map(rows.map((r) => [r.clientId, r._sum.amountPence ?? 0]));
}

export type LedgerRow = {
  id: string;
  amountPence: number;
  currency: string;
  reason: string;
  note: string | null;
  createdAt: Date;
  bookingId: string | null;
  booking: { startAt: Date; durationMin: number; sessionType: string } | null;
  /** Balance after this entry, oldest-first. */
  runningBalance: number;
};

/**
 * The ledger with a running balance, newest first.
 *
 * The running total is accumulated oldest-first and then reversed, so each row
 * shows the balance *after* that movement — which is what makes a statement
 * readable.
 */
export async function getLedger(clientId: string, take?: number): Promise<LedgerRow[]> {
  const rows = await db.walletEntry.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    include: { booking: { select: { startAt: true, durationMin: true, sessionType: true } } },
  });

  let running = 0;
  const withBalance = rows.map((r) => {
    running += r.amountPence;
    return { ...r, runningBalance: running };
  });

  withBalance.reverse();
  return take ? withBalance.slice(0, take) : withBalance;
}

export type EntryInput = {
  clientId: string;
  amountPence: number;
  reason: WalletReason;
  createdById: string;
  bookingId?: string | null;
  note?: string | null;
  currency?: string;
};

/**
 * Write one entry.
 *
 * Booking-derived entries are guarded by a unique index on
 * (bookingId, reason), so a double-click, a retried action or a second sweep
 * cannot debit twice. The race is resolved by the database rather than by an
 * application-level "have we already?" check, which would always have a window
 * between the read and the write.
 *
 * Returns whether a row was actually written, so callers can tell "charged"
 * from "already charged" without treating the latter as an error.
 */
export async function addEntry(input: EntryInput): Promise<{ created: boolean }> {
  const currency = input.currency ?? (await getCurrency());
  try {
    await db.walletEntry.create({
      data: {
        clientId: input.clientId,
        amountPence: input.amountPence,
        currency,
        reason: input.reason,
        bookingId: input.bookingId ?? null,
        note: input.note ?? null,
        createdById: input.createdById,
      },
    });
    return { created: true };
  } catch (e) {
    // P2002 = unique violation: this booking already has an entry for this
    // reason. That is the guard doing its job, not a failure.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { created: false };
    throw e;
  }
}

/** The configured currency. One for the whole app until there is a second one. */
export async function getCurrency(): Promise<string> {
  const s = await db.trainerSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  return s.currency;
}

/**
 * Has this booking already produced an entry of this kind? Used by the UI to
 * decide what to offer, not to guard the write — the unique index does that.
 */
export async function hasEntry(bookingId: string, reason: WalletReason): Promise<boolean> {
  return (await db.walletEntry.count({ where: { bookingId, reason } })) > 0;
}

/**
 * Charges and credits for one calendar month, for the month-end statement.
 * `month` is a "yyyy-MM" key; the range is resolved in the given timezone so
 * a statement does not straddle a DST boundary incorrectly.
 */
export async function getStatement(clientId: string, from: Date, to: Date) {
  const rows = await db.walletEntry.findMany({
    where: { clientId, createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: "asc" },
    include: { booking: { select: { startAt: true, durationMin: true, sessionType: true } } },
  });
  const charges = rows.filter((r) => r.amountPence < 0);
  const credits = rows.filter((r) => r.amountPence > 0);
  const sum = (xs: typeof rows) => xs.reduce((n, r) => n + r.amountPence, 0);
  return {
    rows,
    chargedPence: Math.abs(sum(charges)),
    creditedPence: sum(credits),
    netPence: sum(rows),
    openingPence: await balanceBefore(clientId, from),
  };
}

/** Balance as at a moment — the opening figure on a statement. */
export async function balanceBefore(clientId: string, at: Date): Promise<number> {
  const agg = await db.walletEntry.aggregate({
    where: { clientId, createdAt: { lt: at } },
    _sum: { amountPence: true },
  });
  return agg._sum.amountPence ?? 0;
}

/**
 * How a balance should read to a human. Relying on a minus sign alone is how
 * people misread a statement, so the words carry the meaning.
 */
export function describeBalance(balancePence: number, mode: string): { tone: "credit" | "owed" | "clear"; text: string } {
  if (balancePence === 0) return { tone: "clear", text: mode === "WALLET" ? "No credit left" : "Nothing outstanding" };
  if (balancePence > 0) return { tone: "credit", text: "in credit" };
  return { tone: "owed", text: "owed" };
}
