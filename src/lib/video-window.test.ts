import { describe, expect, it } from "vitest";
import { canJoin, joinState, joinWindow, JOIN_EARLY_MIN, JOIN_LATE_MIN } from "./video-window";

const START = new Date("2026-09-20T10:00:00Z");
const END = new Date("2026-09-20T11:00:00Z");

const online = { status: "ACCEPTED", sessionType: "ONLINE", startAt: START, endAt: END };
const at = (iso: string) => new Date(iso);

describe("joinWindow", () => {
  it("opens early and closes after the end", () => {
    const { opensAt, closesAt } = joinWindow(online);
    expect(opensAt.toISOString()).toBe("2026-09-20T09:45:00.000Z");
    expect(closesAt.toISOString()).toBe("2026-09-20T11:30:00.000Z");
    expect((START.getTime() - opensAt.getTime()) / 60000).toBe(JOIN_EARLY_MIN);
    expect((closesAt.getTime() - END.getTime()) / 60000).toBe(JOIN_LATE_MIN);
  });
});

describe("canJoin", () => {
  it("allows the window, inclusive of both edges", () => {
    expect(canJoin(online, at("2026-09-20T09:45:00Z"))).toBe(true);
    expect(canJoin(online, at("2026-09-20T10:30:00Z"))).toBe(true);
    expect(canJoin(online, at("2026-09-20T11:30:00Z"))).toBe(true);
  });

  it("refuses a minute either side", () => {
    expect(canJoin(online, at("2026-09-20T09:44:00Z"))).toBe(false);
    expect(canJoin(online, at("2026-09-20T11:31:00Z"))).toBe(false);
  });

  it("refuses in-person sessions whatever the time", () => {
    expect(canJoin({ ...online, sessionType: "IN_PERSON" }, at("2026-09-20T10:30:00Z"))).toBe(false);
  });

  it("refuses anything not confirmed", () => {
    for (const status of ["PENDING", "DECLINED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_TRAINER", "COMPLETED"]) {
      expect(canJoin({ ...online, status }, at("2026-09-20T10:30:00Z"))).toBe(false);
    }
  });
});

describe("joinState", () => {
  it("names why the room is shut", () => {
    expect(joinState(online, at("2026-09-20T10:30:00Z"))).toBe("OPEN");
    expect(joinState(online, at("2026-09-20T08:00:00Z"))).toBe("TOO_EARLY");
    expect(joinState(online, at("2026-09-20T12:00:00Z"))).toBe("ENDED");
    expect(joinState({ ...online, sessionType: "IN_PERSON" }, at("2026-09-20T10:30:00Z"))).toBe("NOT_ONLINE");
    expect(joinState({ ...online, status: "PENDING" }, at("2026-09-20T10:30:00Z"))).toBe("NOT_CONFIRMED");
  });

  it("reports the session type before the status", () => {
    const b = { ...online, sessionType: "IN_PERSON", status: "PENDING" };
    expect(joinState(b, at("2026-09-20T10:30:00Z"))).toBe("NOT_ONLINE");
  });
});
