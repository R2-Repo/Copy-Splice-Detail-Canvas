import { describe, expect, it } from "vitest";

import {
  fiberRowLayoutXs,
  fixedHandleOutsetFromStem,
  formattedCircuitTagWidth,
  spliceHandleOutsetFromStem,
} from "@/features/diagram/cableLabels";
import {
  FIBER_CODE_HANDLE_GAP,
  FIBER_CIRCUIT_MAX_WIDTH,
  FIBER_HANDLE_DOT,
  FIBER_LABEL_CODE_GAP,
  FIBER_ROW_CODE_MIN_WIDTH,
  FIBER_ROW_INNER_GAP,
  FIBER_ROW_SWATCH_WIDTH,
  fiberCodeColumnWidth,
  fiberRowPrefixWidth,
  SPLICE_HANDLE_OVERHANG,
} from "@/features/diagram/cableLayoutMetrics";

describe("fixedHandleOutsetFromStem", () => {
  it("uses max circuit slot + code column + overhang for aligned handles", () => {
    const fixed = fixedHandleOutsetFromStem();
    expect(fixed).toBe(fiberRowPrefixWidth() + FIBER_CIRCUIT_MAX_WIDTH + SPLICE_HANDLE_OVERHANG);
    expect(fixed).toBe(
      FIBER_ROW_SWATCH_WIDTH +
        FIBER_ROW_INNER_GAP +
        FIBER_CIRCUIT_MAX_WIDTH +
        fiberCodeColumnWidth() +
        SPLICE_HANDLE_OVERHANG,
    );
    const shortTag = spliceHandleOutsetFromStem("CH 1");
    const longTag = spliceHandleOutsetFromStem("CH 2004 LONG NAME");
    expect(shortTag).toBeLessThan(fixed);
    expect(longTag).toBeLessThanOrEqual(fixed);
    expect(formattedCircuitTagWidth("CH 2004 LONG NAME")).toBeLessThanOrEqual(
      FIBER_CIRCUIT_MAX_WIDTH,
    );
  });
});

describe("fiberRowLayoutXs", () => {
  const stemX = 120;

  it("places code column immediately left of handle", () => {
    const layout = fiberRowLayoutXs(stemX, "CH 3254");
    expect(layout.handleX).toBe(stemX + fixedHandleOutsetFromStem());
    expect(layout.codeLeftX).toBe(
      layout.handleX -
        FIBER_HANDLE_DOT / 2 -
        FIBER_CODE_HANDLE_GAP -
        FIBER_ROW_CODE_MIN_WIDTH,
    );
    expect(layout.labelEndX).toBe(layout.codeLeftX - FIBER_LABEL_CODE_GAP);
    expect(layout.fanToX).toBe(layout.labelStartX);
    expect(layout.labelStartX).toBeLessThan(layout.labelEndX);
  });

  it("stops fan at label start; long labels extend fan horizontal further", () => {
    const short = fiberRowLayoutXs(stemX, "CH 1");
    const long = fiberRowLayoutXs(stemX, "ATMS CENTRAL UTAH COUNTY HUB");
    expect(short.fanToX).toBeGreaterThan(long.fanToX);
    expect(short.labelEndX).toBe(long.labelEndX);
    expect(short.labelStartX).toBeGreaterThan(long.labelStartX);
    expect(short.handleX).toBe(long.handleX);
    expect(short.codeLeftX).toBe(long.codeLeftX);
  });
});
