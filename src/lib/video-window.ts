/**
 * When an online session can be joined.
 *
 * Kept free of Prisma and of the Daily API so it stays unit-testable: the join
 * route, the client's session list and the trainer's calendar dialog all decide
 * visibility with this one function, so they can never disagree.
 */

/** How early either side may enter the room. */
export const JOIN_EARLY_MIN = 15;
/** How long the room stays joinable after the session's scheduled end. */
export const JOIN_LATE_MIN = 30;

export type JoinableBooking = {
  status: string;
  sessionType: string;
  startAt: Date;
  endAt: Date;
};

export const JOIN_WINDOW_MS = {
  early: JOIN_EARLY_MIN * 60_000,
  late: JOIN_LATE_MIN * 60_000,
};

/** The window during which the room accepts either party. */
export function joinWindow(b: Pick<JoinableBooking, "startAt" | "endAt">) {
  return {
    opensAt: new Date(b.startAt.getTime() - JOIN_WINDOW_MS.early),
    closesAt: new Date(b.endAt.getTime() + JOIN_WINDOW_MS.late),
  };
}

/** Only confirmed online sessions are joinable, and only inside the window. */
export function canJoin(b: JoinableBooking, now: Date): boolean {
  if (b.sessionType !== "ONLINE") return false;
  if (b.status !== "ACCEPTED") return false;
  const { opensAt, closesAt } = joinWindow(b);
  return now >= opensAt && now <= closesAt;
}

/** Why the room is not open — drives the copy on the join page. */
export type JoinState = "OPEN" | "TOO_EARLY" | "ENDED" | "NOT_ONLINE" | "NOT_CONFIRMED";

export function joinState(b: JoinableBooking, now: Date): JoinState {
  if (b.sessionType !== "ONLINE") return "NOT_ONLINE";
  if (b.status !== "ACCEPTED") return "NOT_CONFIRMED";
  const { opensAt, closesAt } = joinWindow(b);
  if (now < opensAt) return "TOO_EARLY";
  if (now > closesAt) return "ENDED";
  return "OPEN";
}
