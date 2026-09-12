import { describe, expect, it } from "vitest";
import {
  canClientCancel,
  evaluateSlot,
  expandSeries,
  generateSlots,
  getWindowsForDate,
  haversineMeters,
  rankAreas,
  timeKey,
  zoned,
  type CommuteFn,
  type ExistingBooking,
  type Rule,
  type SchedulingSettings,
} from "./index";

const TZ = "Europe/London";
const HOME = { lat: 51.5, lng: -0.12 };
const A = { lat: 51.52, lng: -0.1 }; // near home
const B = { lat: 51.6, lng: -0.3 }; // ~15 km from A

/** Deterministic commute: 20 min between distinct points, 0 for identical. */
const commute20: CommuteFn = async (from, to) =>
  from.lat === to.lat && from.lng === to.lng
    ? { seconds: 0, meters: 0, estimated: false }
    : { seconds: 20 * 60, meters: 10_000, estimated: false };

const settings: SchedulingSettings = {
  timezone: TZ,
  home: HOME,
  bufferMinutes: 10,
  slotStepMinutes: 30,
  minNoticeHours: 24,
  maxRadiusMiles: 15,
};

const weekdays: Rule[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "07:00", endTime: "20:00" }));

const MON = "2026-09-14"; // a Monday
const at = (hhmm: string, date = MON) => zoned(date, hhmm, TZ);
const booking = (id: string, s: string, e: string, loc = A, status = "ACCEPTED"): ExistingBooking => ({
  id,
  start: at(s),
  end: at(e),
  loc,
  status,
});

describe("availability windows", () => {
  it("uses the weekly template for the weekday", () => {
    const w = getWindowsForDate(MON, TZ, weekdays, []);
    expect(w).toHaveLength(1);
    expect(timeKey(w[0].start, TZ)).toBe("07:00");
    expect(timeKey(w[0].end, TZ)).toBe("20:00");
  });

  it("returns nothing on days without rules", () => {
    expect(getWindowsForDate("2026-09-13", TZ, weekdays, [])).toEqual([]); // Sunday
  });

  it("whole-day UNAVAILABLE exception clears the day", () => {
    expect(getWindowsForDate(MON, TZ, weekdays, [{ date: MON, type: "UNAVAILABLE" }])).toEqual([]);
  });

  it("partial UNAVAILABLE splits the window", () => {
    const w = getWindowsForDate(MON, TZ, weekdays, [
      { date: MON, type: "UNAVAILABLE", startTime: "12:00", endTime: "14:00" },
    ]);
    expect(w.map((x) => [timeKey(x.start, TZ), timeKey(x.end, TZ)])).toEqual([
      ["07:00", "12:00"],
      ["14:00", "20:00"],
    ]);
  });

  it("EXTRA adds a window on an otherwise closed day and merges overlaps", () => {
    const sun = "2026-09-13";
    const w = getWindowsForDate(sun, TZ, weekdays, [
      { date: sun, type: "EXTRA", startTime: "09:00", endTime: "11:00" },
      { date: sun, type: "EXTRA", startTime: "10:00", endTime: "12:00" },
    ]);
    expect(w.map((x) => [timeKey(x.start, TZ), timeKey(x.end, TZ)])).toEqual([["09:00", "12:00"]]);
  });

  it("merges adjacent template ranges", () => {
    const rules: Rule[] = [
      { weekday: 1, startTime: "07:00", endTime: "10:00" },
      { weekday: 1, startTime: "10:00", endTime: "12:00" },
    ];
    expect(getWindowsForDate(MON, TZ, rules, [])).toHaveLength(1);
  });
});

describe("evaluateSlot", () => {
  const windows = getWindowsForDate(MON, TZ, weekdays, []);

  it("first booking of the day: home legs, no shortfall", async () => {
    const r = await evaluateSlot({ start: at("09:00"), end: at("10:00"), loc: A }, [], windows, settings, commute20);
    expect(r.ok).toBe(true);
    expect(r.warning).toBe(false);
    expect(r.before?.anchor).toBe("home");
    expect(r.before?.travelMin).toBe(20);
    expect(r.after?.anchor).toBe("home");
  });

  it("flags a hard overlap", async () => {
    const r = await evaluateSlot(
      { start: at("09:30"), end: at("10:30"), loc: A },
      [booking("x", "09:00", "10:00")],
      windows,
      settings,
      commute20,
    );
    expect(r.ok).toBe(false);
    expect(r.overlaps).toBe(true);
    expect(r.overlapWith).toBe("x");
  });

  it("warns when gap to previous booking is shorter than travel + buffer", async () => {
    // prev ends 10:00 at A, candidate starts 10:15 at B: needs 20+10=30, has 15 → shortfall 15
    const r = await evaluateSlot(
      { start: at("10:15"), end: at("11:15"), loc: B },
      [booking("p", "09:00", "10:00", A)],
      windows,
      settings,
      commute20,
    );
    expect(r.ok).toBe(true);
    expect(r.warning).toBe(true);
    expect(r.before).toMatchObject({ anchor: "booking", bookingId: "p", gapMin: 15, requiredMin: 30, shortfallMin: 15 });
  });

  it("exact fit is not a warning", async () => {
    const r = await evaluateSlot(
      { start: at("10:30"), end: at("11:30"), loc: B },
      [booking("p", "09:00", "10:00", A)],
      windows,
      settings,
      commute20,
    );
    expect(r.warning).toBe(false);
    expect(r.before?.shortfallMin).toBe(0);
  });

  it("same location back-to-back needs no travel", async () => {
    const r = await evaluateSlot(
      { start: at("10:00"), end: at("11:00"), loc: A },
      [booking("p", "09:00", "10:00", A)],
      windows,
      settings,
      commute20,
    );
    expect(r.warning).toBe(false);
    expect(r.before?.requiredMin).toBe(0);
  });

  it("checks the leg to the next booking too", async () => {
    const r = await evaluateSlot(
      { start: at("09:00"), end: at("10:00"), loc: B },
      [booking("n", "10:20", "11:20", A)],
      windows,
      settings,
      commute20,
    );
    expect(r.after).toMatchObject({ bookingId: "n", gapMin: 20, shortfallMin: 10 });
    expect(r.warning).toBe(true);
  });

  it("ignores cancelled/declined bookings", async () => {
    const r = await evaluateSlot(
      { start: at("09:00"), end: at("10:00"), loc: A },
      [booking("c", "09:00", "10:00", A, "CANCELLED_BY_CLIENT"), booking("d", "09:00", "10:00", A, "DECLINED")],
      windows,
      settings,
      commute20,
    );
    expect(r.ok).toBe(true);
  });

  it("marks slots outside availability", async () => {
    const r = await evaluateSlot({ start: at("06:00"), end: at("07:00"), loc: A }, [], windows, settings, commute20);
    expect(r.ok).toBe(false);
    expect(r.outsideAvailability).toBe(true);
  });
});

