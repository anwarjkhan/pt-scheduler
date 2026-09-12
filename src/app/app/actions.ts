"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCommute } from "@/lib/maps";
import { requireUser } from "@/lib/session";
import { loadDayContext } from "@/lib/bookings";
import { getSchedulingSettings } from "@/lib/settings";
import {
  addMinutes,
  canClientCancel,
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

export type BookingResult = { ok?: boolean; error?: string; warning?: boolean; bookingId?: string };

const single = z.object({
  locationId: z.string().min(1),
  start: z.string().datetime(),
  duration: z.coerce.number().refine((n) => (DURATIONS as readonly number[]).includes(n), "Invalid duration"),
  note: z.string().max(300).optional(),
});

/** Validate a candidate against availability, overlaps and notice. Returns the evaluation or an error string. */
async function validateCandidate(userId: string, locationId: string, start: Date, duration: number) {
  const loc = await db.location.findFirst({ where: { id: locationId, userId } });
  if (!loc) return { error: "Location not found." } as const;

  const { timezone } = await getSchedulingSettings();
  const ctx = await loadDayContext(dateKey(start, timezone));
  const end = addMinutes(start, duration);
  if (!meetsMinNotice(start, ctx.settings.minNoticeHours)) {
    return { error: `Bookings need at least ${ctx.settings.minNoticeHours} hours' notice.` } as const;
  }
  const evaluation = await evaluateSlot({ start, end, loc: { lat: loc.lat, lng: loc.lng } }, ctx.existing, ctx.windows, ctx.settings, getCommute);
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

  const v = await validateCandidate(user.id, d.locationId, start, d.duration);
  if ("error" in v) return { error: v.error };

  const booking = await db.booking.create({
    data: {
      clientId: user.id,
      locationId: d.locationId,
      startAt: start,
      endAt: v.end,
      durationMin: d.duration,
      clientNote: d.note || null,
      status: "PENDING",
    },
  });
  revalidatePath("/app", "layout");
  revalidatePath("/trainer", "layout");
  return { ok: true, warning: v.evaluation.warning, bookingId: booking.id };
}

// ---------- Recurring series ----------

const seriesInput = z.object({
  locationId: z.string().min(1),
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
    const ev = await evaluateSlot({ start: o.start, end: o.end, loc: { lat: loc.lat, lng: loc.lng } }, ctx.existing, ctx.windows, ctx.settings, getCommute);
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
  const startDate = dateKey(first, tz);
  const series = await db.bookingSeries.create({
    data: {
      clientId: user.id,
      locationId: d.locationId,
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
          startAt: new Date(o.start),
          endAt: addMinutes(new Date(o.start), d.duration),
          durationMin: d.duration,
          clientNote: d.note || null,
          status: "PENDING",
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
  };
}

// ---------- Cancellation ----------

export async function cancelBooking(id: string, scope: "one" | "future" = "one"): Promise<BookingResult> {
  const user = await requireUser();
  const b = await db.booking.findFirst({ where: { id, clientId: user.id } });
  if (!b) return { error: "Booking not found." };
  if (!["PENDING", "ACCEPTED"].includes(b.status)) return { error: "This booking can't be cancelled." };

  const settings = await getSchedulingSettings();
  const targets =
    scope === "future" && b.seriesId
      ? await db.booking.findMany({
          where: { seriesId: b.seriesId, clientId: user.id, startAt: { gte: b.startAt }, status: { in: ["PENDING", "ACCEPTED"] } },
        })
      : [b];

  const allowed = targets.filter((t) => canClientCancel(t.startAt, settings.minNoticeHours));
  if (allowed.length === 0) {
    return { error: `Sessions can only be cancelled at least ${settings.minNoticeHours} hours in advance. Please contact your trainer.` };
  }

  await db.booking.updateMany({
    where: { id: { in: allowed.map((t) => t.id) } },
    data: { status: "CANCELLED_BY_CLIENT", cancelledAt: new Date() },
  });
  if (scope === "future" && b.seriesId) {
    const remaining = await db.booking.count({ where: { seriesId: b.seriesId, status: { in: ["PENDING", "ACCEPTED"] } } });
    if (remaining === 0) await db.bookingSeries.update({ where: { id: b.seriesId }, data: { status: "CANCELLED" } });
  }
  revalidatePath("/app", "layout");
  revalidatePath("/trainer", "layout");
  const blocked = targets.length - allowed.length;
  return { ok: true, error: blocked ? `${blocked} session(s) within the notice period were left unchanged.` : undefined };
}
