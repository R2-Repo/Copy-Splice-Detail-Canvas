import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import {
  FIBER_ROW_PITCH,
  TUBE_GROUP_GAP,
} from "./cableLayoutMetrics";
import {
  connectionRowIndexMap,
  connectionRowOffsets,
} from "./connectionRowOrder";
import { buildVisualCablesForLayout } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

describe("connectionRowOffsets", () => {
  it("uses equal pitch within a buffer tube", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #1.csv")),
    );
    const offsets = connectionRowOffsets(graph);
    const values = [...offsets.values()].sort((a, b) => a - b);
    expect(values[1]! - values[0]!).toBe(FIBER_ROW_PITCH);
  });

  it("Example #3: row order follows CSV import sequence", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #3.csv")),
    );
    const rowIdx = connectionRowIndexMap(graph);
    const ordered = [...rowIdx.entries()].sort((a, b) => a[1] - b[1]);
    expect(ordered.length).toBeGreaterThan(0);
    expect(new Set(ordered.map(([, i]) => i)).size).toBe(ordered.length);
  });

  it("adds extra gap at buffer-tube boundaries on Example #3", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #3.csv")),
    );
    const offsets = connectionRowOffsets(graph);
    const values = [...offsets.values()].sort((a, b) => a - b);
    const steps = values.slice(1).map((y, i) => y - values[i]!);
    expect(steps.some((step) => step === FIBER_ROW_PITCH + TUBE_GROUP_GAP)).toBe(
      true,
    );
    expect(steps.every((step) => step === FIBER_ROW_PITCH || step === FIBER_ROW_PITCH + TUBE_GROUP_GAP)).toBe(
      true,
    );
  });

  it("Example #1: row offsets use uniform pitch (no ring-cut split gap)", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #1.csv")),
    );
    const visual = buildVisualCablesForLayout(graph).visualCables;
    const offsets = connectionRowOffsets(graph, visual);
    const values = [...offsets.values()].sort((a, b) => a - b);
    const steps = values.slice(1).map((y, i) => y - values[i]!);
    expect(steps.every((step) => step === FIBER_ROW_PITCH || step === FIBER_ROW_PITCH + TUBE_GROUP_GAP)).toBe(
      true,
    );
  });
});
