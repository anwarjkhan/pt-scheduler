import { db } from "@/lib/db";
import { getTrainerSettings } from "@/lib/settings";
import { resolvePolicy } from "@/lib/cancellation";
import {
  computeHealth,
  gapsBetween,
  medianOf,
  normaliseWeights,
  type ClientFacts,
  type ClientHealth,
  type ScoreWeights,
} from "@/lib/client-health";

/**
 * Turns what the database holds into the facts the scorer needs.
 *
 * TRAINER-ONLY, like the scorer it feeds — see the note in client-health.ts.
 *
 * Kept apart from the scoring itself so the rules stay pure and testable: this
 * file knows about Prisma, that one knows about judgement, and neither needs
 * the other to change when the other does.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Window for the "are they still coming?" comparison. */
const RECENT_DAYS = 60;

/** Statuses that mean the client walked away from a session they had. */
const CLIENT_CANCELLED = "CANCELLED_BY_CLIENT";

type BookingRow = {
  status: string;
  startAt: Date;
  endAt: Date;
  durationMin: number;
  noShow: boolean;
  priceAmountPence: number | null;
  cancelledAt: Date | null;
  rescheduleCount: number;
  rescheduledBy: string | null;
};

/**
 * How long the balance has been continuously negative.
 *
 * Walks the ledger forward and remembers when it last crossed from non-negative
 * into the red. A client who dipped, paid up, then dipped again is only "in
 * debt" since the second dip — otherwise an old, settled balance would make
 * them look like a long-term problem.
 */
export function daysInDebt(entries: { amountPence: number; createdAt: Date }[], now: Date): number | null {
  let running = 0;
  let since: Date | null = null;
  for (const e of [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const was = running;
    running += e.amountPence;
    if (was >= 0 && running < 0) since = e.createdAt;
    if (running >= 0) since = null;
  }
  if (running >= 0 || !since) return null;
  return Math.max(0, Math.round((now.getTime() - since.getTime()) / DAY));
}

/** Build the facts for one client from rows already loaded. */
export function factsFrom(
  client: {
    createdAt: Date;
    healthExempt: boolean;
    healthExemptReason: string | null;
    cancellationNoticeHours: number | null;
    cancellationDepositPct: number | null;
  },
  bookings: BookingRow[],
  ledger: { amountPence: number; createdAt: Date }[],
  globalPolicy: { cancellationNoticeHours: number; cancellationDepositPct: number },
  now: Date,
  travelHours: number | null = null,
): ClientFacts {
  const policy = resolvePolicy(client, globalPolicy);

  // A no-show is stored as COMPLETED with the flag set — the slot was used up
  // either way — so it must be counted as missed, not delivered.
  const delivered = bookings.filter((b) => b.status === "COMPLETED" && !b.noShow);
  const noShows = bookings.filter((b) => b.noShow).length;

  const cancellations = bookings
    .filter((b) => b.status === CLIENT_CANCELLED)
    .map((b) => {
      // No timestamp on older rows: treat as ample notice rather than
      // inventing a penalty from missing data.
      const noticeHours = b.cancelledAt ? (b.startAt.getTime() - b.cancelledAt.getTime()) / 3600000 : 999;
      return { noticeHours, late: noticeHours < policy.noticeHours };
    });

  const sessionDates = delivered.map((b) => b.startAt);
  const last = sessionDates.length ? new Date(Math.max(...sessionDates.map((d) => d.getTime()))) : null;

  const recentCut = new Date(now.getTime() - RECENT_DAYS * DAY);
  const priorCut = new Date(now.getTime() - 2 * RECENT_DAYS * DAY);

  return {
    completed: delivered.length,
    noShows,
    cancellations,
    // From the first session they actually did, not when the account row
    // appeared — an imported or seeded client would otherwise look brand new.
    tenureDays: Math.max(
      0,
      Math.round((now.getTime() - (sessionDates.length ? Math.min(...sessionDates.map((d) => d.getTime())) : client.createdAt.getTime())) / DAY),
    ),
    daysSinceLastSession: last ? Math.round((now.getTime() - last.getTime()) / DAY) : null,
    medianGapDays: medianOf(gapsBetween(sessionDates)),
    recentSessions: delivered.filter((b) => b.startAt >= recentCut).length,
    priorSessions: delivered.filter((b) => b.startAt >= priorCut && b.startAt < recentCut).length,
    revenuePence: delivered.reduce((n, b) => n + (b.priceAmountPence ?? 0), 0),
    hoursDelivered: delivered.reduce((n, b) => n + b.durationMin, 0) / 60,
    travelHours,
    balancePence: ledger.reduce((n, e) => n + e.amountPence, 0),
    daysInDebtFor: daysInDebt(ledger, now),
    // Only moves the client asked for. A session the trainer dragged on their
    // own calendar is not the client's doing.
    reschedulesByClient: bookings
      .filter((b) => b.rescheduledBy === "CLIENT")
      .reduce((n, b) => n + b.rescheduleCount, 0),
    exempt: client.healthExempt,
    exemptReason: client.healthExemptReason,
  };
}

/** The trainer's configured weights, normalised so they always sum to 100. */
export function weightsFrom(s: {
  weightReliability: number;
  weightValue: number;
  weightPayment: number;
  weightEffort: number;
}): ScoreWeights {
  return normaliseWeights({
    reliability: s.weightReliability,
    value: s.weightValue,
    payment: s.weightPayment,
    effort: s.weightEffort,
  });
}

const bookingSelect = {
  status: true,
  startAt: true,
  endAt: true,
  durationMin: true,
  noShow: true,
  priceAmountPence: true,
  cancelledAt: true,
  rescheduleCount: true,
  rescheduledBy: true,
} as const;

/** Health for one client. */
export async function getClientHealth(clientId: string, now: Date = new Date()): Promise<ClientHealth | null> {
  const [client, settings] = await Promise.all([
    db.user.findUnique({
      where: { id: clientId },
      select: {
        createdAt: true,
        healthExempt: true,
        healthExemptReason: true,
        cancellationNoticeHours: true,
        cancellationDepositPct: true,
        bookings: { select: bookingSelect },
        walletEntries: { select: { amountPence: true, createdAt: true } },
      },
    }),
    getTrainerSettings(),
  ]);
  if (!client) return null;
  return computeHealth(factsFrom(client, client.bookings, client.walletEntries, settings, now), weightsFrom(settings));
}

/**
 * Health for every client, for the directory.
 *
 * Two queries for the whole list rather than two per client — the page already
 * loads bookings, and N+1 here would be felt immediately.
 */
export async function getAllClientHealth(now: Date = new Date()): Promise<Map<string, ClientHealth>> {
  const [clients, settings] = await Promise.all([
    db.user.findMany({
      where: { role: "CLIENT" },
      select: {
        id: true,
        createdAt: true,
        healthExempt: true,
        healthExemptReason: true,
        cancellationNoticeHours: true,
        cancellationDepositPct: true,
        bookings: { select: bookingSelect },
        walletEntries: { select: { amountPence: true, createdAt: true } },
      },
    }),
    getTrainerSettings(),
  ]);

  const weights = weightsFrom(settings);
  return new Map(
    clients.map((c) => [c.id, computeHealth(factsFrom(c, c.bookings, c.walletEntries, settings, now), weights)]),
  );
}
