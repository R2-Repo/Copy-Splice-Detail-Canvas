import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import { buildVisualCables } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

const examples = join(process.cwd(), "docs/reference/examples");

describe("connectionRowOffsets", () => {
  it("uses equal pitch within a buffer tube", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(
        readFileSync(join(examples, "CSV Splice Detail Example #1.csv"), "utf8"),
      ),
    );
    const offsets = connectionRowOffsets(graph);
    const values = [...offsets.values()].sort((a, b) => a - b);
    expect(values[1]! - values[0]!).toBe(FIBER_ROW_PITCH);
  });

  it("places Example #3 crossover RD/BK in BL tube slot 7–8 on 24 DIST", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(
        readFileSync(join(examples, "CSV Splice Detail Example #3.csv"), "utf8"),
      ),
    );
    const rowIdx = connectionRowIndexMap(graph);
    const vc = buildVisualCables(graph).find((v) => v.cable.includes("24 DIST"));
    expect(vc, "24 DIST visual cable").toBeDefined();
    const bl = vc!.tubes.find((t) => t.tubeColor === "BL")!;
    const byColor = Object.fromEntries(
      bl.fibers.map((f) => [f.fiberColor, rowIdx.get(f.connectionId)]),
    );
    const orBl = vc!.tubes.find((t) => t.tubeColor === "OR")!.fibers[0]!;
    expect(byColor.WH).toBeLessThan(byColor.RD!);
    expect(byColor.RD).toBeLessThan(byColor.BK!);
    expect(byColor.BK).toBeLessThan(byColor.YL!);
    expect(byColor.BK).toBeLessThan(rowIdx.get(orBl.connectionId)!);
  });

  it("adds extra gap at buffer-tube boundaries on Example #3", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(
        readFileSync(join(examples, "CSV Splice Detail Example #3.csv"), "utf8"),
      ),
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

  it("adds split-instance gap for Example #1 ring-cut 144 pair", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(
        readFileSync(join(examples, "CSV Splice Detail Example #1.csv"), "utf8"),
      ),
    );
    const visual = buildVisualCables(graph);
    const offsets = connectionRowOffsets(graph, visual);
    const values = [...offsets.values()].sort((a, b) => a - b);
    const steps = values.slice(1).map((y, i) => y - values[i]!);
    expect(steps.some((step) => step >= FIBER_ROW_PITCH * 2)).toBe(
      true,
    );
  });
});
