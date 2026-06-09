import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";

import { buildSpliceHandleEntries } from "@/features/canvas/edges/spliceEdgeRouting";
import type { FiberAnchorNodeData } from "@/features/canvas/nodes/types";
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

/** Rebuild cable→cable edges so handle-entry extraction works after split wiring. */
function compositeSpliceEdgesFromSplit(
  nodes: Array<{ id: string; data: unknown }>,
  edges: Edge[],
): Edge[] {
  const composite: Edge[] = [];
  for (const left of edges.filter((e) => e.id.startsWith("splice-left-"))) {
    const connectionId = left.id.replace(/^splice-left-/, "");
    const right = edges.find((e) => e.id === `splice-right-${connectionId}`);
    if (!right) continue;
    const sourceAnchor = nodes.find((n) => n.id === left.source);
    const targetAnchor = nodes.find((n) => n.id === right.target);
    if (!sourceAnchor || !targetAnchor) continue;
    const srcVcId = (sourceAnchor.data as FiberAnchorNodeData).visualCableId;
    const tgtVcId = (targetAnchor.data as FiberAnchorNodeData).visualCableId;
    composite.push({
      ...left,
      id: `splice-${connectionId}`,
      source: `cable-${srcVcId}`,
      target: `cable-${tgtVcId}`,
    });
  }
  return composite;
}

function routedLayoutForFile(file: string) {
  const csv = readFileSync(join(examplesDir, file), "utf8");
  const graph = buildConnectionGraph(parseBentleyCsv(csv));
  const { nodes, edges } = buildReactFlowGraph(graph, undefined, LAYOUT_WIDTH);
  const { visualCables } = buildVisualCablesForLayout(graph);
  const cableNodes = nodes.filter((n) => n.type === "cable");
  const compositeEdges = compositeSpliceEdgesFromSplit(nodes, edges);
  const entries = buildSpliceHandleEntries(
    cableNodes,
    compositeEdges,
    visualCables,
  );
  const lanes = routeCenterSplices(entries, LAYOUT_WIDTH / 2);
  return { entries, lanes };
}

function verticalSegmentsForFile(file: string) {
  const { entries, lanes } = routedLayoutForFile(file);
  return [...lanes.entries()].flatMap(([id, lane]) => {
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
}

describe("centerRouter oracle", () => {
  it("Left-SP-3254.5.csv: R3/F2 — small diagram vertical lanes ≥ pitch", () => {
    const verticals = verticalSegmentsForFile("Left-SP-3254.5.csv");
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

  it("STATE_OFFICE + SPI-215: documents legacy F2 debt (duplicate midX in goldens)", () => {
    for (const file of ["Left-STATE_OFFICE.csv", "Left-SPI-215_I-80.csv"] as const) {
      const verticals = verticalSegmentsForFile(file);
      let violations = 0;
      for (let i = 0; i < verticals.length; i++) {
        for (let j = i + 1; j < verticals.length; j++) {
          if (
            segmentsViolateLaneSeparation(
              [verticals[i]!, verticals[j]!],
              INTRA_BUNDLE_ISOTROPIC_PITCH,
            )
          ) {
            violations += 1;
          }
        }
      }
      expect(violations).toBeGreaterThan(0);
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
