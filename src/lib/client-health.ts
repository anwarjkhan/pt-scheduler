/**
 * How a client is doing, from the trainer's side.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * TRAINER-ONLY. Nothing here may reach a client-facing page. A client
 * discovering they are filed under "Needs attention" is a relationship ended
 * by a UI bug, so this module is imported only under /trainer, and the types
 * below are deliberately separate from the ones client routes use.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Four dimensions, kept apart on purpose. A client can be lucrative and
 * exhausting, or delightful and barely profitable; one blended number would
 * hide exactly the thing worth acting on.
 *
 * Pure functions, no DB — the scoring rules will be argued with and tuned, and
 * that is only safe if the awkward cases are pinned by tests.
 */

/** Below this, no judgement is offered: a score from two sessions is noise. */
export const MIN_SESSIONS_TO_JUDGE = 5;
export const MIN_DAYS_TO_JUDGE = 30;

const DAY = 24 * 60 * 60 * 1000;

export type HealthStatus = "STAR" | "STEADY" | "DRIFTING" | "ATTENTION" | "TOO_EARLY" | "EXEMPT";

/** One cancelled session, with how much warning was given. */
export type CancellationFact = {
  /** Hours between the cancellation and the session start. Negative = after it began. */
  noticeHours: number;
  /** Whether it fell inside the client's notice window — the policy decides this. */
  late: boolean;
};

/** Everything scoring needs, already loaded. Deliberately plain so it is easy to test. */
export type ClientFacts = {
  /** Sessions actually delivered. */
  completed: number;
  /** Sessions the client did not attend without cancelling. */
  noShows: number;
  /** Client-initiated cancellations. Trainer cancellations are not included. */
  cancellations: CancellationFact[];
  /**
   * How long the training relationship has run, in days — measured from their
   * first session, falling back to sign-up for someone who has not trained
   * yet. Account age alone is misleading: a row created by an import or a
   * seed says nothing about how long Toby has known them.
   */
  tenureDays: number;
  /** Days since their last completed session; null if they have had none. */
  daysSinceLastSession: number | null;
  /** Typical days between sessions, over their whole history; null if under two. */
  medianGapDays: number | null;
  /** Completed sessions in the last 60 days, and in the 60 before that. */
  recentSessions: number;
  priorSessions: number;
  /** Total earned from completed sessions, in pence. */
  revenuePence: number;
  /** Hours of sessions delivered. */
  hoursDelivered: number;
  /** Round-trip travel hours across those sessions; null when unknown. */
  travelHours: number | null;
  /** Current wallet balance. Negative = owed. */
  balancePence: number;
  /** Days the balance has been continuously negative; null if it is not. */
  daysInDebtFor: number | null;
  /** Times the client moved a booking. Trainer-initiated moves are excluded. */
  reschedulesByClient: number;
  /** Excluded from scoring by the trainer, and why. */
  exempt: boolean;
  exemptReason?: string | null;
};

export type Dimension = {
  /** 0–100. Only meaningful when `confident`. */
  score: number;
  /** Plain-language evidence — this is what the trainer actually reads. */
  reason: string;
  /** False when there is too little history to mean anything. */
  confident: boolean;
};

export type ClientHealth = {
  reliability: Dimension;
  value: Dimension;
  effort: Dimension;
  payment: Dimension;
  status: HealthStatus;
  /** Why the status is what it is, in the trainer's terms. */
  headline: string;
};

/**
 * What a late cancellation costs the client's reliability, by how much warning
 * they gave.
 *
 * Cancelling 36 hours out and cancelling 40 minutes out are not the same act,
 * and a flat tally punishes the considerate client and the inconsiderate one
 * identically. Under two hours is about as damaging as not turning up at all —
 * the slot is gone either way.
 */
export function cancellationWeight(noticeHours: number): number {
  if (noticeHours < 2) return 1; // as bad as a no-show
  if (noticeHours < 12) return 0.7;
  if (noticeHours < 24) return 0.4;
  if (noticeHours < 48) return 0.15;
  return 0; // plenty of warning: the slot was rebookable
}

/** Clamp to 0–100 and round, so every score is comparable. */
function pct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Do they turn up?
 *
 * Weighted against the sessions they committed to. A no-show counts full; a
 * cancellation counts by how little notice it gave.
 */