describe("generateSlots", () => {
  const windows = getWindowsForDate(MON, TZ, weekdays, []);
  const now = at("08:00", "2026-09-10"); // several days before

  it("produces 30-min-step starts that fit the duration and skip overlaps", async () => {
    const slots = await generateSlots(windows, 60, B, [booking("p", "09:00", "10:00", A)], settings, commute20, now);
    const starts = slots.map((s) => timeKey(s.start, TZ));
    expect(starts[0]).toBe("07:00");
    expect(starts).not.toContain("08:30"); // would overlap 09:00-10:00
    expect(starts).not.toContain("09:00");
    expect(starts).not.toContain("09:30");
    expect(starts).toContain("10:00");
    expect(starts[starts.length - 1]).toBe("19:00"); // last 60-min slot before 20:00
    const tight = slots.find((s) => timeKey(s.start, TZ) === "10:00");
    expect(tight?.evaluation.warning).toBe(true);
  });

  it("respects minimum notice", async () => {
    const slots = await generateSlots(windows, 30, A, [], settings, commute20, at("10:00", "2026-09-13"));
    // now = Sun 10:00 → earliest Mon 10:00
    expect(timeKey(slots[0].start, TZ)).toBe("10:00");
  });
});

describe("expandSeries", () => {
  it("expands weekly from the first matching weekday to the end date inclusive", () => {
    const occ = expandSeries(
      { weekday: 3, startTime: "18:00", durationMin: 60, startDate: "2026-09-14", endDate: "2026-10-07" },
      TZ,
    );
    expect(occ.map((o) => o.date)).toEqual(["2026-09-16", "2026-09-23", "2026-09-30", "2026-10-07"]);
    expect(timeKey(occ[0].start, TZ)).toBe("18:00");
    expect(timeKey(occ[0].end, TZ)).toBe("19:00");
  });

  it("keeps local time across a DST change", () => {
    const occ = expandSeries(
      { weekday: 0, startTime: "09:00", durationMin: 60, startDate: "2026-10-18", endDate: "2026-11-01" },
      TZ,
    );
    // UK clocks go back 2026-10-25
    expect(occ.map((o) => timeKey(o.start, TZ))).toEqual(["09:00", "09:00", "09:00"]);
  });

  it("caps at 12 weeks", () => {
    const occ = expandSeries(
      { weekday: 1, startTime: "09:00", durationMin: 60, startDate: "2026-01-05", endDate: "2026-12-31" },
      TZ,
    );
    expect(occ).toHaveLength(12);
  });
});

describe("rules", () => {
  it("24h cancellation rule", () => {
    const start = at("10:00");
    expect(canClientCancel(start, 24, at("10:00", "2026-09-13"))).toBe(true);
    expect(canClientCancel(start, 24, at("10:01", "2026-09-13"))).toBe(false);
  });
});

describe("geo", () => {
  it("haversine roughly matches known distance", () => {
    // London → Brighton ≈ 76 km
    const d = haversineMeters({ lat: 51.5074, lng: -0.1278 }, { lat: 50.8225, lng: -0.1372 });
    expect(d).toBeGreaterThan(75_000);
    expect(d).toBeLessThan(78_000);
  });
});

describe("rankAreas", () => {
  const areas = [
    { label: "Weybridge", lat: 51.371, lng: -0.457, radiusMiles: 5 },
    { label: "Richmond", lat: 51.461, lng: -0.303, radiusMiles: 3 },
  ];
  it("orders by straight-line distance and flags impossible ones", () => {
    // Esher-ish point: ~4 mi from Weybridge, ~8 mi from Richmond
    const r = rankAreas({ lat: 51.369, lng: -0.365 }, areas);
    expect(r[0].area.label).toBe("Weybridge");
    expect(r[0].possible).toBe(true);
    expect(r[1].area.label).toBe("Richmond");
    expect(r[1].possible).toBe(false);
  });
  it("returns empty for no areas", () => {
    expect(rankAreas({ lat: 0, lng: 0 }, [])).toEqual([]);
  });
});
