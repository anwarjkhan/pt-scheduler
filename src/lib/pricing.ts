import { db } from "@/lib/db";

/**
 * What a session costs.
 *
 * Money is integer minor units (pence) everywhere — never a Float. The schema
 * uses Float for coordinates and miles, which is right there and wrong here:
 * 0.1 + 0.2 must not be a question anyone asks about a price.
 *
 * Price is resolved once, when the booking is created, and snapshotted onto the
 * row. It is never recomputed: if the trainer raises rates on the 10th, a
 * session already booked for the 20th keeps the price the client agreed to.
 * That invariant is what makes a month-end statement reproducible.
 */

export type PricedSession = { sessionType: string; durationMin: number };

/** Resolution succeeded, or it failed with a reason the trainer can act on. */
export type PriceResult = { ok: true; amountPence: number; currency: string } | { ok: false; error: string };

/** The per-client override map: { "IN_PERSON:60": 5500 }. */
export type CustomRates = Record<string, number>;

/** Key into a client's customRates map. */
export function rateKey(sessionType: string, durationMin: number): string {
  return `${sessionType}:${durationMin}`;
}

/**
 * Read one rate out of a client's `customRates` JSON.
 *
 * The column is `Json?`, so anything could be in there — a hand-edited row, a
 * shape from an older version. Treat it as untrusted: only a positive integer
 * counts, everything else falls through to the standard rates rather than
 * throwing or, worse, pricing at zero.
 */
export function customRateFor(customRates: unknown, sessionType: string, durationMin: number): number | null {
  if (!customRates || typeof customRates !== "object" || Array.isArray(customRates)) return null;
  const raw = (customRates as Record<string, unknown>)[rateKey(sessionType, durationMin)];
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 ? raw : null;
}

/** Human-readable "no rate configured" message, used wherever resolution fails. */
export function missingRateMessage(sessionType: string, durationMin: number): string {
  const kind = sessionType === "ONLINE" ? "online" : "in-person";
  return `No rate is set for a ${durationMin}-minute ${kind} session. Set one in Settings → Billing.`;
}

/**
 * Pure resolution, given everything already loaded. Order is:
 * client override → standard rate → error.
 *
 * Never falls back to zero. A silent £0 session is far worse than a booking
 * that refuses to price, because nobody notices it until the statement.
 */
export function resolvePriceFrom(
  session: PricedSession,
  rules: { sessionType: string; durationMin: number; amountPence: number }[],
  currency: string,
  customRates?: unknown,
): PriceResult {
  const override = customRateFor(customRates, session.sessionType, session.durationMin);
  if (override !== null) return { ok: true, amountPence: override, currency };

  const rule = rules.find((r) => r.sessionType === session.sessionType && r.durationMin === session.durationMin);
  if (rule) return { ok: true, amountPence: rule.amountPence, currency };

  return { ok: false, error: missingRateMessage(session.sessionType, session.durationMin) };
}

/** Resolve one session's price, loading the rules and currency for you. */
export async function resolvePrice(session: PricedSession, clientId: string): Promise<PriceResult> {
  const [rules, settings, client] = await Promise.all([
    db.priceRule.findMany(),
    db.trainerSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
    db.user.findUnique({ where: { id: clientId }, select: { customRates: true } }),
  ]);
  return resolvePriceFrom(session, rules, settings.currency, client?.customRates);
}

/**
 * Resolve several sessions at once — one query set for a whole series, rather
 * than one per occurrence.
 */
export async function resolvePrices(sessions: PricedSession[], clientId: string): Promise<PriceResult[]> {
  const [rules, settings, client] = await Promise.all([
    db.priceRule.findMany(),
    db.trainerSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
    db.user.findUnique({ where: { id: clientId }, select: { customRates: true } }),
  ]);
  return sessions.map((s) => resolvePriceFrom(s, rules, settings.currency, client?.customRates));
}

/** Pence → "£60.00". Falls back to the ISO code for currencies with no symbol here. */
export function formatMoney(amountPence: number, currency = "GBP"): string {
  const symbols: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };
  const sign = amountPence < 0 ? "-" : "";
  const abs = Math.abs(amountPence);
  const symbol = symbols[currency];
  const n = (abs / 100).toFixed(2);
  return symbol ? `${sign}${symbol}${n}` : `${sign}${n} ${currency}`;
}

/** "£60.00" for a credit, "−£60.00" for a debit — used in the ledger. */
export function formatSigned(amountPence: number, currency = "GBP"): string {
  return amountPence < 0 ? `−${formatMoney(Math.abs(amountPence), currency)}` : `+${formatMoney(amountPence, currency)}`;
}
