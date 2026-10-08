"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTrainer } from "@/lib/session";
import { bookingInclude, evaluateExistingBooking, loadDayContext } from "@/lib/bookings";
import { dateKey, zoned } from "@/lib/scheduling";
import { getSchedulingSettings, getTrainerSettings } from "@/lib/settings";
import { dropRoom, provisionRoomSafely } from "@/lib/video";
import { formatMoney } from "@/lib/pricing";
import { noShowFeePence, resolvePolicy } from "@/lib/cancellation";
import { addEntry, hasEntry } from "@/lib/wallet";

export type TrainerActionResult = { ok?: boolean; error?: string; warnings?: string[] };

function revalidate() {
  revalidatePath("/app", "layout");
  revalidatePath("/trainer", "layout");
}

/** Accept a single booking. Refuses if it now hard-overlaps another accepted session. */
export async function acceptBooking(id: string): Promise<TrainerActionResult> {
  await requireTrainer();
  const b = await db.booking.findUnique({ where: { id }, include: { location: true, client: true, series: true } });
  if (!b || b.status !== "PENDING") return { error: "Booking is no longer pending." };

  const { timezone } = await getSchedulingSettings();
  const ctx = await loadDayContext(dateKey(b.startAt, timezone));
  // Only ACCEPTED sessions block acceptance; other pending requests are competing, not blocking.
  ctx.existing = ctx.existing.filter((x) => x.status === "ACCEPTED");
  const ev = await evaluateExistingBooking(b, ctx);
  if (ev.overlaps) return { error: "This clashes with a session you've already confirmed." };

  await db.booking.update({ where: { id }, data: { status: "ACCEPTED" } });
  // One-off online sessions get their room now; a failure here is logged, not
  // fatal — the join route recreates it on demand.
  await provisionRoomSafely(b);
  await syncSeriesStatus(b.seriesId);
  revalidate();
  return { ok: true, warnings: ev.warning ? ["Accepted with a tight commute — check your calendar."] : [] };
}

export async function declineBooking(id: string, reason?: string): Promise<TrainerActionResult> {
  await requireTrainer();
  const b = await db.booking.findUnique({ where: { id } });
  if (!b || b.status !== "PENDING") return { error: "Booking is no longer pending." };
  await db.booking.update({ where: { id }, data: { status: "DECLINED", trainerNote: reason || null } });
  await dropRoom(id);
  await syncSeriesStatus(b.seriesId);
  revalidate();
  return { ok: true };
}

/**
 * Trainer can cancel any upcoming booking at any time.
 *
 * The client is never charged for the trainer's own cancellation — and if a
 * fee had already been taken for this session, it is refunded here. The refund
 * is a compensating entry rather than a deletion, so the history still shows
 * what happened.
 */
export async function trainerCancelBooking(id: string, reason?: string): Promise<TrainerActionResult> {
  const trainer = await requireTrainer();
  const b = await db.booking.findUnique({ where: { id } });
  if (!b || !["PENDING", "ACCEPTED"].includes(b.status)) return { error: "Booking can't be cancelled." };
  await db.booking.update({
    where: { id },
    data: { status: "CANCELLED_BY_TRAINER", cancelReason: reason || null, cancelledAt: new Date() },
  });

  const warnings = await refundBookingCharges(b.id, b.clientId, trainer.id, "Refunded — session cancelled by your trainer");

  await dropRoom(id);
  await syncSeriesStatus(b.seriesId);
  revalidate();
  return { ok: true, warnings };
}

/**
 * Reverse every debit this booking produced. Returns a note for the trainer
 * when something was actually given back, so a refund is never silent.
 */
async function refundBookingCharges(bookingId: string, clientId: string, byId: string, note: string): Promise<string[]> {
  const debits = await db.walletEntry.findMany({ where: { bookingId, amountPence: { lt: 0 } } });
  const already = await db.walletEntry.aggregate({
    where: { bookingId, reason: "REFUND" },
    _sum: { amountPence: true },
  });
  const owed = Math.abs(debits.reduce((n, d) => n + d.amountPence, 0)) - (already._sum.amountPence ?? 0);
  if (owed <= 0) return [];

  // One REFUND row per booking, so the (bookingId, reason) guard applies.
  const { created } = await addEntry({
    clientId,
    amountPence: owed,
    reason: "REFUND",
    bookingId,
    createdById: byId,
    note,
    currency: debits[0]?.currency,
  });
  return created ? [`Refunded ${formatMoney(owed, debits[0]?.currency ?? "GBP")} to the client's wallet.`] : [];
}

