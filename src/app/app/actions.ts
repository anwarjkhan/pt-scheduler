"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCommute } from "@/lib/maps";
import { requireUser } from "@/lib/session";
import { loadDayContext, sessionCoords, SESSION_TYPES } from "@/lib/bookings";
import { getSchedulingSettings, getTrainerSettings } from "@/lib/settings";
import { dropRoom } from "@/lib/video";
import { resolvePrice, formatMoney } from "@/lib/pricing";
import { cancellationFeePence, freeUntil, resolvePolicy } from "@/lib/cancellation";
import { addEntry, getBalance } from "@/lib/wallet";
import {
  addMinutes,
  dateKey,
  DURATIONS,
  evaluateSlot,
  expandSeries,
  MAX_SERIES_WEEKS,
  meetsMinNotice,
  timeKey,
  weekdayOf,
  type SlotEvaluation,
} from "@/lib/scheduling";

export type BookingResult = {
  ok?: boolean;
  error?: string;
  warning?: boolean;
  bookingId?: string;
  /** Set when a wallet client's booking takes them below zero. Warns, never blocks. */
  balanceWarning?: string;
};

/**
 * A wallet client booking beyond their credit is warned, not blocked — losing a
 * booking over a timing accident is worse than a temporarily negative balance.
 * This mirrors how the scheduling engine treats a tight commute: permit with a
 * caveat. MONTHLY clients accrue by design, so they are never warned.
 */
async function lowBalanceWarning(clientId: string, costPence: number, currency: string): Promise<string | undefined> {
  const client = await db.user.findUnique({ where: { id: clientId }, select: { billingMode: true } });
  if (client?.billingMode !== "WALLET") return undefined;
  const balance = await getBalance(clientId);
  if (balance >= costPence) return undefined;
  const shortfall = costPence - balance;
  return `This session costs ${formatMoney(costPence, currency)} and your balance is ${formatMoney(balance, currency)} — ${formatMoney(shortfall, currency)} short. You can still book; settle up with your trainer.`;
}

const single = z.object({
  locationId: z.string().min(1),
  sessionType: z.enum(SESSION_TYPES).default("IN_PERSON"),
  start: z.string().datetime(),
  duration: z.coerce.number().refine((n) => (DURATIONS as readonly number[]).includes(n), "Invalid duration"),
  note: z.string().max(300).optional(),
});

/** Validate a candidate against availability, overlaps and notice. Returns the evaluation or an error string. */
async function validateCandidate(userId: string, locationId: string, start: Date, duration: number, sessionType: string = "IN_PERSON") {
  const loc = await db.location.findFirst({ where: { id: locationId, userId } });
  if (!loc) return { error: "Location not found." } as const;

  const { timezone } = await getSchedulingSettings();
  const ctx = await loadDayContext(dateKey(start, timezone));
  const end = addMinutes(start, duration);
  if (!meetsMinNotice(start, ctx.settings.minNoticeHours)) {
    return { error: `Bookings need at least ${ctx.settings.minNoticeHours} hours' notice.` } as const;
  }
  // Online sessions are run from the trainer's home, so they are evaluated
  // there — which makes the engine reserve the drive back from a preceding
  // in-person session.
  const loc0 = sessionCoords(sessionType, loc, ctx.settings.home);
  const evaluation = await evaluateSlot({ start, end, loc: loc0 }, ctx.existing, ctx.windows, ctx.settings, getCommute);
  if (evaluation.overlaps) return { error: "That time has just been taken. Please pick another slot." } as const;
  if (evaluation.outsideAvailability) return { error: "That time is outside your trainer's availability." } as const;
  return { evaluation, end, loc, ctx } as const;
}

export async function createBooking(input: z.infer<typeof single>): Promise<BookingResult> {
  const user = await requireUser();
  const parsed = single.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;
  const start = new Date(d.start);

  const v = await validateCandidate(user.id, d.locationId, start, d.duration, d.sessionType);
  if ("error" in v) return { error: v.error };

  // Price is resolved once, here, and snapshotted onto the row — a later rate
  // change must never alter what the client agreed to.
  const price = await resolvePrice({ sessionType: d.sessionType, durationMin: d.duration }, user.id);
  if (!price.ok) return { error: price.error };

  const booking = await db.booking.create({
    data: {
      clientId: user.id,
      locationId: d.locationId,
      sessionType: d.sessionType,
      startAt: start,
      endAt: v.end,
      durationMin: d.duration,
      clientNote: d.note || null,
      status: "PENDING",
      priceAmountPence: price.amountPence,
      priceCurrency: price.currency,
    },
  });
  revalidatePath("/app", "layout");
  revalidatePath("/trainer", "layout");
  return {
    ok: true,
    warning: v.evaluation.warning,
    bookingId: booking.id,
    balanceWarning: await lowBalanceWarning(user.id, price.amountPence, price.currency),
  };
}

// ---------- Recurring series ----------

