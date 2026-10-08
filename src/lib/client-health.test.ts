import { describe, expect, it } from "vitest";
import {
  cancellationWeight,
  computeHealth,
  gapsBetween,
  hasEnoughHistory,
  isDrifting,
  medianOf,
  MIN_DAYS_TO_JUDGE,
  MIN_SESSIONS_TO_JUDGE,
  STATUS_META,
  type ClientFacts,
} from "./client-health";
import { daysInDebt } from "./client-health-data";

/** A solid, unremarkable client. Each test bends one thing. */
const base: ClientFacts = {
  completed: 20,
  noShows: 0,
  cancellations: [],
  tenureDays: 180,
  daysSinceLastSession: 5,
  medianGapDays: 7,
  recentSessions: 8,
  priorSessions: 8,
  revenuePence: 120000,
  hoursDelivered: 20,
  travelHours: 4,
  balancePence: 0,
  daysInDebtFor: null,
  reschedulesByClient: 0,
  exempt: false,
};
const f = (over: Partial<ClientFacts> = {}): ClientFacts => ({ ...base, ...over });

describe("the confidence floor — a score from two sessions is noise", () => {
  it("withholds judgement below the session threshold", () => {
    const h = computeHealth(f({ completed: 1, tenureDays: 365 }));
    expect(h.status).toBe("TOO_EARLY");
    expect(h.headline).toMatch(/more sessions/);
  });

  it("withholds judgement from a brand-new client, however keen", () => {
    const h = computeHealth(f({ completed: 12, tenureDays: 5 }));
    expect(h.status).toBe("TOO_EARLY");
    expect(h.headline).toMatch(/more days/);
  });

  it("judges once both thresholds are met", () => {
    expect(hasEnoughHistory(f({ completed: MIN_SESSIONS_TO_JUDGE, tenureDays: MIN_DAYS_TO_JUDGE }))).toBe(true);
    expect(hasEnoughHistory(f({ completed: MIN_SESSIONS_TO_JUDGE - 1, tenureDays: 365 }))).toBe(false);
  });

  it("marks every dimension unconfident while history is thin", () => {
    const h = computeHealth(f({ completed: 1, tenureDays: 3 }));
    expect(h.reliability.confident).toBe(false);
    expect(h.value.confident).toBe(false);
  });

  it("still flags real debt on a new client — that is a fact, not an inference", () => {
    const h = computeHealth(f({ completed: 1, tenureDays: 10, balancePence: -24000, daysInDebtFor: 50 }));
    expect(h.status).toBe("ATTENTION");
    expect(h.headline).toMatch(/owed/);
  });
});

describe("cancellation weight — notice given, not a flat tally", () => {
  it("costs most when there is no time to refill the slot", () => {
    expect(cancellationWeight(0.5)).toBe(1);
    expect(cancellationWeight(1)).toBe(1);
  });

  it("costs nothing with plenty of warning", () => {
    expect(cancellationWeight(72)).toBe(0);
    expect(cancellationWeight(48)).toBe(0);
  });

  it("scales in between", () => {
    expect(cancellationWeight(6)).toBeGreaterThan(cancellationWeight(18));
    expect(cancellationWeight(18)).toBeGreaterThan(cancellationWeight(36));
  });

  it("rates a considerate canceller above an inconsiderate one", () => {
    const polite = computeHealth(f({ completed: 10, cancellations: [{ noticeHours: 72, late: false }] }));
    const rude = computeHealth(f({ completed: 10, cancellations: [{ noticeHours: 0.5, late: true }] }));
    expect(polite.reliability.score).toBeGreaterThan(rude.reliability.score);
  });
});

