import { beforeEach, describe, expect, it } from "vitest";

import {
  calloutsShouldShow,
  loadLayoutOverrides,
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

  it("preserves tube locks on a partial patch and replaces when provided", () => {
    saveLayoutOverrides({
      reportKey: "report-locks",
      layoutVersion: LAYOUT_OVERRIDE_VERSION,
      positions: {},
      locks: {
        tubeGroups: { "vc-left|BL": true },
      },
    });

    const kept = mergeLayoutOverrides("report-locks", {
      autoAdjustEnabled: false,
    });
    expect(kept.locks?.tubeGroups).toEqual({ "vc-left|BL": true });

    const replaced = mergeLayoutOverrides("report-locks", {
      locks: { tubeGroups: {} },
    });
    expect(replaced.locks?.tubeGroups).toEqual({});
  });

  it("strips legacy cable locks on load and merge", () => {
    localStorage.setItem(
      "report-legacy-locks",
      JSON.stringify({
        reportKey: "report-legacy-locks",
        layoutVersion: LAYOUT_OVERRIDE_VERSION,
        positions: {},
        locks: { cables: { "vc-left": true }, tubeGroups: { "vc-left|BL": true } },
        gridLocks: {
          segments: [],
          dots: [],
          cables: ["vc-left"],
          tubeGroups: ["vc-left|BL"],
        },
      }),
    );

    const loaded = loadLayoutOverrides("report-legacy-locks");
    expect(loaded?.locks?.tubeGroups).toEqual({ "vc-left|BL": true });
    expect(loaded?.locks).not.toHaveProperty("cables");
    expect(loaded?.gridLocks).not.toHaveProperty("cables");
  });

  it("explicit empty override maps clear stored manual data", () => {
    saveLayoutOverrides({
      reportKey: "report-reset",
      layoutVersion: LAYOUT_OVERRIDE_VERSION,
      positions: { "cable-a": { x: 10, y: 20 } },
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
    expect(merged.positions["cable-a"]).toEqual({ x: 10, y: 20 });
  });

  it("round-trips all override maps through auto/manual toggle merge", () => {
    saveLayoutOverrides({
      reportKey: "report-roundtrip",
      layoutVersion: LAYOUT_OVERRIDE_VERSION,
      positions: { "cable-vc1": { x: 40, y: 80 } },
      autoAdjustEnabled: false,
      tubeOverrides: { "vc1|BL": { visualShiftY: 5 } },
      fanoutOverrides: { "vc1|BL": { shiftY: 5 } },
      legOverrides: { conn1: { dotShiftX: 9 } },
    });

    const toAuto = mergeLayoutOverrides("report-roundtrip", {
      autoAdjustEnabled: true,
    });
    saveLayoutOverrides(toAuto);
    const reloaded = loadLayoutOverrides("report-roundtrip");

    expect(reloaded?.autoAdjustEnabled).toBe(true);
    expect(reloaded?.positions["cable-vc1"]).toEqual({ x: 40, y: 80 });
    expect(reloaded?.tubeOverrides?.["vc1|BL"]).toEqual({ visualShiftY: 5 });
    expect(reloaded?.fanoutOverrides?.["vc1|BL"]).toEqual({ shiftY: 5 });
    expect(reloaded?.legOverrides?.conn1).toEqual({ dotShiftX: 9 });

    const backManual = mergeLayoutOverrides("report-roundtrip", {
      autoAdjustEnabled: false,
    });
    expect(backManual.legOverrides?.conn1).toEqual({ dotShiftX: 9 });
    expect(backManual.connectionOverrides?.conn1).toEqual({ dotOffsetX: 9 });
    expect(backManual.fanoutOverrides?.["vc1|BL"]).toEqual({ shiftY: 5 });
  });

  it("merges connectionOverrides and bundleOverrides on partial patch", () => {
    saveLayoutOverrides({
      reportKey: "report-conn-bundle",
      layoutVersion: LAYOUT_OVERRIDE_VERSION,
      positions: {},
      connectionOverrides: { conn1: { dotOffsetX: 4 } },
      bundleOverrides: { "vc|BL|vc2": { laneOffsetX: 8 } },
    });

    const merged = mergeLayoutOverrides("report-conn-bundle", {
      autoAdjustEnabled: false,
    });

    expect(merged.connectionOverrides?.conn1).toEqual({ dotOffsetX: 4 });
    expect(merged.bundleOverrides?.["vc|BL|vc2"]).toEqual({ laneOffsetX: 8 });
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
