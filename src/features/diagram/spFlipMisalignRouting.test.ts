import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import { computeCanvasPlacement } from "./canvasPlacement";
import { connectionRowIndexMap } from "./connectionRowOrder";
import {
  checkLayoutRule,
  findCenterLaneGroupingViolations,
  findSpliceOverlapPair,
  packedMidXViolationsForContext,
  type LayoutRuleContext,
} from "./layoutRules";
import { DEFAULT_LAYOUT_EXPANSION } from "./layoutExpansion";
import { buildVisualCablesForLayout } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";
import type { LayoutOverrides } from "@/types/splice";

function ctxFromBuild(
  graph: ReturnType<typeof buildConnectionGraph>,
  built: ReturnType<typeof buildReactFlowGraph>,
): LayoutRuleContext {
  const { visualCables, dominant } = buildVisualCablesForLayout(graph);
  const rowIndex = connectionRowIndexMap(graph, visualCables, dominant);
  const placement = computeCanvasPlacement(graph, visualCables, dominant, rowIndex);
  return {
    graph,
    visualCables,
    dominant,
    placement,
    layout: built.layout as LayoutRuleContext["layout"],
    reactFlow: { nodes: built.nodes, edges: built.edges },
    layoutWidth: built.layout.layoutWidth,
    layoutExpansion: DEFAULT_LAYOUT_EXPANSION,
  };
}

function buildSpFlipGraph() {
  const graph = buildConnectionGraph(
    parseBentleyCsv(readLeftCsv("Left-SP-3254.5.csv")),
  );
  for (const [id, side] of Object.entries({
    "72-SMF 4800 S DIST: MAIN ST - I-15": "right",
    "144-SMF I-15 DIST: 4800 S - MP 259.46": "right",
    "144-SMF I-15 DIST: MP 258.96 - 4800 S": "right",
    "6 DROP (TSC): I-15 NB & 1600 S": "right",
  })) {
    graph.cableSides.set(id, side as "left" | "right");
  }
  return graph;
}

function alignedRightPositions(): LayoutOverrides["positions"] {
  return {
    "cable-72-SMF 4800 S DIST: MAIN ST - I-15": { x: 1380, y: 40 },
    "cable-144-SMF I-15 DIST: MP 258.96 - 4800 S": { x: 1380, y: 200 },
    "cable-144-SMF I-15 DIST: 4800 S - MP 259.46": { x: 1380, y: 360 },
    "cable-6 DROP (TSC): I-15 NB & 1600 S": { x: 1380, y: 520 },
  };
}

function misalignedRightPositions(): LayoutOverrides["positions"] {
  return {
    ...alignedRightPositions(),
    // Pull 258.96 cable up — breaks tube-row pairing vs 72-SMF / 6-DROP partners.
    "cable-144-SMF I-15 DIST: MP 258.96 - 4800 S": { x: 1380, y: 80 },
    "cable-144-SMF I-15 DIST: 4800 S - MP 259.46": { x: 1380, y: 500 },
  };
}

describe("SP flipped-right vertical stack alignment", () => {
  it("aligned right stack passes routing rules", () => {
    const graph = buildSpFlipGraph();
    const overrides: LayoutOverrides = {
      reportKey: "sp-flip-aligned",
      positions: alignedRightPositions(),
      cableSides: Object.fromEntries(
        [...graph.cableSides.entries()].map(([k, v]) => [k, v]),
      ),
      layoutWidth: 1770,
      routingEngine: "grid",
    };
    const built = buildReactFlowGraph(graph, overrides, overrides.layoutWidth!, {
      refreshColumnX: true,
    });
    const ctx = ctxFromBuild(graph, built);
    expect(findSpliceOverlapPair(ctx)).toBeNull();
    expect(packedMidXViolationsForContext(ctx)).toEqual([]);
    expect(checkLayoutRule("EDGE-005", ctx).ok).toBe(true);
    expect(checkLayoutRule("EDGE-007", ctx).ok).toBe(true);
  });

  it("misaligned right stack should still pass routing rules", () => {
    const graph = buildSpFlipGraph();
    const overrides: LayoutOverrides = {
      reportKey: "sp-flip-misaligned",
      positions: misalignedRightPositions(),
      cableSides: Object.fromEntries(
        [...graph.cableSides.entries()].map(([k, v]) => [k, v]),
      ),
      layoutWidth: 1770,
      routingEngine: "grid",
    };
    const built = buildReactFlowGraph(graph, overrides, overrides.layoutWidth!, {
      refreshColumnX: true,
    });
    const ctx = ctxFromBuild(graph, built);
    const edge005 = findCenterLaneGroupingViolations(
      ctx,
      new Map(
        ctx.reactFlow.edges
          .filter((e) => e.type === "splice")
          .map((e) => {
            const connId = e.id.replace(/^splice-(?:left-|right-)?/, "");
            const d = (e.data ?? {}) as { routingMidX?: number; midX?: number };
            return [connId, Number(d.routingMidX ?? d.midX)] as const;
          }),
      ),
    );
    expect(findSpliceOverlapPair(ctx), edge005.join("; ")).toBeNull();
    expect(packedMidXViolationsForContext(ctx), edge005.join("; ")).toEqual([]);
    expect(checkLayoutRule("EDGE-005", ctx).ok, edge005.join("; ")).toBe(true);
    expect(checkLayoutRule("EDGE-007", ctx).ok).toBe(true);
  });
});