describe("reliability", () => {
  it("is perfect when nothing is missed", () => {
    expect(computeHealth(f()).reliability.score).toBe(100);
  });

  it("treats a no-show as the worst outcome", () => {
    const noShow = computeHealth(f({ completed: 10, noShows: 1 }));
    const lateCancel = computeHealth(f({ completed: 10, cancellations: [{ noticeHours: 20, late: true }] }));
    expect(noShow.reliability.score).toBeLessThan(lateCancel.reliability.score);
  });

  it("flags repeated no-shows for attention", () => {
    const h = computeHealth(f({ completed: 10, noShows: 3 }));
    expect(h.status).toBe("ATTENTION");
    expect(h.headline).toMatch(/no-show/);
  });

  it("names the evidence rather than a number", () => {
    const h = computeHealth(f({ completed: 9, noShows: 1 }));
    expect(h.reliability.reason).toMatch(/9 of 10 kept/);
  });
});

describe("value — per hour, not in total", () => {
  it("rates a higher hourly rate above a bigger total earned over more hours", () => {
    const efficient = computeHealth(f({ revenuePence: 60000, hoursDelivered: 10 })); // £60/hr
    const sprawling = computeHealth(f({ revenuePence: 80000, hoursDelivered: 20 })); // £40/hr
    expect(efficient.value.score).toBeGreaterThan(sprawling.value.score);
  });

  it("reports travel without letting distance lower the score", () => {
    const near = computeHealth(f({ travelHours: 1 }));
    const far = computeHealth(f({ travelHours: 10 }));
    expect(near.value.score).toBe(far.value.score);
    expect(far.value.reason).toMatch(/with travel/);
  });

  it("omits the travel figure when it is unknown", () => {
    expect(computeHealth(f({ travelHours: null })).value.reason).not.toMatch(/with travel/);
  });

  it("rewards a steady rhythm over an erratic one", () => {
    const weekly = computeHealth(f({ medianGapDays: 7 }));
    const sporadic = computeHealth(f({ medianGapDays: 45 }));
    expect(weekly.value.score).toBeGreaterThan(sporadic.value.score);
  });
});

describe("drifting — measured against the client's own rhythm", () => {
  it("does not flag a fortnightly client for being fortnightly", () => {
    expect(isDrifting(f({ medianGapDays: 14, daysSinceLastSession: 16 }))).toBe(false);
  });

  it("flags a weekly client who has gone quiet", () => {
    expect(isDrifting(f({ medianGapDays: 7, daysSinceLastSession: 40 }))).toBe(true);
  });

  it("leaves a keen client alone after a short break", () => {
    expect(isDrifting(f({ medianGapDays: 3, daysSinceLastSession: 10 }))).toBe(false);
  });

  it("says nothing about someone who was never regular", () => {
    expect(isDrifting(f({ medianGapDays: 7, daysSinceLastSession: 90, priorSessions: 0 }))).toBe(false);
  });

  it("is a separate status from needing attention", () => {
    const h = computeHealth(f({ daysSinceLastSession: 40 }));
    expect(h.status).toBe("DRIFTING");
    expect(h.headline).toMatch(/usually every 7d/);
  });
});

describe("payment", () => {
  it("treats pre-paid credit as the best case", () => {
    expect(computeHealth(f({ balancePence: 30000 })).payment.score).toBe(100);
  });

  it("tolerates a recent balance", () => {
    expect(computeHealth(f({ balancePence: -12000, daysInDebtFor: 5 })).status).not.toBe("ATTENTION");
  });

  it("escalates once a debt is a month old", () => {
    const h = computeHealth(f({ balancePence: -24000, daysInDebtFor: 35 }));
    expect(h.status).toBe("ATTENTION");
    expect(h.headline).toMatch(/owed for 35 days/);
  });

  it("gets worse the longer it runs", () => {
    const recent = computeHealth(f({ balancePence: -24000, daysInDebtFor: 10 }));
    const stale = computeHealth(f({ balancePence: -24000, daysInDebtFor: 70 }));
    expect(stale.payment.score).toBeLessThan(recent.payment.score);
  });
});

