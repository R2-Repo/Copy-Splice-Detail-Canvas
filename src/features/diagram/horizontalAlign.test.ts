import { describe, expect, it } from "vitest";

import { FIBER_ROW_PITCH } from "@/features/diagram/cableLayoutMetrics";
import {
  computeNearStraightShift,
  HORIZONTAL_ALIGN_TOLERANCE,
  type AlignConnection,
} from "@/features/diagram/horizontalAlign";

const partner = (y: number) => () => y;

describe("HORIZONTAL_ALIGN_TOLERANCE", () => {
  it("is half the fiber pitch", () => {
    expect(HORIZONTAL_ALIGN_TOLERANCE).toBe(FIBER_ROW_PITCH / 2);
  });
});

describe("computeNearStraightShift", () => {
  it("snaps a leg that is a few px off to perfectly flat", () => {
    // own handle at y=100+0=100, partner handle at 105 -> shift own by +5.
    const conns: AlignConnection[] = [
      { ownOffset: 0, partnerCableId: "p", partnerOffset: 5 },
    ];
    expect(computeNearStraightShift(100, conns, partner(100))).toBeCloseTo(5);
  });

  it("does not snap when the gap exceeds tolerance", () => {
    const conns: AlignConnection[] = [
      { ownOffset: 0, partnerCableId: "p", partnerOffset: 20 },
    ];
    // gap 20 > 12 tolerance.
    expect(computeNearStraightShift(100, conns, partner(100))).toBe(0);
  });

  it("returns 0 when already flat", () => {
    const conns: AlignConnection[] = [
      { ownOffset: 10, partnerCableId: "p", partnerOffset: 10 },
    ];
    expect(computeNearStraightShift(100, conns, partner(100))).toBe(0);
  });

  it("picks the shift that flattens the most legs", () => {
    // Two legs want +6, one leg wants +3 -> choose +6 (2 vs 1).
    const conns: AlignConnection[] = [
      { ownOffset: 0, partnerCableId: "a", partnerOffset: 6 },
      { ownOffset: 0, partnerCableId: "b", partnerOffset: 6 },
      { ownOffset: 0, partnerCableId: "c", partnerOffset: 3 },
    ];
    const shift = computeNearStraightShift(0, conns, (id) =>
      id === "a" || id === "b" || id === "c" ? 0 : undefined,
    );
    expect(shift).toBeCloseTo(6);
  });

  it("does not move when it would un-flatten more legs than it flattens", () => {
    // Two legs already flat (gap 0), one leg wants +4. Moving breaks 2 to fix 1.
    const conns: AlignConnection[] = [
      { ownOffset: 0, partnerCableId: "a", partnerOffset: 0 },
      { ownOffset: 0, partnerCableId: "b", partnerOffset: 0 },
      { ownOffset: 0, partnerCableId: "c", partnerOffset: 4 },
    ];
    const shift = computeNearStraightShift(0, conns, () => 0);
    expect(shift).toBe(0);
  });

  it("prefers the smaller shift on a tie", () => {
    const conns: AlignConnection[] = [
      { ownOffset: 0, partnerCableId: "a", partnerOffset: 8 },
      { ownOffset: 0, partnerCableId: "b", partnerOffset: 3 },
    ];
    const shift = computeNearStraightShift(0, conns, () => 0);
    expect(shift).toBeCloseTo(3);
  });

  it("ignores partners with unknown position", () => {
    const conns: AlignConnection[] = [
      { ownOffset: 0, partnerCableId: "missing", partnerOffset: 5 },
    ];
    expect(computeNearStraightShift(0, conns, () => undefined)).toBe(0);
  });
});