export function reliability(f: ClientFacts): Dimension {
  const committed = f.completed + f.noShows + f.cancellations.length;
  if (committed === 0) {
    return { score: 0, reason: "No sessions yet", confident: false };
  }

  const lost = f.noShows + f.cancellations.reduce((n, c) => n + cancellationWeight(c.noticeHours), 0);
  const score = pct((1 - lost / committed) * 100);

  const lateCount = f.cancellations.filter((c) => c.late).length;
  const parts: string[] = [`${f.completed} of ${committed} kept`];
  if (f.noShows > 0) parts.push(`${plural(f.noShows, "no-show")}`);
  if (lateCount > 0) parts.push(`${lateCount} cancelled late`);
  else if (f.cancellations.length > 0) parts.push(`${f.cancellations.length} cancelled with notice`);
  if (f.reschedulesByClient >= 3) parts.push(`moved ${f.reschedulesByClient} times`);

  return { score, reason: parts.join(" · "), confident: hasEnoughHistory(f) };
}

/**
 * What they are worth — per hour of the trainer's time, not in total.
 *
 * Revenue alone rewards whoever books most, which is not the same as who is
 * worth keeping. Travel is reported but deliberately does not lower the score:
 * the client did not choose where the trainer lives.
 */
export function value(f: ClientFacts): Dimension {
  if (f.completed === 0 || f.hoursDelivered <= 0) {
    return { score: 0, reason: "Nothing delivered yet", confident: false };
  }

  const perHour = f.revenuePence / f.hoursDelivered;
  // £60/hr is a solid hour's work for this business, so treat it as the mark.
  const rate = pct((perHour / 6000) * 70);
  // Consistency matters as much as rate: weekly for months beats a short burst.
  const steadiness = f.medianGapDays == null ? 0 : f.medianGapDays <= 10 ? 30 : f.medianGapDays <= 21 ? 20 : 10;
  const score = pct(rate + steadiness);

  // Rounded to the pound: this is read at a glance, and pence imply a
  // precision the underlying estimate does not have.
  const parts = [`${money(f.revenuePence)} · ${money(Math.round(perHour / 100) * 100)}/hr`];
  if (f.travelHours != null && f.travelHours > 0) {
    const engaged = f.hoursDelivered + f.travelHours;
    parts.push(`${money(Math.round(f.revenuePence / engaged / 100) * 100)}/hr with travel`);
  }
  if (f.medianGapDays != null) parts.push(`every ${f.medianGapDays}d`);

  return { score, reason: parts.join(" · "), confident: hasEnoughHistory(f) };
}

/**
 * What they cost in time that is not training — travel and rearranging.
 *
 * Shown so the trainer can see it; it feeds the panel, not the overall status.
 */
export function effort(f: ClientFacts): Dimension {
  if (f.completed === 0) return { score: 0, reason: "Nothing delivered yet", confident: false };

  const parts: string[] = [];
  let score = 100;

  // Travel is the dominant term, so with it unknown there is nothing solid to
  // score. Say so rather than showing a confident full mark.
  const travelKnown = f.travelHours != null && f.hoursDelivered > 0;
  if (travelKnown) {
    const ratio = f.travelHours! / f.hoursDelivered;
    score -= Math.min(60, ratio * 100);
    const avgMins = Math.round((f.travelHours! * 60) / f.completed);
    parts.push(`${avgMins} min travel per session`, `${Math.round(ratio * 100)}% on top of session time`);
  } else {
    parts.push("Travel not measured");
  }

  if (f.reschedulesByClient > 0) {
    score -= Math.min(25, f.reschedulesByClient * 5);
    parts.push(`moved ${plural(f.reschedulesByClient, "time")}`);
  }

  return {
    score: pct(score),
    reason: parts.join(" · "),
    // Only a real reading once travel is known; otherwise this is just the
    // reschedule count wearing a score.
    confident: hasEnoughHistory(f) && travelKnown,
  };
}

/** Do they pay without being chased? */
export function payment(f: ClientFacts): Dimension {
  if (f.balancePence >= 0) {
    const reason =
      f.balancePence > 0 ? `${money(f.balancePence)} in credit — pre-pays` : "Up to date";
    return { score: f.balancePence > 0 ? 100 : 90, reason, confident: true };
  }

  const owed = Math.abs(f.balancePence);
  const days = f.daysInDebtFor ?? 0;
  // A month's charges outstanding is normal; two months is not.
  const score = pct(100 - Math.min(70, (days / 60) * 70) - (owed > 30000 ? 15 : 0));
  return {
    score,
    reason: days > 0 ? `${money(owed)} owed for ${plural(days, "day")}` : `${money(owed)} owed`,
    confident: true,
  };
}

/** Enough history for a judgement to mean anything. */
export function hasEnoughHistory(f: ClientFacts): boolean {
  return f.completed >= MIN_SESSIONS_TO_JUDGE && f.tenureDays >= MIN_DAYS_TO_JUDGE;
}

