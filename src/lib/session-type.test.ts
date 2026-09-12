import { describe, expect, it } from "vitest";
import { sessionCoords } from "./bookings";
import { evaluateSlot, zoned, type CommuteFn, type ExistingBooking, type SchedulingSettings } from "./scheduling";

const TZ = "Europe/London";
const HOME = { lat: 51.5, lng: -0.12 };
const CLIENT = { lat: 51.6, lng: -0.3 }; // ~20 min from home

/** 20 minutes between any two distinct points, 0 between identical ones. */
const commute20: CommuteFn = async (from, to) =>
  from.lat === to.lat && from.lng === to.lng
    ? { seconds: 0, meters: 0, estimated: false }
    : { seconds: 20 * 60, meters: 10_000, estimated: false };

const settings: Pick<SchedulingSettings, "home" | "bufferMinutes"> = { home: HOME, bufferMinutes: 10 };

const MON = "2026-09-14";
const at = (hhmm: string) => zoned(MON, hhmm, TZ);
const windows = [{ start: at("07:00"), end: at("20:00") }];

describe("sessionCoords", () => {
  it("puts an online session at the trainer's home, not the client's address", () => {
    expect(sessionCoords("ONLINE", CLIENT, HOME)).toEqual(HOME);
  });

  it("leaves an in-person session at the client's address", () => {
    expect(sessionCoords("IN_PERSON", CLIENT, HOME)).toEqual(CLIENT);
  });

  it("falls back to the client's address when no home is configured", () => {
    expect(sessionCoords("ONLINE", CLIENT, null)).toEqual(CLIENT);
  });

  it("treats an unknown type as in-person", () => {
    expect(sessionCoords("SOMETHING_ELSE", CLIENT, HOME)).toEqual(CLIENT);
  });
});

describe("online sessions reserve the journey home", () => {
  const inPersonBefore: ExistingBooking = {
    id: "earlier",
    start: at("09:00"),
    end: at("10:00"),
    loc: CLIENT,
    status: "ACCEPTED",
  };

  /** An online session at `start`, placed at home as the booking flow does. */
  const online = (start: string, end: string) => ({
    start: at(start),
    end: at(end),
    loc: sessionCoords("ONLINE", CLIENT, HOME),
  });

  it("warns when there is not enough time to drive home first", () => {
    // 10:00 finish at the client, online session at 10:15 — 15 min for a
    // 20 min drive plus 10 min buffer.
    return evaluateSlot(online("10:15", "11:15"), [inPersonBefore], windows, settings, commute20).then((ev) => {
      expect(ev.warning).toBe(true);
      expect(ev.before?.requiredMin).toBe(30);
      expect(ev.before?.gapMin).toBe(15);
      expect(ev.before?.shortfallMin).toBe(15);
    });
  });

  it("is happy once the gap covers the drive and buffer", async () => {
    const ev = await evaluateSlot(online("10:30", "11:30"), [inPersonBefore], windows, settings, commute20);
    expect(ev.warning).toBe(false);
    expect(ev.before?.shortfallMin).toBe(0);
  });

  it("needs no travel between two consecutive online sessions", async () => {
    const earlierOnline: ExistingBooking = {
      id: "earlier-online",
      start: at("09:00"),
      end: at("10:00"),
      loc: sessionCoords("ONLINE", CLIENT, HOME),
      status: "ACCEPTED",
    };
    const ev = await evaluateSlot(online("10:00", "11:00"), [earlierOnline], windows, settings, commute20);
    expect(ev.before?.requiredMin).toBe(0);
    expect(ev.warning).toBe(false);
  });

  it("still requires the drive out to a client after an online session", async () => {
    const onlineBefore: ExistingBooking = {
      id: "online-first",
      start: at("09:00"),
      end: at("10:00"),
      loc: sessionCoords("ONLINE", CLIENT, HOME),
      status: "ACCEPTED",
    };
    // In-person straight after an online session: still 20 min away + buffer.
    const ev = await evaluateSlot({ start: at("10:15"), end: at("11:15"), loc: CLIENT }, [onlineBefore], windows, settings, commute20);
    expect(ev.warning).toBe(true);
    expect(ev.before?.shortfallMin).toBe(15);
  });
});