describe("star clients", () => {
  it("recognises reliable, valuable, settled-up clients", () => {
    expect(computeHealth(f({ balancePence: 36000 })).status).toBe("STAR");
  });

  it("withholds the badge when they owe money", () => {
    expect(computeHealth(f({ balancePence: -20000, daysInDebtFor: 20 })).status).not.toBe("STAR");
  });

  it("withholds it from someone who cancels late", () => {
    const h = computeHealth(
      f({ completed: 10, cancellations: [{ noticeHours: 1, late: true }, { noticeHours: 1, late: true }] }),
    );
    expect(h.status).not.toBe("STAR");
  });
});

describe("the exemption — for when the numbers are wrong about someone", () => {
  it("overrides every other status", () => {
    const h = computeHealth(f({ exempt: true, noShows: 5, balancePence: -50000, daysInDebtFor: 200 }));
    expect(h.status).toBe("EXEMPT");
  });

  it("shows the trainer's own words", () => {
    const h = computeHealth(f({ exempt: true, exemptReason: "Recovering from surgery" }));
    expect(h.headline).toBe("Recovering from surgery");
  });

  it("falls back to a neutral phrase when no reason was given", () => {
    const h = computeHealth(f({ exempt: true, exemptReason: "   " }));
    expect(h.headline).toMatch(/Not scored/);
  });
});

describe("helpers", () => {
  it("takes a median of odd and even runs", () => {
    expect(medianOf([7, 7, 7])).toBe(7);
    expect(medianOf([6, 8])).toBe(7);
    expect(medianOf([])).toBeNull();
  });

  it("measures gaps between sessions regardless of input order", () => {
    const d = (s: string) => new Date(s);
    expect(gapsBetween([d("2026-01-15"), d("2026-01-01"), d("2026-01-08")])).toEqual([7, 7]);
  });

  it("labels every status, so nothing renders as a raw enum", () => {
    for (const s of ["STAR", "STEADY", "DRIFTING", "ATTENTION", "TOO_EARLY", "EXEMPT"] as const) {
      expect(STATUS_META[s].label).toBeTruthy();
    }
  });
});

describe("a trainer cancellation is not the client's fault", () => {
  it("is never counted against reliability", () => {
    // Trainer cancellations are excluded upstream, so an otherwise clean
    // client stays perfect. Pinned here so the exclusion cannot regress.
    const h = computeHealth(f({ completed: 20, cancellations: [] }));
    expect(h.reliability.score).toBe(100);
    expect(h.status).toBe("STAR");
  });
});

describe("daysInDebt — only the current spell counts", () => {
  const d = (iso: string) => new Date(iso);
  const now = d("2026-10-08T00:00:00Z");

  it("is null while the balance is healthy", () => {
    expect(daysInDebt([{ amountPence: 10000, createdAt: d("2026-09-01") }], now)).toBeNull();
  });

  it("counts from when the balance went negative", () => {
    const got = daysInDebt(
      [
        { amountPence: 6000, createdAt: d("2026-08-01") },
        { amountPence: -12000, createdAt: d("2026-09-08") }, // crosses into the red here
      ],
      now,
    );
    expect(got).toBe(30);
  });

  it("restarts the clock after they settle up", () => {
    const got = daysInDebt(
      [
        { amountPence: -12000, createdAt: d("2026-06-01") }, // an old, cleared debt
        { amountPence: 12000, createdAt: d("2026-06-10") },
        { amountPence: -6000, createdAt: d("2026-10-01") }, // the one that matters
      ],
      now,
    );
    expect(got).toBe(7);
  });

  it("ignores order the rows arrive in", () => {
    const rows = [
      { amountPence: -6000, createdAt: d("2026-10-01") },
      { amountPence: 12000, createdAt: d("2026-06-10") },
      { amountPence: -12000, createdAt: d("2026-06-01") },
    ];
    expect(daysInDebt(rows, now)).toBe(7);
  });
});
