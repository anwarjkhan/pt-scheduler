import { describe, expect, it } from "vitest";
import { minutesToHHMM, snapStart, SNAP_MIN } from "./use-drag-reschedule";

const PX_PER_MIN = 1.1;
const base = { pxPerMin: PX_PER_MIN, durationMin: 60, minM: 7 * 60, maxM: 20 * 60 };
const at = (startMin: number, deltaPx: number) => snapStart({ ...base, startMin, deltaPx });

describe("minutesToHHMM", () => {
  it("zero-pads hours and minutes", () => {
    expect(minutesToHHMM(7 * 60)).toBe("07:00");
    expect(minutesToHHMM(9 * 60 + 5)).toBe("09:05");
    expect(minutesToHHMM(13 * 60 + 45)).toBe("13:45");
  });
});

describe("snapStart", () => {
  it("keeps the start put when the pointer has not moved", () => {
    expect(at(9 * 60, 0)).toBe(9 * 60);
  });

  it("snaps to the nearest 15 minutes", () => {
    // +20 min of travel rounds to +15, not +20.
    expect(at(9 * 60, 20 * PX_PER_MIN)).toBe(9 * 60 + 15);
    // +23 min is past the midpoint, so it rounds up to +30.
    expect(at(9 * 60, 23 * PX_PER_MIN)).toBe(9 * 60 + 30);
  });

  it("snaps upward when dragging backwards", () => {
    expect(at(9 * 60, -20 * PX_PER_MIN)).toBe(9 * 60 - 15);
  });

  it("always lands on a snap boundary from an off-grid start", () => {
    // A 09:10 booking snaps onto the grid rather than preserving its offset.
    const r = at(9 * 60 + 10, 0);
    expect(r % SNAP_MIN).toBe(0);
    expect(r).toBe(9 * 60 + 15);
  });

  it("clamps to the top of the visible range", () => {
    expect(at(8 * 60, -600 * PX_PER_MIN)).toBe(base.minM);
  });

  it("clamps so the block's end stays inside the range", () => {
    // A 60-min session can start no later than 19:00 in a range ending 20:00.
    expect(at(19 * 60, 600 * PX_PER_MIN)).toBe(base.maxM - 60);
  });

  it("accounts for duration when clamping", () => {
    const long = snapStart({ ...base, startMin: 18 * 60, deltaPx: 600 * PX_PER_MIN, durationMin: 120 });
    expect(long).toBe(base.maxM - 120);
  });
});
