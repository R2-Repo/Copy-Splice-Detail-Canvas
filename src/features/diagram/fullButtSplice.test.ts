import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import {
  detectFullButtSpliceTubes,
  resolveFullButtSpliceVisuals,
} from "./fullButtSplice";
import { buildVisualCablesForLayout } from "./visualCables";
import { compareTubeColorsTia } from "./colorCode";
import { tubesInTiaOrderOk } from "./tubeFiberLayout";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { FIBERS_PER_BUFFER_TUBE } from "@/features/diagram/cableLayoutMetrics";
import { TIA_12_COLORS } from "@/features/diagram/colorCode";
import type { SplicePair } from "@/types/splice";

import { readExampleCsv, resolveExampleCsvPath } from "@/testHelpers/exampleCsvPaths";

function syntheticFullButtSpliceGraph() {
  const pairs: SplicePair[] = TIA_12_COLORS.map((color, index) => ({
    id: `pair-${index}`,
    endpointA: {
      device: "DEV-A",
      cable: "CABLE-A",
      fiberNumber: index + 1,
      tubeColor: "BL",
      fiberColor: color.abbrev,
      csvColumn: "from",
    },
    endpointB: {
      device: "DEV-B",
      cable: "CABLE-B",
      fiberNumber: index + 1,
      tubeColor: "OR",
      fiberColor: color.abbrev,
      csvColumn: "to",
    },
  }));

  return buildConnectionGraph({
    header: {},
    pairs,
    cableAppearances: [
      {
        device: "DEV-A",
        cable: "CABLE-A",
        left: { from: 12, to: 0 },
        right: { from: 0, to: 0 },
      },
      {
        device: "DEV-B",
        cable: "CABLE-B",
        left: { from: 0, to: 0 },
        right: { from: 0, to: 12 },
      },
    ],
  });
}

describe("detectFullButtSpliceTubes", () => {
  it("Example #1: crossover colors are not full butt splice", () => {
    const csv = readFileSync(
      resolveExampleCsvPath("CSV Splice Detail Example #1.csv"),
      "utf8",
    );
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { visualCables } = buildVisualCablesForLayout(graph);
    expect(detectFullButtSpliceTubes(graph, visualCables)).toHaveLength(0);
  });

  it("Example #2: partial two-fiber tubes are not full butt splice", () => {
    const csv = readFileSync(
      resolveExampleCsvPath("CSV Splice Detail Example #2.csv"),
      "utf8",
    );
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { visualCables } = buildVisualCablesForLayout(graph);
    expect(detectFullButtSpliceTubes(graph, visualCables)).toHaveLength(0);
  });

  it("Example #3: BL tube has crossover stubs; OR tube is a full butt splice", () => {
    const csv = readFileSync(
      resolveExampleCsvPath("CSV Splice Detail Example #3.csv"),
      "utf8",
    );
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { visualCables } = buildVisualCablesForLayout(graph);
    const detected = detectFullButtSpliceTubes(graph, visualCables);
    expect(detected).toHaveLength(1);
    expect(
      detected.some(
        (d) =>
          d.endpointA.tubeColor === "OR" || d.endpointB.tubeColor === "OR",
      ),
    ).toBe(true);
    expect(
      detected.some(
        (d) =>
          d.endpointA.tubeColor === "BL" || d.endpointB.tubeColor === "BL",
      ),
    ).toBe(false);
  });

  it("detects a synthetic 12-fiber BL↔OR tube pair", () => {
    const graph = syntheticFullButtSpliceGraph();
    const { visualCables } = buildVisualCablesForLayout(graph);
    const pairs = detectFullButtSpliceTubes(graph, visualCables);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.pairIds).toHaveLength(FIBERS_PER_BUFFER_TUBE);
  });

  it("300N_MAIN: collapses BL-BK and OR-BK striped tubes to SR-28", () => {
    const csv = readExampleCsv("300N_MAIN.csv");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { visualCables } = buildVisualCablesForLayout(graph);
    const detected = detectFullButtSpliceTubes(graph, visualCables);
    const resolved = resolveFullButtSpliceVisuals(visualCables, detected);

    expect(detected.some((d) => d.endpointA.tubeColor === "BL-BK")).toBe(true);
    expect(detected.some((d) => d.endpointA.tubeColor === "OR-BK")).toBe(true);
    expect(detected.some((d) => d.endpointA.tubeColor === "AQ")).toBe(true);
    expect(resolved.length).toBe(detected.length);

    const collapsed = buildReactFlowGraph(graph, {
      reportKey: "300n",
      positions: {},
      collapseFullButtSplices: true,
    });
    const vc288 = collapsed.nodes.find((n) =>
      (n.data as { label: string }).label.includes("288-SMF"),
    )!;
    const collapsedTubes = (vc288.data as { collapsedTubes?: string[] })
      .collapsedTubes;
    expect(collapsedTubes).toContain("BL-BK");
    expect(collapsedTubes).toContain("OR-BK");
  });

  it("300N_MAIN: buffer tubes follow TIA order on 288-SMF", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readExampleCsv("300N_MAIN.csv")),
    );
    const { visualCables } = buildVisualCablesForLayout(graph);
    const vc288 = visualCables.find((v) => v.cable.includes("288-SMF"))!;
    expect(tubesInTiaOrderOk([vc288])).toBe(true);
    expect(compareTubeColorsTia("BL", "OR")).toBeLessThan(0);
    expect(compareTubeColorsTia("AQ", "BL-BK")).toBeLessThan(0);
    expect(vc288.tubes[0]!.tubeColor).toBe("BL");
    const blBkIdx = vc288.tubes.findIndex((t) => t.tubeColor === "BL-BK");
    const lastSolidIdx = vc288.tubes.findIndex((t) => t.tubeColor === "RO");
    expect(blBkIdx).toBeGreaterThan(lastSolidIdx);
    expect(vc288.tubes[blBkIdx]?.tubeColor).toBe("BL-BK");
  });
});
