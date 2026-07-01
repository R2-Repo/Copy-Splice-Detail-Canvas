import { describe, expect, it } from "vitest";

import {
  fanShiftDeltaFromFiberDrag,
  quadFanShiftDeltaFromDrag,
} from "./quadManualAdjust";

describe("quadFanShiftDeltaFromDrag", () => {
  it("maps top-edge canvas X drag to negative visualShiftY", () => {
    expect(
      quadFanShiftDeltaFromDrag("top", { x: 100, y: 50 }, { x: 124, y: 50 }),
    ).toBe(-24);
    expect(
      quadFanShiftDeltaFromDrag("top", { x: 100, y: 50 }, { x: 76, y: 50 }),
    ).toBe(24);
  });

  it("maps bottom-edge canvas X drag to positive visualShiftY", () => {
    expect(
      quadFanShiftDeltaFromDrag(
        "bottom",
        { x: 100, y: 50 },
        { x: 124, y: 50 },
      ),
    ).toBe(24);
  });

  it("uses canvas Y for left/right cables", () => {
    expect(
      fanShiftDeltaFromFiberDrag(
        { x: 10, y: 100 },
        { x: 10, y: 124 },
        undefined,
      ),
    ).toBe(24);
    expect(
      fanShiftDeltaFromFiberDrag(
        { x: 10, y: 100 },
        { x: 10, y: 124 },
        "left",
      ),
    ).toBe(24);
  });
});