const seriesInput = z.object({
  locationId: z.string().min(1),
  sessionType: z.enum(SESSION_TYPES).default("IN_PERSON"),
  firstStart: z.string().datetime(), // the first occurrence, chosen from the calendar
  duration: z.coerce.number().refine((n) => (DURATIONS as readonly number[]).includes(n)),
  weeks: z.coerce.number().int().min(2).max(MAX_SERIES_WEEKS),
  note: z.string().max(300).optional(),
});

export type OccurrencePreview = {
  date: string;
  start: string;
  status: "ok" | "warning" | "unavailable" | "taken";
  evaluation?: SlotEvaluation;
};

/** Dry-run a series so the client sees which weeks will be skipped or flagged before committing. */
export async function previewSeries(input: z.infer<typeof seriesInput>): Promise<{ error?: string; occurrences?: OccurrencePreview[] }> {
  const user = await requireUser();
  const parsed = seriesInput.safeParse(input);
  if (!parsed.success) return { error: "Invalid series." };
  const d = parsed.data;
  const loc = await db.location.findFirst({ where: { id: d.locationId, userId: user.id } });
  if (!loc) return { error: "Location not found." };

  const first = new Date(d.firstStart);
  const { timezone: tz } = await getSchedulingSettings();
  const startDate = dateKey(first, tz);
  const occ = expandSeries(
    {
      weekday: weekdayOf(startDate, tz),
      startTime: timeKey(first, tz),
      durationMin: d.duration,
      startDate,
      endDate: dateKey(addMinutes(first, (d.weeks - 1) * 7 * 24 * 60), tz),
    },
    tz,
  );

  const out: OccurrencePreview[] = [];
  for (const o of occ) {
    const ctx = await loadDayContext(o.date);
    const ev = await evaluateSlot(
      { start: o.start, end: o.end, loc: sessionCoords(d.sessionType, loc, ctx.settings.home) },
      ctx.existing,
      ctx.windows,
      ctx.settings,
      getCommute,
    );
    const status: OccurrencePreview["status"] = ev.outsideAvailability
      ? "unavailable"
      : ev.overlaps
        ? "taken"
        : ev.warning
          ? "warning"
          : "ok";
    out.push({ date: o.date, start: o.start.toISOString(), status, evaluation: ev });
  }
  return { occurrences: out };
}

export async function createSeries(input: z.infer<typeof seriesInput>): Promise<BookingResult & { created?: number; skipped?: number }> {
  const user = await requireUser();
  const parsed = seriesInput.safeParse(input);
  if (!parsed.success) return { error: "Invalid series." };
  const d = parsed.data;

  const preview = await previewSeries(d);
  if (preview.error || !preview.occurrences) return { error: preview.error ?? "Could not build series." };
  const bookable = preview.occurrences.filter((o) => o.status === "ok" || o.status === "warning");
  if (bookable.length === 0) return { error: "None of the requested weeks are available." };

  const first = new Date(d.firstStart);
  const { timezone: tz, minNoticeHours } = await getSchedulingSettings();
  if (!meetsMinNotice(first, minNoticeHours)) {
    return { error: `The first session needs at least ${minNoticeHours} hours' notice.` };
  }
  // Every occurrence is the same pair, so one resolution covers the series.
  const price = await resolvePrice({ sessionType: d.sessionType, durationMin: d.duration }, user.id);
  if (!price.ok) return { error: price.error };

  const startDate = dateKey(first, tz);
  const series = await db.bookingSeries.create({
    data: {
      clientId: user.id,
      locationId: d.locationId,
      sessionType: d.sessionType,
      weekday: weekdayOf(startDate, tz),
      startTime: timeKey(first, tz),
      durationMin: d.duration,
      startDate,
      endDate: preview.occurrences[preview.occurrences.length - 1].date,
      status: "PENDING",
      bookings: {
        create: bookable.map((o) => ({
          clientId: user.id,
          locationId: d.locationId,
          sessionType: d.sessionType,
          startAt: new Date(o.start),
          endAt: addMinutes(new Date(o.start), d.duration),
          durationMin: d.duration,
          clientNote: d.note || null,
          status: "PENDING",
          priceAmountPence: price.amountPence,
          priceCurrency: price.currency,
        })),
      },
    },
  });
  revalidatePath("/app", "layout");
  revalidatePath("/trainer", "layout");
  return {
    ok: true,
    bookingId: series.id,
    created: bookable.length,
    skipped: preview.occurrences.length - bookable.length,
    warning: bookable.some((o) => o.status === "warning"),
    balanceWarning: await lowBalanceWarning(user.id, price.amountPence * bookable.length, price.currency),
  };
}

// ---------- Cancellation ----------

/**
 * What cancelling would cost, so the client can be told before they confirm.
 * Charging someone via a button that said only "Cancel session" is not
 * consent, so the dialog quotes this first.
 */