/**
 * Has a previously regular client gone quiet?
 *
 * Measured against their own rhythm rather than a fixed number of days, so a
 * fortnightly client is not flagged for behaving fortnightly. Twice their usual
 * gap, with a two-week floor so a keen client is not chased after a short break.
 */
export function isDrifting(f: ClientFacts): boolean {
  if (f.medianGapDays == null || f.daysSinceLastSession == null) return false;
  const threshold = Math.max(14, f.medianGapDays * 2);
  if (f.daysSinceLastSession <= threshold) return false;
  // Only meaningful if they used to come regularly.
  return f.priorSessions >= 2;
}

/**
 * The whole picture.
 *
 * Status is deliberately conservative: it says nothing at all until there is
 * enough history, because a confident-looking badge drawn from one session is
 * worse than no badge. "Drifting" and "Needs attention" stay separate — one is
 * a retention problem, the other is a money problem, and they call for
 * different conversations.
 */
export function computeHealth(f: ClientFacts): ClientHealth {
  const dims = {
    reliability: reliability(f),
    value: value(f),
    effort: effort(f),
    payment: payment(f),
  };

  if (f.exempt) {
    return {
      ...dims,
      status: "EXEMPT",
      headline: f.exemptReason?.trim() || "Not scored, at your request",
    };
  }

  // Money is worth flagging even on a brand-new client: an unpaid balance is a
  // fact, not an inference from behaviour.
  const badDebt = f.balancePence < 0 && (f.daysInDebtFor ?? 0) >= 45;
  if (badDebt) {
    return { ...dims, status: "ATTENTION", headline: dims.payment.reason };
  }

  if (!hasEnoughHistory(f)) {
    const need: string[] = [];
    if (f.completed < MIN_SESSIONS_TO_JUDGE) need.push(`${plural(MIN_SESSIONS_TO_JUDGE - f.completed, "more session")}`);
    if (f.tenureDays < MIN_DAYS_TO_JUDGE) need.push(`${plural(MIN_DAYS_TO_JUDGE - f.tenureDays, "more day")}`);
    return { ...dims, status: "TOO_EARLY", headline: `Too early to tell — ${need.join(", ")}` };
  }

  const lateOrMissed = f.noShows + f.cancellations.filter((c) => c.late).length;

  if (dims.reliability.score < 70 || lateOrMissed >= 3) {
    return {
      ...dims,
      status: "ATTENTION",
      headline: f.noShows > 0 ? `${plural(f.noShows, "no-show")} · ${dims.reliability.reason}` : dims.reliability.reason,
    };
  }

  if (f.balancePence < 0 && (f.daysInDebtFor ?? 0) >= 30) {
    return { ...dims, status: "ATTENTION", headline: dims.payment.reason };
  }

  if (isDrifting(f)) {
    return {
      ...dims,
      status: "DRIFTING",
      headline: `Last seen ${plural(f.daysSinceLastSession ?? 0, "day")} ago — usually every ${f.medianGapDays}d`,
    };
  }

  if (dims.reliability.score >= 90 && dims.value.score >= 70 && dims.payment.score >= 90) {
    return {
      ...dims,
      status: "STAR",
      headline: `${f.completed} sessions · ${dims.value.reason}`,
    };
  }

  return { ...dims, status: "STEADY", headline: `${f.completed} sessions · ${dims.reliability.reason}` };
}

/** Pence → "£60" / "£59.50". Compact: these appear inside a sentence. */
function money(pence: number): string {
  const pounds = pence / 100;
  const s = Number.isInteger(pounds) ? pounds.toFixed(0) : pounds.toFixed(2);
  return `${pence < 0 ? "-" : ""}£${s.replace("-", "")}`;
}

/** How each status reads, and how it should look. */
export const STATUS_META: Record<HealthStatus, { label: string; tone: "good" | "neutral" | "warn" | "bad" }> = {
  STAR: { label: "Star client", tone: "good" },
  STEADY: { label: "Steady", tone: "neutral" },
  DRIFTING: { label: "Drifting", tone: "warn" },
  ATTENTION: { label: "Needs attention", tone: "bad" },
  TOO_EARLY: { label: "Too early to tell", tone: "neutral" },
  EXEMPT: { label: "Not scored", tone: "neutral" },
};

/** Median, rounded — used for the session gap. */
export function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const xs = [...values].sort((a, b) => a - b);
  const mid = Math.floor(xs.length / 2);
  return Math.round(xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2);
}

/** Days between consecutive dates, for medianOf. */
export function gapsBetween(dates: Date[]): number[] {
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((sorted[i].getTime() - sorted[i - 1].getTime()) / DAY);
  }
  return gaps;
}
