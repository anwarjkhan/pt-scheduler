"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTrainer } from "@/lib/session";
import { loadDayContext, sessionCoords } from "@/lib/bookings";
import { getCommute } from "@/lib/maps";
import { getSchedulingSettings } from "@/lib/settings";
import { addMinutes, DURATIONS, evaluateSlot, zoned } from "@/lib/scheduling";
import { issueGuestToken, provisionRoomSafely, revokeGuestToken, videoConfigured } from "@/lib/video";
import type { TrainerActionResult } from "./actions";

/**
 * Ad-hoc online sessions the trainer books directly, rather than a client
 * requesting one. They are created already ACCEPTED — the trainer is the one
 * doing the booking, so there is nobody left to approve it.
 */

const adhoc = z.object({
  clientId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time"),
  duration: z.coerce.number().refine((n) => (DURATIONS as readonly number[]).includes(n), "Invalid duration"),
  note: z.string().max(300).optional(),
});

/**
 * A Booking needs a location, but an online session is run from the trainer's
 * home and the client's address is irrelevant to it. Prefer one of the client's
 * own addresses (keeps their history coherent), and fall back to a shared
 * home-based location so a client with no saved address can still be booked.
 */
async function resolveOnlineLocation(clientId: string) {
  const own = await db.location.findFirst({ where: { userId: clientId }, orderBy: { createdAt: "asc" } });
  if (own) return own;

  const { home } = await getSchedulingSettings();
  if (!home) return null;

  const existing = await db.location.findFirst({ where: { userId: clientId, label: "Online" } });
  if (existing) return existing;

  const settings = await db.trainerSettings.findUnique({ where: { id: "singleton" } });
  return db.location.create({
    data: {
      userId: clientId,
      label: "Online",
      formatted: settings?.homeAddress ?? "Online session",
      placeId: settings?.homePlaceId ?? null,
      lat: home.lat,
      lng: home.lng,
    },
  });
}

export type AdhocResult = TrainerActionResult & { bookingId?: string };

/**
 * Absolute origin for shareable links. Taken from the request so it is correct on
 * localhost, Vercel previews and production alike, with AUTH_URL as a fallback.
 */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  return (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
}

export async function createAdhocOnlineSession(input: z.infer<typeof adhoc>): Promise<AdhocResult> {
  await requireTrainer();
  const parsed = adhoc.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const d = parsed.data;

  const client = await db.user.findUnique({ where: { id: d.clientId } });
  if (!client) return { error: "Client not found." };

  const location = await resolveOnlineLocation(d.clientId);
  if (!location) return { error: "Set your home address in Settings before booking online sessions." };

  const { timezone } = await getSchedulingSettings();
  const start = zoned(d.date, d.startTime, timezone);
  const end = addMinutes(start, d.duration);

  // Same rules as a client request, minus the minimum-notice check: the trainer
  // is allowed to book something for this afternoon.
  const ctx = await loadDayContext(d.date);
  ctx.existing = ctx.existing.filter((x) => x.status === "ACCEPTED");
  const at = sessionCoords("ONLINE", location, ctx.settings.home);
  const evaluation = await evaluateSlot({ start, end, loc: at }, ctx.existing, ctx.windows, ctx.settings, getCommute);
  if (evaluation.overlaps) return { error: "That clashes with a confirmed session." };

  const booking = await db.booking.create({
    data: {
      clientId: d.clientId,
      locationId: location.id,
      sessionType: "ONLINE",
      startAt: start,
      endAt: end,
      durationMin: d.duration,
      // The trainer booked it, so there is nothing to accept.
      status: "ACCEPTED",
      trainerNote: d.note || null,
    },
  });

  await provisionRoomSafely({ ...booking });

  revalidatePath("/app", "layout");
  revalidatePath("/trainer", "layout");

  const warnings: string[] = [];
  if (evaluation.outsideAvailability) warnings.push("Booked outside your usual hours.");
  if (evaluation.warning) warnings.push("The commute either side is tight.");
  return { ok: true, bookingId: booking.id, warnings };
}

/**
 * Create the shareable guest link. Returns an absolute URL so the trainer can
 * paste it straight into a message.
 */
export async function createGuestLink(bookingId: string): Promise<TrainerActionResult & { url?: string }> {
  await requireTrainer();
  if (!videoConfigured()) return { error: "Video isn't configured." };

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { error: "Session not found." };
  if (booking.sessionType !== "ONLINE") return { error: "Only online sessions have a join link." };
  if (booking.status !== "ACCEPTED") return { error: "Confirm the session before sharing a link." };

  try {
    const room = await issueGuestToken(booking);
    return { ok: true, url: `${await origin()}/join/${room.guestToken}` };
  } catch (e) {
    console.error("[video] guest link failed for booking", bookingId, e);
    return { error: "Couldn't create a link just now." };
  }
}

export async function revokeGuestLink(bookingId: string): Promise<TrainerActionResult> {
  await requireTrainer();
  await revokeGuestToken(bookingId);
  revalidatePath("/trainer", "layout");
  return { ok: true };
}