export type CancellationQuote = {
  /** Sessions that would be cancelled. */
  count: number;
  /** Total fee in pence across all of them. */
  feePence: number;
  currency: string;
  /** Per-session detail, for the dialog's wording. */
  items: { id: string; startAt: string; feePence: number; pricePence: number | null }[];
  /** The moment after which the first session starts costing money. */
  freeUntil: string | null;
  policy: { noticeHours: number; depositPct: number };
};

async function cancellationTargets(userId: string, b: { id: string; seriesId: string | null; startAt: Date }, scope: "one" | "future") {
  if (scope !== "future" || !b.seriesId) {
    const row = await db.booking.findFirst({ where: { id: b.id, clientId: userId } });
    return row ? [row] : [];
  }
  return db.booking.findMany({
    where: { seriesId: b.seriesId, clientId: userId, startAt: { gte: b.startAt }, status: { in: ["PENDING", "ACCEPTED"] } },
    orderBy: { startAt: "asc" },
  });
}

/** Price a prospective cancellation without performing it. */
export async function quoteCancellation(id: string, scope: "one" | "future" = "one"): Promise<{ error?: string; quote?: CancellationQuote }> {
  const user = await requireUser();
  const b = await db.booking.findFirst({ where: { id, clientId: user.id } });
  if (!b) return { error: "Booking not found." };

  const [settings, client] = await Promise.all([
    getTrainerSettings(),
    db.user.findUnique({ where: { id: user.id }, select: { cancellationNoticeHours: true, cancellationDepositPct: true } }),
  ]);
  const policy = resolvePolicy(client, settings);
  const targets = await cancellationTargets(user.id, b, scope);
  const now = new Date();

  const items = targets.map((t) => ({
    id: t.id,
    startAt: t.startAt.toISOString(),
    pricePence: t.priceAmountPence,
    feePence: cancellationFeePence(t.startAt, t.priceAmountPence, policy, now),
  }));

  return {
    quote: {
      count: targets.length,
      feePence: items.reduce((n, i) => n + i.feePence, 0),
      currency: settings.currency,
      items,
      freeUntil: targets[0] ? freeUntil(targets[0].startAt, policy).toISOString() : null,
      policy: { noticeHours: policy.noticeHours, depositPct: policy.depositPct },
    },
  };
}

/**
 * Cancel, charging the policy fee where it applies.
 *
 * This used to refuse outright inside the notice window. It is now a priced
 * decision: the client may always cancel, and pays the deposit if they are
 * late. Only occurrences actually inside the window are charged, so cancelling
 * a long series does not fire a fee on every week of it.
 */
export async function cancelBooking(id: string, scope: "one" | "future" = "one"): Promise<BookingResult & { chargedPence?: number }> {
  const user = await requireUser();
  const b = await db.booking.findFirst({ where: { id, clientId: user.id } });
  if (!b) return { error: "Booking not found." };
  if (!["PENDING", "ACCEPTED"].includes(b.status)) return { error: "This booking can't be cancelled." };

  const [settings, client] = await Promise.all([
    getTrainerSettings(),
    db.user.findUnique({ where: { id: user.id }, select: { cancellationNoticeHours: true, cancellationDepositPct: true } }),
  ]);
  const policy = resolvePolicy(client, settings);
  const targets = (await cancellationTargets(user.id, b, scope)).filter((t) => ["PENDING", "ACCEPTED"].includes(t.status));
  if (targets.length === 0) return { error: "Nothing left to cancel." };

  const now = new Date();
  await db.booking.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { status: "CANCELLED_BY_CLIENT", cancelledAt: now },
  });

  // Charge each late occurrence separately, keyed to its own booking — the
  // unique (bookingId, reason) index makes a retry idempotent.
  let chargedPence = 0;
  for (const t of targets) {
    const fee = cancellationFeePence(t.startAt, t.priceAmountPence, policy, now);
    if (fee <= 0) continue;
    const { created } = await addEntry({
      clientId: user.id,
      amountPence: -fee,
      reason: "CANCELLATION_FEE",
      bookingId: t.id,
      createdById: user.id,
      note: `Cancelled inside the ${policy.noticeHours}h notice period (${policy.depositPct}% of ${formatMoney(t.priceAmountPence ?? 0, settings.currency)})`,
      currency: t.priceCurrency ?? settings.currency,
    });
    if (created) chargedPence += fee;
  }

  // Tear down any video rooms these sessions had.
  for (const t of targets) await dropRoom(t.id);
  if (scope === "future" && b.seriesId) {
    const remaining = await db.booking.count({ where: { seriesId: b.seriesId, status: { in: ["PENDING", "ACCEPTED"] } } });
    if (remaining === 0) await db.bookingSeries.update({ where: { id: b.seriesId }, data: { status: "CANCELLED" } });
  }
  revalidatePath("/app", "layout");
  revalidatePath("/trainer", "layout");
  return { ok: true, chargedPence };
}
