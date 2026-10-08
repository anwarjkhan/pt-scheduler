import { minutesBetween } from "@/lib/scheduling";

/**
 * The cancellation policy: how late a client may cancel for free, and what
 * they owe if they cancel after that.
 *
 * Deliberately separate from `minNoticeHours` in src/lib/scheduling/rules.ts.
 * That one answers "how far ahead must you book?"; this one answers "how late
 * can you cancel free?". They were the same number once — `meetsMinNotice` is
 * literally `canClientCancel` aliased — but they are different questions with
 * different answers, and conflating them would produce wrong charges.
 *
 * Pure functions, no DB, following the src/lib/scheduling pattern so the
 * awkward cases can be unit-tested directly.
 */

export type Policy = {
  /** Hours before the session start, inside which a cancellation is charged. */
  noticeHours: number;
  /** Percent of the session price charged for a late cancellation. */
  depositPct: number;
};

/** The global defaults, as stored on TrainerSettings. */
export type GlobalPolicy = { cancellationNoticeHours: number; cancellationDepositPct: number };

/** A client's overrides. Either field may be null, meaning "inherit". */
export type ClientPolicy = { cancellationNoticeHours?: number | null; cancellationDepositPct?: number | null };

/**
 * The policy in force for one client: each field is their override when set,
 * otherwise the global default. The two fields resolve independently, so a
 * client can have a longer window on the standard deposit, or vice versa.
 */
export function resolvePolicy(client: ClientPolicy | null | undefined, global: GlobalPolicy): Policy {
  return {
    noticeHours: client?.cancellationNoticeHours ?? global.cancellationNoticeHours,
    depositPct: client?.cancellationDepositPct ?? global.cancellationDepositPct,
  };
}

/** True when the client has an override on either field — shown in the trainer UI. */
export function hasOverride(client: ClientPolicy | null | undefined): boolean {
  return client?.cancellationNoticeHours != null || client?.cancellationDepositPct != null;
}

/**
 * Is this cancellation inside the charging window?
 *
 * Mirrors `canClientCancel`: the boundary is inclusive, so cancelling at
 * exactly the notice mark is still free. A session already in the past is
 * always late.
 */
export function isLateCancellation(startAt: Date, policy: Policy, now: Date = new Date()): boolean {
  return minutesBetween(now, startAt) < policy.noticeHours * 60;
}

/**
 * The moment after which cancelling starts costing money — for "Free to cancel
 * until Tue 14:00" in the confirm dialog.
 */
export function freeUntil(startAt: Date, policy: Policy): Date {
  return new Date(startAt.getTime() - policy.noticeHours * 60 * 60 * 1000);
}

/**
 * What the client owes for cancelling now. Zero outside the window.
 *
 * Rounding is an explicit `Math.round` on the pence, stated here so it is not
 * a mystery later: 40% of £60.01 is 2400.4 pence, charged as £24.00. Rounding
 * on money is exactly the kind of thing nobody notices until a client disputes
 * a penny.
 *
 * A null price means a legacy booking from before pricing existed — those are
 * never chargeable.
 */
export function cancellationFeePence(
  startAt: Date,
  pricePence: number | null | undefined,
  policy: Policy,
  now: Date = new Date(),
): number {
  if (pricePence == null || pricePence <= 0) return 0;
  if (!isLateCancellation(startAt, policy, now)) return 0;
  const pct = Math.max(0, Math.min(100, policy.depositPct));
  return Math.round((pricePence * pct) / 100);
}

/**
 * What a no-show costs.
 *
 * A no-show is charged as a late cancellation — the same deposit percentage —
 * rather than the full session price. The client never turned up, so the
 * notice window is irrelevant: the fee always applies.
 */
export function noShowFeePence(pricePence: number | null | undefined, policy: Policy): number {
  if (pricePence == null || pricePence <= 0) return 0;
  const pct = Math.max(0, Math.min(100, policy.depositPct));
  return Math.round((pricePence * pct) / 100);
}
