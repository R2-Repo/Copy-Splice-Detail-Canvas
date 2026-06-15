import { describe, expect, it } from "vitest";

import {
  diagramContentBounds,
  titleBoxHeight,
  titleBoxPosition,
  titleBoxWidth,
  TITLE_BOX,
} from "@/features/canvas/titleBox/titleBoxLayout";
import { CABLE_LAYOUT } from "@/features/diagram/cableLayoutMetrics";

describe("titleBoxLayout", () => {
  it("clamps width between min and max", () => {
    expect(titleBoxWidth(500)).toBe(TITLE_BOX.minWidth);
    expect(titleBoxWidth(1400)).toBe(520);
    expect(titleBoxWidth(2000)).toBe(TITLE_BOX.maxWidth);
  });

  it("positions above diagram content bounds with gap", () => {
    const bounds = diagramContentBounds([
      {
        position: { x: CABLE_LAYOUT.leftX, y: CABLE_LAYOUT.topY },
        width: 200,
        height: 400,
      },
    ]);
    expect(bounds).not.toBeNull();
    const layout = titleBoxPosition(1400, 1, bounds);
    expect(layout.x).toBe(CABLE_LAYOUT.leftX);
    expect(layout.y + layout.height).toBeCloseTo(
      CABLE_LAYOUT.topY - TITLE_BOX.gapBelow,
      0,
    );
  });

  it("falls back to topY anchor when bounds are missing", () => {
    const layout = titleBoxPosition(1400, 1, null);
    expect(layout.y + layout.height).toBeCloseTo(
      CABLE_LAYOUT.topY - TITLE_BOX.gapBelow,
      0,
    );
  });

  it("scales font and height with diagramScale", () => {
    const small = titleBoxHeight(1.08);
    const large = titleBoxHeight(0.88);
    expect(small).toBeGreaterThan(large);
  });
});
