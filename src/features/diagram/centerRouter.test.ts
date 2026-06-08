import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildSpliceHandleEntries } from "@/features/canvas/edges/spliceEdgeRouting";
import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import {
  centerRoutingExtentX,
  hvSegmentsFromRoute,
  INTRA_BUNDLE_ISOTROPIC_PITCH,
  routeCenterSplices,
  segmentsViolateLaneSeparation,
} from "./centerRouter";
import { buildVisualCablesForLayout } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

const REFERENCE_FILES = [
  "Left-SP-3254.5.csv",
  "Left-STATE_OFFICE.csv",
  "Left-SPI-215_I-80.csv",
] as const;

const examplesDir = join(process.cwd(), "docs/reference/examples");
const LAYOUT_WIDTH = 1400;

function routedLayoutForFile(file: string) {
  const csv = readFileSync(join(examplesDir, file), "utf8");
  const graph = buildConnectionGraph(parseBentleyCsv(csv));
  const { nodes, edges } = buildReactFlowGraph(graph, undefined, LAYOUT_WIDTH);
  const { visualCables } = buildVisualCablesForLayout(graph);
  const entries = buildSpliceHandleEntries(nodes, edges, visualCables);
  const lanes = routeCenterSplices(entries, LAYOUT_WIDTH / 2);
  return { entries, lanes };
}

describe("centerRouter oracle", () => {
  it("Left-SP-3254.5.csv: R3/F2 — small diagram vertical lanes ≥ pitch", () => {
    const { entries, lanes } = routedLayoutForFile("Left-SP-3254.5.csv");
    const verticals = [...lanes.entries()].flatMap(([id, lane]) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry || entry.fullButtSplice) return [];
      return hvSegmentsFromRoute(
        entry.sourceX,
        entry.sourceY,
        entry.targetX,
        entry.targetY,
        lane.midX,
      ).filter((s) => s.axis === "v");
    });

    for (let i = 0; i < verticals.length; i++) {
      for (let j = i + 1; j < verticals.length; j++) {
        expect(
          segmentsViolateLaneSeparation(
            [verticals[i]!, verticals[j]!],
            INTRA_BUNDLE_ISOTROPIC_PITCH,
          ),
        ).toBe(false);
      }
    }
  });

  for (const file of REFERENCE_FILES) {
    it(`${file}: R3 — center lanes are spread (unique midX ratio)`, () => {
      const { lanes } = routedLayoutForFile(file);
      const rounded = [...lanes.values()].map((lane) => Math.round(lane.midX));
      const unique = new Set(rounded).size;
      expect(unique).toBeGreaterThan(1);
      expect(unique / rounded.length).toBeGreaterThan(0.15);
    });

    it(`${file}: R1 — routing uses center band width`, () => {
      const { lanes } = routedLayoutForFile(file);
      const extent = centerRoutingExtentX(lanes.values());
      expect(extent).not.toBeNull();
      const span = extent!.max - extent!.min;
      expect(span).toBeGreaterThan(INTRA_BUNDLE_ISOTROPIC_PITCH * 2);
    });
  }

  it("4.2 — isotropic pitch constant is 24px on both axes", () => {
    expect(INTRA_BUNDLE_ISOTROPIC_PITCH).toBe(24);
  });
});
