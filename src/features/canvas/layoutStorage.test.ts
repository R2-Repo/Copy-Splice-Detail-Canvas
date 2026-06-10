import { describe, expect, it } from "vitest";

import { mergeLayoutOverrides } from "@/features/canvas/layoutStorage";
import { LAYOUT_OVERRIDE_VERSION } from "@/types/splice";

describe("mergeLayoutOverrides", () => {
  it("merges autoAdjustEnabled and tubeOverrides", () => {
    const merged = mergeLayoutOverrides("report-1", {
      autoAdjustEnabled: false,
      tubeOverrides: {
        "vc-left|BL": { visualShiftY: 6, stemReachX: 4 },
      },
    });
    expect(merged.layoutVersion).toBe(LAYOUT_OVERRIDE_VERSION);
    expect(merged.autoAdjustEnabled).toBe(false);
    expect(merged.tubeOverrides?.["vc-left|BL"]).toEqual({
      visualShiftY: 6,
      stemReachX: 4,
    });
  });

  it("defaults autoAdjustEnabled to true", () => {
    const merged = mergeLayoutOverrides("report-2", {
      positions: {},
    });
    expect(merged.autoAdjustEnabled).toBe(true);
  });
});
