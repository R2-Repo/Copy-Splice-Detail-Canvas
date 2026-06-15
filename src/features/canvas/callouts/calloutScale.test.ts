import { describe, expect, it } from "vitest";

import {
  CALLOUT_AUTO_ZOOM_DEFAULT,
  CALLOUT_SCALE_DEFAULT,
  calloutScalePercent,
  clampCalloutScale,
  effectiveCalloutScale,
} from "@/features/canvas/callouts/calloutScale";

describe("calloutScale", () => {
  it("clamps user scale to 0.5–3.0", () => {
    expect(clampCalloutScale(0.1)).toBe(0.5);
    expect(clampCalloutScale(5)).toBe(3);
    expect(clampCalloutScale(1.5)).toBe(1.5);
  });

  it("returns user scale when auto-zoom is off", () => {
    expect(
      effectiveCalloutScale(1.5, 0.3, {
        autoZoomCompensate: false,
        isPrinting: false,
      }),
    ).toBe(1.5);
  });

  it("compensates zoom when auto-zoom is on", () => {
    expect(
      effectiveCalloutScale(1, 0.5, {
        autoZoomCompensate: true,
        isPrinting: false,
      }),
    ).toBe(2);
  });

  it("uses user scale only when printing", () => {
    expect(
      effectiveCalloutScale(1.5, 0.2, {
        autoZoomCompensate: true,
        isPrinting: true,
      }),
    ).toBe(1.5);
  });

  it("caps effective scale at 5.0 for extreme zoom-out", () => {
    expect(
      effectiveCalloutScale(1, 0.05, {
        autoZoomCompensate: true,
        isPrinting: false,
      }),
    ).toBe(5);
  });

  it("formats percent for slider display", () => {
    expect(calloutScalePercent(1.5)).toBe(150);
  });

  it("exports sensible defaults", () => {
    expect(CALLOUT_SCALE_DEFAULT).toBe(1);
    expect(CALLOUT_AUTO_ZOOM_DEFAULT).toBe(true);
  });
});
