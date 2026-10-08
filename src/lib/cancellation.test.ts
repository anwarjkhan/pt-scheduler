import { describe, expect, it } from "vitest";
import {
  cancellationFeePence,
  freeUntil,
  hasOverride,
  isLateCancellation,
  noShowFeePence,
  resolvePolicy,
  type Policy,
} from "./cancellation";

const GLOBAL = { cancellationNoticeHours: 24, cancellationDepositPct: 40 };
const NOW = new Date("2026-10-08T12:00:00Z");
/** Hours from NOW. */
const at = (h: number) => new Date(NOW.getTime() + h * 60 * 60 * 1000);
const policy: Policy = { noticeHours: 24, depositPct: 40 };

describe("resolvePolicy", () => {
  it("uses the global defaults when the client overrides nothing", () => {
    expect(resolvePolicy(null, GLOBAL)).toEqual({ noticeHours: 24, depositPct: 40 });
    expect(resolvePolicy({}, GLOBAL)).toEqual({ noticeHours: 24, depositPct: 40 });
  });

  it("resolves the two fields independently", () => {
    expect(resolvePolicy({ cancellationNoticeHours: 48 }, GLOBAL)).toEqual({ noticeHours: 48, depositPct: 40 });
    expect(resolvePolicy({ cancellationDepositPct: 100 }, GLOBAL)).toEqual({ noticeHours: 24, depositPct: 100 });
  });

  it("treats zero as a real override, not as absent", () => {
    expect(resolvePolicy({ cancellationDepositPct: 0 }, GLOBAL).depositPct).toBe(0);
    expect(resolvePolicy({ cancellationNoticeHours: 0 }, GLOBAL).noticeHours).toBe(0);
  });

  it("reports whether a client has any override, for the trainer UI", () => {
    expect(hasOverride(null)).toBe(false);
    expect(hasOverride({ cancellationNoticeHours: null, cancellationDepositPct: null })).toBe(false);
    expect(hasOverride({ cancellationDepositPct: 0 })).toBe(true);
  });
});

describe("isLateCancellation", () => {
  it("is free well outside the window", () => {
    expect(isLateCancellation(at(48), policy, NOW)).toBe(false);
  });

  it("is charged well inside the window", () => {
    expect(isLateCancellation(at(2), policy, NOW)).toBe(true);
  });

  it("is free at exactly the notice mark — the boundary is inclusive", () => {
    expect(isLateCancellation(at(24), policy, NOW)).toBe(false);
  });

  it("is charged a minute inside the mark", () => {
    expect(isLateCancellation(new Date(at(24).getTime() - 60_000), policy, NOW)).toBe(true);
  });

  it("treats a session already past as late", () => {
    expect(isLateCancellation(at(-1), policy, NOW)).toBe(true);
  });

  it("charges everything when the window is zero only once the session has started", () => {
    const immediate: Policy = { noticeHours: 0, depositPct: 40 };
    expect(isLateCancellation(at(1), immediate, NOW)).toBe(false);
    expect(isLateCancellation(at(-1), immediate, NOW)).toBe(true);
  });
});

describe("cancellationFeePence", () => {
  it("charges nothing outside the window", () => {
    expect(cancellationFeePence(at(48), 6000, policy, NOW)).toBe(0);
  });

  it("charges the deposit percentage inside the window", () => {
    expect(cancellationFeePence(at(2), 6000, policy, NOW)).toBe(2400);
  });

  it("rounds to the nearest penny", () => {
    // 40% of £60.01 = 2400.4p → £24.00
    expect(cancellationFeePence(at(2), 6001, policy, NOW)).toBe(2400);
    // 40% of £60.02 = 2400.8p → £24.01
    expect(cancellationFeePence(at(2), 6002, policy, NOW)).toBe(2401);
    // 25% of £0.10 = 2.5p → 3p (Math.round goes half-up)
    expect(cancellationFeePence(at(2), 10, { noticeHours: 24, depositPct: 25 }, NOW)).toBe(3);
  });

  it("charges nothing at 0%", () => {
    expect(cancellationFeePence(at(2), 6000, { noticeHours: 24, depositPct: 0 }, NOW)).toBe(0);
  });

  it("charges the full price at 100%", () => {
    expect(cancellationFeePence(at(2), 6000, { noticeHours: 24, depositPct: 100 }, NOW)).toBe(6000);
  });

  it("clamps a nonsensical percentage rather than overcharging", () => {
    expect(cancellationFeePence(at(2), 6000, { noticeHours: 24, depositPct: 150 }, NOW)).toBe(6000);
    expect(cancellationFeePence(at(2), 6000, { noticeHours: 24, depositPct: -10 }, NOW)).toBe(0);
  });

  it("never charges a legacy booking that carries no price", () => {
    expect(cancellationFeePence(at(2), null, policy, NOW)).toBe(0);
    expect(cancellationFeePence(at(2), undefined, policy, NOW)).toBe(0);
    expect(cancellationFeePence(at(2), 0, policy, NOW)).toBe(0);
  });
});

describe("noShowFeePence — charged as a late cancellation", () => {
  it("charges the deposit regardless of when the session was", () => {
    expect(noShowFeePence(6000, policy)).toBe(2400);
  });

  it("matches what a late cancellation of the same session would cost", () => {
    expect(noShowFeePence(6000, policy)).toBe(cancellationFeePence(at(2), 6000, policy, NOW));
  });

  it("never charges a legacy booking", () => {
    expect(noShowFeePence(null, policy)).toBe(0);
  });
});

describe("freeUntil", () => {
  it("is the notice window before the start", () => {
    expect(freeUntil(at(48), policy).toISOString()).toBe(at(24).toISOString());
  });
});
