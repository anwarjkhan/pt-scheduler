import { describe, expect, it } from "vitest";
import { customRateFor, formatMoney, formatSigned, rateKey, resolvePriceFrom } from "./pricing";

const RULES = [
  { sessionType: "IN_PERSON", durationMin: 30, amountPence: 3500 },
  { sessionType: "IN_PERSON", durationMin: 60, amountPence: 6000 },
  { sessionType: "ONLINE", durationMin: 60, amountPence: 4500 },
];

describe("resolvePriceFrom", () => {
  it("uses the standard rate for a known pair", () => {
    const r = resolvePriceFrom({ sessionType: "IN_PERSON", durationMin: 60 }, RULES, "GBP");
    expect(r).toEqual({ ok: true, amountPence: 6000, currency: "GBP" });
  });

  it("distinguishes online from in-person at the same duration", () => {
    const inPerson = resolvePriceFrom({ sessionType: "IN_PERSON", durationMin: 60 }, RULES, "GBP");
    const online = resolvePriceFrom({ sessionType: "ONLINE", durationMin: 60 }, RULES, "GBP");
    expect(inPerson).toMatchObject({ amountPence: 6000 });
    expect(online).toMatchObject({ amountPence: 4500 });
  });

  it("errors rather than falling back to zero when no rate exists", () => {
    const r = resolvePriceFrom({ sessionType: "ONLINE", durationMin: 90 }, RULES, "GBP");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/90-minute online/);
  });

  it("prefers a client override over the standard rate", () => {
    const r = resolvePriceFrom({ sessionType: "IN_PERSON", durationMin: 60 }, RULES, "GBP", { "IN_PERSON:60": 5500 });
    expect(r).toMatchObject({ amountPence: 5500 });
  });

  it("lets an override price a pair that has no standard rate", () => {
    const r = resolvePriceFrom({ sessionType: "ONLINE", durationMin: 90 }, RULES, "GBP", { "ONLINE:90": 7000 });
    expect(r).toMatchObject({ amountPence: 7000 });
  });

  it("honours a zero override — a free session is a deliberate choice", () => {
    const r = resolvePriceFrom({ sessionType: "IN_PERSON", durationMin: 60 }, RULES, "GBP", { "IN_PERSON:60": 0 });
    expect(r).toMatchObject({ ok: true, amountPence: 0 });
  });

  it("carries the configured currency through", () => {
    const r = resolvePriceFrom({ sessionType: "IN_PERSON", durationMin: 30 }, RULES, "EUR");
    expect(r).toMatchObject({ currency: "EUR" });
  });
});

describe("customRateFor — the column is Json?, so treat it as untrusted", () => {
  it("ignores null and non-objects", () => {
    expect(customRateFor(null, "IN_PERSON", 60)).toBeNull();
    expect(customRateFor("nonsense", "IN_PERSON", 60)).toBeNull();
    expect(customRateFor(42, "IN_PERSON", 60)).toBeNull();
  });

  it("ignores an array", () => {
    expect(customRateFor([1, 2, 3], "IN_PERSON", 60)).toBeNull();
  });

  it("ignores non-integer and negative values rather than pricing wrongly", () => {
    expect(customRateFor({ "IN_PERSON:60": 55.5 }, "IN_PERSON", 60)).toBeNull();
    expect(customRateFor({ "IN_PERSON:60": -100 }, "IN_PERSON", 60)).toBeNull();
    expect(customRateFor({ "IN_PERSON:60": "5500" }, "IN_PERSON", 60)).toBeNull();
  });

  it("falls through to the standard rate when the override is malformed", () => {
    const r = resolvePriceFrom({ sessionType: "IN_PERSON", durationMin: 60 }, RULES, "GBP", { "IN_PERSON:60": "oops" });
    expect(r).toMatchObject({ amountPence: 6000 });
  });

  it("builds the key the way the map is written", () => {
    expect(rateKey("IN_PERSON", 60)).toBe("IN_PERSON:60");
  });
});

describe("formatMoney", () => {
  it("formats pence as pounds", () => {
    expect(formatMoney(6000)).toBe("£60.00");
    expect(formatMoney(3550)).toBe("£35.50");
    expect(formatMoney(1)).toBe("£0.01");
    expect(formatMoney(0)).toBe("£0.00");
  });

  it("formats negatives with the sign outside the symbol", () => {
    expect(formatMoney(-2400)).toBe("-£24.00");
  });

  it("falls back to the ISO code for an unknown currency", () => {
    expect(formatMoney(6000, "AUD")).toBe("60.00 AUD");
  });

  it("signs ledger amounts explicitly", () => {
    expect(formatSigned(6000)).toBe("+£60.00");
    expect(formatSigned(-2400)).toBe("−£24.00");
  });
});
