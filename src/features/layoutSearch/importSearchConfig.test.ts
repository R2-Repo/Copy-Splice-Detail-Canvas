import { describe, expect, it, vi } from "vitest";

import {
  debugImportOptimizerEnabled,
  debugImportTimingEnabled,
  parseForcedLayoutSides,
  layoutSearchMode,
  importPerformanceBudgetEnabled,
  checkImportPerformanceBudget,
} from "./importSearchConfig";

describe("importSearchConfig", () => {
  it("parseForcedLayoutSides returns empty when unset", () => {
    expect(parseForcedLayoutSides()).toEqual([]);
  });

  it("layoutSearchMode defaults to beam", () => {
    expect(layoutSearchMode()).toBe("beam");
  });

  it("parseForcedLayoutSides parses cable:side pairs", () => {
    vi.stubEnv("VITE_FORCE_LAYOUT_SIDES", "CableA:top,CableB:right");
    expect(parseForcedLayoutSides()).toEqual([
      { cable: "CableA", side: "top" },
      { cable: "CableB", side: "right" },
    ]);
    vi.unstubAllEnvs();
  });

  it("debugImportOptimizerEnabled reads master flag", () => {
    vi.stubEnv("VITE_DEBUG_IMPORT_OPTIMIZER", "1");
    expect(debugImportOptimizerEnabled()).toBe(true);
    expect(debugImportTimingEnabled()).toBe(true);
    expect(importPerformanceBudgetEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("importPerformanceBudgetEnabled is true when debug off", () => {
    vi.unstubAllEnvs();
    expect(importPerformanceBudgetEnabled()).toBe(true);
  });

  it("checkImportPerformanceBudget warns and fails at thresholds", () => {
    expect(checkImportPerformanceBudget(9_000).warn).toBe(false);
    expect(checkImportPerformanceBudget(10_000).warn).toBe(true);
    expect(checkImportPerformanceBudget(14_999).exceeded).toBe(false);
    expect(checkImportPerformanceBudget(15_000).exceeded).toBe(true);
  });
});