/**
 * Mark a session as done. This is the moment it becomes chargeable, so it is a
 * persisted event rather than something derived from the clock: a derived
 * status would re-debit on every page render and leave no audit trail.
 *
 * Idempotent — the unique (bookingId, reason) index means a double-click or a
 * later sweep cannot charge twice.
 */
export async function completeBooking(id: string): Promise<TrainerActionResult> {
  const trainer = await requireTrainer();
  const b = await db.booking.findUnique({ where: { id } });
  if (!b) return { error: "Session not found." };
  if (!["ACCEPTED", "COMPLETED"].includes(b.status)) return { error: "Only confirmed sessions can be completed." };
  if (b.endAt > new Date()) return { error: "That session hasn't finished yet." };

  await db.booking.update({ where: { id }, data: { status: "COMPLETED", completedAt: b.completedAt ?? new Date() } });
  const warnings = await chargeForSession(b, trainer.id);
  revalidate();
  return { ok: true, warnings };
}

/**
 * Mark a session as a no-show.
 *
 * Charged as a late cancellation — the deposit percentage, not the full price.
 * The session is still COMPLETED (the slot was used up), with `noShow` set so
 * history can tell the two apart.
 */
export async function markNoShow(id: string): Promise<TrainerActionResult> {
  const trainer = await requireTrainer();
  const b = await db.booking.findUnique({ where: { id } });
  if (!b) return { error: "Session not found." };
  if (!["ACCEPTED", "COMPLETED"].includes(b.status)) return { error: "Only confirmed sessions can be marked as a no-show." };
  if (b.endAt > new Date()) return { error: "That session hasn't finished yet." };
  if (await hasEntry(id, "SESSION_CHARGE")) {
    return { error: "This session was already charged in full. Add an adjustment on the client's wallet instead." };
  }

  await db.booking.update({
    where: { id },
    data: { status: "COMPLETED", noShow: true, completedAt: b.completedAt ?? new Date() },
  });

  const [settings, client] = await Promise.all([
    getTrainerSettings(),
    db.user.findUnique({ where: { id: b.clientId }, select: { cancellationNoticeHours: true, cancellationDepositPct: true } }),
  ]);
  const policy = resolvePolicy(client, settings);
  const fee = noShowFeePence(b.priceAmountPence, policy);
  const warnings: string[] = [];

  if (fee > 0) {
    const { created } = await addEntry({
      clientId: b.clientId,
      amountPence: -fee,
      reason: "CANCELLATION_FEE",
      bookingId: b.id,
      createdById: trainer.id,
      note: `No-show (${policy.depositPct}% of ${formatMoney(b.priceAmountPence ?? 0, settings.currency)})`,
      currency: b.priceCurrency ?? settings.currency,
    });
    if (created) warnings.push(`Charged ${formatMoney(fee, b.priceCurrency ?? settings.currency)} as a no-show fee.`);
  } else if (b.priceAmountPence == null) {
    warnings.push("This session predates pricing, so nothing was charged.");
  }

  revalidate();
  return { ok: true, warnings };
}

/**
 * Debit the client for a completed session. Shared by the trainer action and
 * the sweep, so both charge identically.
 */
async function chargeForSession(
  b: { id: string; clientId: string; priceAmountPence: number | null; priceCurrency: string | null; noShow: boolean },
  byId: string,
): Promise<string[]> {
  // A no-show is charged by markNoShow at the deposit rate; never also charge
  // it in full here.
  if (b.noShow) return [];
  if (b.priceAmountPence == null) return ["This session predates pricing, so nothing was charged."];
  if (b.priceAmountPence <= 0) return [];

  const { created } = await addEntry({
    clientId: b.clientId,
    amountPence: -b.priceAmountPence,
    reason: "SESSION_CHARGE",
    bookingId: b.id,
    createdById: byId,
    currency: b.priceCurrency ?? undefined,
  });
  return created ? [`Charged ${formatMoney(b.priceAmountPence, b.priceCurrency ?? "GBP")} to the client's wallet.`] : [];
}

/**
 * Complete sessions the trainer never ticked off.
 *
 * Trainers will not mark every box, and an uncharged session is a silently
 * lost fee. This runs lazily from the pages that load anyway — the codebase
 * has no cron — and is safe to call repeatedly: the status filter stops it
 * re-processing, and the ledger's unique index stops any double charge.
 */
export async function sweepCompletedSessions(): Promise<number> {
  const settings = await getTrainerSettings();
  const cutoff = new Date(Date.now() - settings.autoCompleteAfterHours * 60 * 60 * 1000);
  const due = await db.booking.findMany({ where: { status: "ACCEPTED", endAt: { lt: cutoff } }, take: 200 });
  if (due.length === 0) return 0;

  for (const b of due) {
    await db.booking.update({ where: { id: b.id }, data: { status: "COMPLETED", completedAt: b.completedAt ?? b.endAt } });
    await chargeForSession(b, "system");
  }
  return due.length;
}

