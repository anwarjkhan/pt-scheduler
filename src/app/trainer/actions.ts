"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTrainer } from "@/lib/session";
import { evaluateExistingBooking, loadDayContext } from "@/lib/bookings";
import { dateKey } from "@/lib/scheduling";
import { getSchedulingSettings } from "@/lib/settings";

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
  await syncSeriesStatus(b.seriesId);
  revalidate();
  return { ok: true, warnings: ev.warning ? ["Accepted with a tight commute — check your calendar."] : [] };
}

export async function declineBooking(id: string, reason?: string): Promise<TrainerActionResult> {
  await requireTrainer();
  const b = await db.booking.findUnique({ where: { id } });
  if (!b || b.status !== "PENDING") return { error: "Booking is no longer pending." };
  await db.booking.update({ where: { id }, data: { status: "DECLINED", trainerNote: reason || null } });
  await syncSeriesStatus(b.seriesId);
  revalidate();
  return { ok: true };
}

/** Trainer can cancel any upcoming booking at any time. */
export async function trainerCancelBooking(id: string, reason?: string): Promise<TrainerActionResult> {
  await requireTrainer();
  const b = await db.booking.findUnique({ where: { id } });
  if (!b || !["PENDING", "ACCEPTED"].includes(b.status)) return { error: "Booking can't be cancelled." };
  await db.booking.update({
    where: { id },
    data: { status: "CANCELLED_BY_TRAINER", cancelReason: reason || null, cancelledAt: new Date() },
  });
  await syncSeriesStatus(b.seriesId);
  revalidate();
  return { ok: true };
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

/** Derive series status from its occurrences. */
async function syncSeriesStatus(seriesId: string | null) {
  if (!seriesId) return;
  const rows = await db.booking.groupBy({ by: ["status"], where: { seriesId }, _count: true });
  const has = (s: string) => rows.some((r) => r.status === s && r._count > 0);
  const status = has("PENDING") ? "PENDING" : has("ACCEPTED") ? "ACCEPTED" : has("DECLINED") ? "DECLINED" : "CANCELLED";
  await db.bookingSeries.update({ where: { id: seriesId }, data: { status } });
}
