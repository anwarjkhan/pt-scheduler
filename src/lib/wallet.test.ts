import { describe, expect, it } from "vitest";
import { BILLING_MODES, describeBalance, isCredit, isClearDown, REASON_LABELS, WALLET_REASONS } from "./wallet";
import { isTopUpMetadata, MAX_TOPUP_PENCE, MIN_TOPUP_PENCE } from "./stripe";

describe("wallet reasons", () => {
  it("labels every reason, so nothing renders as a raw enum", () => {
    for (const r of WALLET_REASONS) {
      expect(REASON_LABELS[r], `missing label for ${r}`).toBeTruthy();
    }
  });

  it("classifies credits and debits", () => {
    expect(isCredit("TOPUP")).toBe(true);
    expect(isCredit("REFUND")).toBe(true);
    expect(isCredit("SETTLEMENT")).toBe(true);
    expect(isCredit("SESSION_CHARGE")).toBe(false);
    expect(isCredit("CANCELLATION_FEE")).toBe(false);
  });

  it("treats a clear-down as neither — it takes the sign of the balance it cancels", () => {
    expect(isClearDown("CLEARDOWN")).toBe(true);
    expect(isCredit("CLEARDOWN")).toBe(false);
    expect(isClearDown("TOPUP")).toBe(false);
  });

  it("offers exactly the two billing modes", () => {
    expect([...BILLING_MODES]).toEqual(["WALLET", "MONTHLY"]);
  });
});

describe("describeBalance — words carry the meaning, not just the sign", () => {
  it("names credit and debt", () => {
    expect(describeBalance(5000, "WALLET")).toMatchObject({ tone: "credit", text: "in credit" });
    expect(describeBalance(-5000, "MONTHLY")).toMatchObject({ tone: "owed", text: "owed" });
  });

  it("reads zero differently per billing mode", () => {
    expect(describeBalance(0, "WALLET").text).toBe("No credit left");
    expect(describeBalance(0, "MONTHLY").text).toBe("Nothing outstanding");
  });
});

describe("stripe top-up metadata — the client id must not be trusted from a URL", () => {
  it("accepts a well-formed payload", () => {
    expect(isTopUpMetadata({ kind: "wallet_topup", clientId: "abc" })).toBe(true);
  });

  it("rejects anything else, so an unrelated webhook never credits a wallet", () => {
    expect(isTopUpMetadata(null)).toBe(false);
    expect(isTopUpMetadata(undefined)).toBe(false);
    expect(isTopUpMetadata({})).toBe(false);
    expect(isTopUpMetadata({ kind: "something_else", clientId: "abc" })).toBe(false);
    expect(isTopUpMetadata({ kind: "wallet_topup" })).toBe(false);
    expect(isTopUpMetadata({ kind: "wallet_topup", clientId: "" })).toBe(false);
  });

  it("bounds a top-up at both ends", () => {
    expect(MIN_TOPUP_PENCE).toBeGreaterThan(0);
    expect(MAX_TOPUP_PENCE).toBeGreaterThan(MIN_TOPUP_PENCE);
  });
});
