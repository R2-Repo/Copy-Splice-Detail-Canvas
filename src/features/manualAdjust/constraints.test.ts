import { describe, expect, it } from "vitest";

import { FUSION_DOT_MIN_CORNER_CLEARANCE } from "@/features/canvas/edges/splicePathGeometry";

import {
  fusionDotCornerClearanceOk,
  fusionDotOnHorizontalSegment,
} from "./constraints";

describe("DOT-003 fusion dot constraints", () => {
  it("requires 48px corner clearance constant", () => {
    expect(FUSION_DOT_MIN_CORNER_CLEARANCE).toBe(48);
  });

  it("accepts dot on horizontal segment with clearance", () => {
    const leftPath = "M 100,80 L 300,80";
    const rightPath = "M 300,80 L 500,80";
    expect(fusionDotOnHorizontalSegment(300, 80, leftPath, rightPath)).toBe(
      true,
    );
    expect(fusionDotCornerClearanceOk(200, 80, leftPath, rightPath)).toBe(
      true,
    );
  });
});
