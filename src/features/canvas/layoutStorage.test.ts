import { beforeEach, describe, expect, it } from "vitest";

import {
  calloutsShouldShow,
  mergeLayoutOverrides,
  saveLayoutOverrides,
} from "@/features/canvas/layoutStorage";
import { LAYOUT_OVERRIDE_VERSION } from "@/types/splice";

describe("mergeLayoutOverrides", () => {
  beforeEach(() => {
    localStorage.clear();
  });

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

  it("preserves legOverrides and fanoutOverrides on partial patch", () => {
    saveLayoutOverrides({
      reportKey: "report-persist",
      layoutVersion: LAYOUT_OVERRIDE_VERSION,
      positions: {},
      legOverrides: {
        conn1: { leftSegments: { 2: { dx: 12 } } },
      },
      fanoutOverrides: {
        "vc-left|BL": { shiftY: 8 },
      },
    });

    const merged = mergeLayoutOverrides("report-persist", {
      autoAdjustEnabled: true,
    });

    expect(merged.legOverrides?.conn1).toEqual({
      leftSegments: { 2: { dx: 12 } },
    });
    expect(merged.fanoutOverrides?.["vc-left|BL"]).toEqual({ shiftY: 8 });
  });

  it("toggle-style patch does not drop manual overrides", () => {
    saveLayoutOverrides({
      reportKey: "report-toggle",
      layoutVersion: LAYOUT_OVERRIDE_VERSION,
      positions: {},
      autoAdjustEnabled: false,
      legOverrides: { conn2: { rightSegments: { 1: { dx: -6 } } } },
      fanoutOverrides: { "vc-right|RD": { shiftY: -4 } },
    });

    const merged = mergeLayoutOverrides("report-toggle", {
      autoAdjustEnabled: true,
    });

    expect(merged.autoAdjustEnabled).toBe(true);
    expect(merged.legOverrides?.conn2).toEqual({
      rightSegments: { 1: { dx: -6 } },
    });
    expect(merged.fanoutOverrides?.["vc-right|RD"]).toEqual({ shiftY: -4 });
  });

  it("preserves locks on a partial patch and replaces when provided", () => {
    saveLayoutOverrides({
      reportKey: "report-locks",
      layoutVersion: LAYOUT_OVERRIDE_VERSION,
      positions: {},
      locks: {
        cables: { "vc-left": true },
        tubeGroups: { "vc-left|BL": true },
      },
    });

    // Partial patch (no locks) keeps stored locks.
    const kept = mergeLayoutOverrides("report-locks", {
      autoAdjustEnabled: false,
    });
    expect(kept.locks?.cables).toEqual({ "vc-left": true });
    expect(kept.locks?.tubeGroups).toEqual({ "vc-left|BL": true });

    // Provided locks fully replace (so a removed key actually unlocks).
    const replaced = mergeLayoutOverrides("report-locks", {
      locks: { cables: {}, tubeGroups: { "vc-left|BL": true } },
    });
    expect(replaced.locks?.cables).toEqual({});
    expect(replaced.locks?.tubeGroups).toEqual({ "vc-left|BL": true });
  });

  it("explicit empty override maps clear stored manual data", () => {
    saveLayoutOverrides({
      reportKey: "report-reset",
      layoutVersion: LAYOUT_OVERRIDE_VERSION,
      positions: {},
      tubeOverrides: { "vc-left|BL": { visualShiftY: 6 } },
      fanoutOverrides: { "vc-left|BL": { shiftY: 6 } },
      legOverrides: { conn3: { leftSegments: { 2: { dx: 10 } } } },
    });

    const merged = mergeLayoutOverrides("report-reset", {
      tubeOverrides: {},
      fanoutOverrides: {},
      legOverrides: {},
    });

    expect(merged.tubeOverrides).toEqual({});
    expect(merged.fanoutOverrides).toEqual({});
    expect(merged.legOverrides).toEqual({});
  });
});

describe("calloutsShouldShow", () => {
  it("respects explicit calloutsVisible flag", () => {
    expect(calloutsShouldShow({ calloutsVisible: false })).toBe(false);
    expect(calloutsShouldShow({ calloutsVisible: true })).toBe(true);
  });

  it("shows when stored callouts exist and visibility is unset", () => {
    expect(
      calloutsShouldShow({
        callouts: { "callout-c1": { targetCableNodeId: "c1", text: "A" } },
      }),
    ).toBe(true);
  });
});
