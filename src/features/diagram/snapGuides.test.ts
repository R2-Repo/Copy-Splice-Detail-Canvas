import { describe, expect, it } from "vitest";

import {
  snapStemReachX,
  snapToNearestTarget,
  snapToPitch,
  snapTubeTipShiftY,
} from "@/features/diagram/snapGuides";

describe("snapGuides", () => {
  it("snapToPitch rounds to 24px grid", () => {
    expect(snapToPitch(11)).toBe(0);
    expect(snapToPitch(13)).toBe(24);
    expect(snapToPitch(-13)).toBe(-24);
  });

  it("snapToNearestTarget picks closest guide within tolerance", () => {
    expect(snapToNearestTarget(102, [100, 200], 8)).toBe(100);
    expect(snapToNearestTarget(130, [100, 200], 8)).toBe(130);
  });

  it("snapTubeTipShiftY snaps absolute tip to layout line", () => {
    const shift = snapTubeTipShiftY(5, 105, [100], 8);
    expect(shift).toBe(-5);
  });

  it("snapStemReachX snaps toward aligned stem reach", () => {
    const snapped = snapStemReachX(3, 120, 96, 40, 8);
    expect(snapped).toBe(0);
  });
});
