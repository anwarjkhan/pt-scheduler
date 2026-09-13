import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { JOIN_WINDOW_MS, joinWindow } from "@/lib/video-window";

/**
 * Daily.co rooms for online sessions.
 *
 * Media never touches this app — both browsers connect straight to Daily's
 * servers. All we do is own the question of *who* may enter *which* room and
 * *when*: a private room per booking, plus a short-lived meeting token minted
 * per join. The token carries `is_owner`, which is the only difference between
 * the trainer (can admit, mute, end the call) and the client.
 *
 * DAILY_API_KEY is server-only and must never be exposed to the browser.
 */

const API = "https://api.daily.co/v1";

function apiKey() {
  const key = process.env.DAILY_API_KEY?.trim();
  if (!key) throw new VideoNotConfiguredError();
  return key;
}

export class VideoNotConfiguredError extends Error {
  constructor() {
    super("DAILY_API_KEY is not set");
    this.name = "VideoNotConfiguredError";
  }
}

export class VideoApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "VideoApiError";
  }
}

/** Whether online video is wired up at all — lets the UI stay quiet when it isn't. */
export function videoConfigured() {
  return !!process.env.DAILY_API_KEY?.trim();
}

async function daily<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new VideoApiError(res.status, `Daily ${init?.method ?? "GET"} ${path} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Daily takes unix seconds. */
const unix = (d: Date) => Math.floor(d.getTime() / 1000);

/** Room names must be URL-safe; the booking id (cuid) already is. */
export const roomNameFor = (bookingId: string) => `s-${bookingId}`;

type DailyRoom = { name: string; url: string };

export type RoomTimes = { startAt: Date; endAt: Date };

/**
 * Create the room for a booking, bounded to its session window: nobody can join
 * before `nbf`, and Daily ejects everyone and deletes the room at `exp`.
 */
export async function createRoom(bookingId: string, times: RoomTimes): Promise<DailyRoom> {
  const { opensAt, closesAt } = joinWindow(times);
  return daily<DailyRoom>("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: roomNameFor(bookingId),
      privacy: "private",
      properties: {
        nbf: unix(opensAt),
        exp: unix(closesAt),
        eject_at_room_exp: true,
        enable_chat: true,
        enable_screenshare: true,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  });
}

export async function deleteRoom(roomName: string): Promise<void> {
  try {
    await daily<void>(`/rooms/${encodeURIComponent(roomName)}`, { method: "DELETE" });
  } catch (e) {
    // A room that is already gone (404) is the state we wanted anyway.
    if (e instanceof VideoApiError && e.status === 404) return;
    throw e;
  }
}

/**
 * Mint a join credential. Short-lived and minted per page load, so it is safe to
 * hand to the browser; `isOwner` is what makes the trainer the host and must
 * never be decided client-side.
 */
export async function mintToken(opts: {
  roomName: string;
  isOwner: boolean;
  userName: string;
  userId: string;
  expiresAt: Date;
}): Promise<string> {
  const { token } = await daily<{ token: string }>("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: opts.roomName,
        is_owner: opts.isOwner,
        user_name: opts.userName,
        user_id: opts.userId,
        exp: unix(opts.expiresAt),
      },
    }),
  });
  return token;
}

/**
 * The room for a booking, creating it if it is missing.
 *
 * Idempotent on purpose: rooms are created eagerly for one-off sessions but
 * lazily for series, and an accept that failed while Daily was down is repaired
 * here on first join. A name collision (room already on Daily but not in our
 * table) is treated as success and re-recorded.
 */
export async function getOrCreateRoom(booking: { id: string; startAt: Date; endAt: Date }) {
  const existing = await db.videoRoom.findUnique({ where: { bookingId: booking.id } });
  if (existing) return existing;

  const { closesAt } = joinWindow(booking);
  let room: DailyRoom;
  try {
    room = await createRoom(booking.id, booking);
  } catch (e) {
    // 409: the room survives on Daily from an earlier attempt — adopt it.
    if (e instanceof VideoApiError && e.status === 409) {
      room = await daily<DailyRoom>(`/rooms/${encodeURIComponent(roomNameFor(booking.id))}`);
    } else throw e;
  }

  return db.videoRoom.upsert({
    where: { bookingId: booking.id },
    update: { roomName: room.name, roomUrl: room.url, expiresAt: closesAt },
    create: { bookingId: booking.id, roomName: room.name, roomUrl: room.url, expiresAt: closesAt },
  });
}

/**
 * Drop the room for a booking that is being cancelled or moved. A reschedule
 * changes the nbf/exp window, so the room must be recreated rather than reused.
 * Never throws: losing a room is recoverable, failing the cancellation is not.
 */
export async function dropRoom(bookingId: string) {
  const row = await db.videoRoom.findUnique({ where: { bookingId } });
  if (!row) return;
  try {
    await deleteRoom(row.roomName);
  } catch (e) {
    console.error("[video] failed to delete Daily room", row.roomName, e);
  }
  await db.videoRoom.delete({ where: { bookingId } }).catch(() => {});
}

/**
 * Create the room for a freshly accepted session. Deliberately swallows errors:
 * the booking is the source of truth and getOrCreateRoom repairs a missing room
 * at join time, so a Daily outage must not fail an acceptance.
 */
export async function provisionRoomSafely(booking: { id: string; startAt: Date; endAt: Date; sessionType: string }) {
  if (booking.sessionType !== "ONLINE" || !videoConfigured()) return;
  try {
    await getOrCreateRoom(booking);
  } catch (e) {
    console.error("[video] room provisioning failed for booking", booking.id, e);
  }
}

/**
 * Issue (or return) the shareable guest link secret for a session.
 *
 * This is a **bearer credential**: anyone holding the link can join as a guest
 * while the session window is open, so it is only ever minted when the trainer
 * explicitly asks for one. It is never an owner, and it is still bounded by the
 * room's nbf/exp — a forwarded link is useless outside the session.
 */
export async function issueGuestToken(booking: { id: string; startAt: Date; endAt: Date }) {
  const room = await getOrCreateRoom(booking);
  if (room.guestToken) return room;
  return db.videoRoom.update({
    where: { bookingId: booking.id },
    data: { guestToken: randomBytes(32).toString("base64url") },
  });
}

/** Revoke a shared link without disturbing the room itself. */
export async function revokeGuestToken(bookingId: string) {
  await db.videoRoom.updateMany({ where: { bookingId }, data: { guestToken: null } });
}

export { JOIN_WINDOW_MS };
