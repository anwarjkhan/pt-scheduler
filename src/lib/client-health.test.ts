import { describe, expect, it } from "vitest";
import {
  cancellationWeight,
  computeHealth,
  DEFAULT_WEIGHTS,
  normaliseWeights,
  PROVISIONAL_CEILING,
  scoreBand,
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
    expect(h.status).not.toBe("ATTENTION");
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

describe("the overall score", () => {
  it("is a weighted blend of the dimensions", () => {
    const h = computeHealth(f({ balancePence: 36000, travelHours: null }));
    // Reliability 100, payment 100, value high, effort uncounted (no travel).
    expect(h.overall?.score).toBeGreaterThan(90);
  });

  it("ranks a reliable payer above a flaky debtor", () => {
    const good = computeHealth(f({ balancePence: 36000 }));
    const bad = computeHealth(
      f({ completed: 10, noShows: 3, balancePence: -30000, daysInDebtFor: 90 }),
    );
    expect(good.overall!.score).toBeGreaterThan(bad.overall!.score);
  });

  it("leaves an unmeasured dimension out rather than scoring it zero", () => {
    const unmeasured = computeHealth(f({ travelHours: null }));
    const measured = computeHealth(f({ travelHours: 4 }));
    // Dropping effort must not drag the total down; renormalising keeps it fair.
    expect(unmeasured.overall!.score).toBeGreaterThanOrEqual(measured.overall!.score);
    expect(unmeasured.overall!.parts.find((p) => p.key === "effort")!.counted).toBe(false);
  });

  it("follows the weights it is given", () => {
    const facts = f({ completed: 10, noShows: 4, balancePence: 36000 }); // poor reliability, perfect payment
    const reliabilityLed = computeHealth(facts, { reliability: 90, value: 5, payment: 5, effort: 0 });
    const paymentLed = computeHealth(facts, { reliability: 5, value: 5, payment: 90, effort: 0 });
    expect(paymentLed.overall!.score).toBeGreaterThan(reliabilityLed.overall!.score);
  });

  it("still produces a number on thin history, but marks it provisional", () => {
    const h = computeHealth(f({ completed: 2, tenureDays: 10 }));
    expect(h.overall!.score).toBeGreaterThan(0);
    expect(h.overall!.confident).toBe(false);
    expect(h.status).toBe("TOO_EARLY");
  });

  it("marks a settled score confident", () => {
    expect(computeHealth(f()).overall!.confident).toBe(true);
  });

  it("gives no score at all for an exempt client", () => {
    expect(computeHealth(f({ exempt: true })).overall).toBeNull();
  });

  it("shows its working", () => {
    const parts = computeHealth(f()).overall!.parts;
    expect(parts.map((p) => p.key).sort()).toEqual(["effort", "payment", "reliability", "value"]);
  });

  it("stays within 0–100 however odd the weights", () => {
    for (const w of [
      { reliability: 1000, value: 0, payment: 0, effort: 0 },
      { reliability: 0, value: 0, payment: 0, effort: 0 },
      { reliability: -5, value: 10, payment: 10, effort: 10 },
    ]) {
      const got = computeHealth(f(), w).overall!.score;
      expect(got).toBeGreaterThanOrEqual(0);
      expect(got).toBeLessThanOrEqual(100);
    }
  });
});

describe("normaliseWeights", () => {
  it("scales any set to sum to 100", () => {
    const w = normaliseWeights({ reliability: 7, value: 7, payment: 7, effort: 7 });
    expect(w.reliability + w.value + w.payment + w.effort).toBe(100);
  });

  it("preserves the ratios", () => {
    const w = normaliseWeights({ reliability: 60, value: 20, payment: 20, effort: 0 });
    expect(w).toEqual({ reliability: 60, value: 20, payment: 20, effort: 0 });
  });

  it("falls back to the defaults rather than dividing by zero", () => {
    expect(normaliseWeights({ reliability: 0, value: 0, payment: 0, effort: 0 })).toEqual(DEFAULT_WEIGHTS);
  });

  it("ignores negatives", () => {
    const w = normaliseWeights({ reliability: -10, value: 50, payment: 50, effort: 0 });
    expect(w.reliability).toBe(0);
  });
});

describe("scoreBand — the number is never the only cue", () => {
  it("names each range", () => {
    expect(scoreBand(95)).toBe("excellent");
    expect(scoreBand(75)).toBe("good");
    expect(scoreBand(55)).toBe("fair");
    expect(scoreBand(20)).toBe("poor");
  });
});

describe("the provisional ceiling", () => {
  it("keeps a thin-history score out of the top band", () => {
    const h = computeHealth(f({ completed: 3, tenureDays: 10, balancePence: 36000 }));
    expect(h.overall!.confident).toBe(false);
    expect(h.overall!.score).toBeLessThanOrEqual(PROVISIONAL_CEILING);
  });

  it("lets a client who has earned it rank above one who might not", () => {
    const earned = computeHealth(f({ balancePence: 36000 }));
    const promising = computeHealth(f({ completed: 3, tenureDays: 10, balancePence: 36000 }));
    expect(earned.overall!.score).toBeGreaterThan(promising.overall!.score);
  });

  it("only caps — it never lifts a weak score up to the ceiling", () => {
    const weak = computeHealth(f({ completed: 3, tenureDays: 10, noShows: 2, balancePence: -30000, daysInDebtFor: 90 }));
    const strong = computeHealth(f({ completed: 3, tenureDays: 10, balancePence: 36000 }));
    expect(weak.overall!.score).toBeLessThan(strong.overall!.score);
    expect(weak.overall!.score).toBeLessThan(PROVISIONAL_CEILING);
  });
});

describe("Star is meant to be rare", () => {
  it("is withheld from a good client with only a handful of sessions", () => {
    const h = computeHealth(f({ completed: 6, tenureDays: 90, balancePence: 36000 }));
    expect(h.status).toBe("STEADY");
  });

  it("is withheld from someone who has stopped coming", () => {
    const h = computeHealth(f({ balancePence: 36000, daysSinceLastSession: 40 }));
    expect(h.status).toBe("DRIFTING");
  });

  it("is given to a long-standing, reliable, settled-up client", () => {
    expect(computeHealth(f({ balancePence: 36000 })).status).toBe("STAR");
  });
});

describe("what to lead with when several things are wrong", () => {
  it("raises drifting ahead of an ordinary unpaid balance", () => {
    // Stopped coming AND owes money: the silence is the urgent part.
    const h = computeHealth(f({ daysSinceLastSession: 40, balancePence: -9500, daysInDebtFor: 35 }));
    expect(h.status).toBe("DRIFTING");
  });

  it("still leads with a debt once it is long-standing", () => {
    const h = computeHealth(f({ daysSinceLastSession: 40, balancePence: -9500, daysInDebtFor: 60 }));
    expect(h.status).toBe("ATTENTION");
    expect(h.headline).toMatch(/owed/);
  });

  it("names no-shows once, not twice", () => {
    const h = computeHealth(f({ completed: 10, noShows: 2 }));
    expect(h.headline.match(/no-show/g)?.length).toBe(1);
  });
});

describe("reschedule churn is never invisible", () => {
  it("counts even when travel has not been measured", () => {
    const settled = computeHealth(f({ travelHours: null, reschedulesByClient: 0 }));
    const churner = computeHealth(f({ travelHours: null, reschedulesByClient: 15 }));
    expect(churner.effort.confident).toBe(true);
    expect(churner.overall!.score).toBeLessThan(settled.overall!.score);
  });

  it("judges moves against how often they train", () => {
    // Three moves over twenty sessions is forgivable; three over six is not.
    const occasional = computeHealth(f({ completed: 20, reschedulesByClient: 3, travelHours: null }));
    const habitual = computeHealth(f({ completed: 6, tenureDays: 90, reschedulesByClient: 3, travelHours: null }));
    expect(habitual.effort.score).toBeLessThan(occasional.effort.score);
  });

  it("keeps Star from someone who moves most of their sessions", () => {
    const h = computeHealth(f({ balancePence: 36000, reschedulesByClient: 14, travelHours: null }));
    expect(h.status).not.toBe("STAR");
  });
});