/**
 * Accept every pending occurrence in a series, optionally skipping (declining) specific ones.
 * Occurrences that now overlap a confirmed session are declined automatically and reported.
 */
export async function acceptSeries(seriesId: string, skipIds: string[] = []): Promise<TrainerActionResult> {
  await requireTrainer();
  const pending = await db.booking.findMany({
    where: { seriesId, status: "PENDING" },
    include: { location: true, client: true, series: true },
    orderBy: { startAt: "asc" },
  });
  if (pending.length === 0) return { error: "Nothing pending in this series." };

  const { timezone } = await getSchedulingSettings();
  const warnings: string[] = [];
  const skip = new Set(skipIds);
  for (const b of pending) {
    if (skip.has(b.id)) {
      await db.booking.update({ where: { id: b.id }, data: { status: "DECLINED" } });
      continue;
    }
    const ctx = await loadDayContext(dateKey(b.startAt, timezone));
    ctx.existing = ctx.existing.filter((x) => x.status === "ACCEPTED");
    const ev = await evaluateExistingBooking(b, ctx);
    if (ev.overlaps) {
      await db.booking.update({ where: { id: b.id }, data: { status: "DECLINED", trainerNote: "Clashed with a confirmed session" } });
      warnings.push(`${dateKey(b.startAt, timezone)} declined — clashes with a confirmed session.`);
      continue;
    }
    await db.booking.update({ where: { id: b.id }, data: { status: "ACCEPTED" } });
    if (ev.warning) warnings.push(`${dateKey(b.startAt, timezone)} accepted with a tight commute.`);
  }
  await syncSeriesStatus(seriesId);
  revalidate();
  return { ok: true, warnings };
}

export async function declineSeries(seriesId: string, reason?: string): Promise<TrainerActionResult> {
  await requireTrainer();
  await db.booking.updateMany({ where: { seriesId, status: "PENDING" }, data: { status: "DECLINED", trainerNote: reason || null } });
  await syncSeriesStatus(seriesId);
  revalidate();
  return { ok: true };
}

/**
 * Move a booking to a new start time on the same day, keeping its duration.
 * Re-runs the scheduling rules: a hard overlap or a slot outside availability is
 * refused, a tight commute is allowed but reported — the same contract as accept.
 */
export async function rescheduleBooking(id: string, startTime: string): Promise<TrainerActionResult> {
  await requireTrainer();
  if (!/^\d{2}:\d{2}$/.test(startTime)) return { error: "Invalid time." };

  const b = await db.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!b) return { error: "Booking not found." };
  if (!["PENDING", "ACCEPTED"].includes(b.status)) return { error: "Only pending or confirmed sessions can be moved." };

  const { timezone } = await getSchedulingSettings();
  const date = dateKey(b.startAt, timezone);
  const start = zoned(date, startTime, timezone);
  if (start.getTime() === b.startAt.getTime()) return { ok: true };

  const durationMin = Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60000);
  const end = new Date(start.getTime() + durationMin * 60000);

  // Evaluate the proposed position. Only confirmed sessions block a move —
  // other pending requests are competing for the slot, not holding it (same
  // rule as acceptBooking).
  const ctx = await loadDayContext(date);
  ctx.existing = ctx.existing.filter((x) => x.status === "ACCEPTED");
  const ev = await evaluateExistingBooking({ ...b, startAt: start, endAt: end }, ctx);
  if (ev.overlaps) return { error: "That clashes with another session." };
  if (ev.outsideAvailability) return { error: "That's outside your available hours." };

  await db.booking.update({ where: { id }, data: { startAt: start, endAt: end } });
  // The room's join window was bound to the old times, so drop it — the join
  // route mints a fresh one against the new slot.
  await dropRoom(id);
  revalidate();
  return {
    ok: true,
    warnings: ev.warning ? ["Moved, but the commute is now tight — check the gap either side."] : [],
  };
}

/** Derive series status from its occurrences. */
async function syncSeriesStatus(seriesId: string | null) {
  if (!seriesId) return;
  const rows = await db.booking.groupBy({ by: ["status"], where: { seriesId }, _count: true });
  const has = (s: string) => rows.some((r) => r.status === s && r._count > 0);
  const status = has("PENDING") ? "PENDING" : has("ACCEPTED") ? "ACCEPTED" : has("DECLINED") ? "DECLINED" : "CANCELLED";
  await db.bookingSeries.update({ where: { id: seriesId }, data: { status } });
}
