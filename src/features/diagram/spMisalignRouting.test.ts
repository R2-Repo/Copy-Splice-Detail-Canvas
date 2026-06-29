import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import { computeCanvasPlacement } from "./canvasPlacement";
import { connectionRowIndexMap } from "./connectionRowOrder";
import {
  checkLayoutRule,
  findSpliceOverlapPair,
  type LayoutRuleContext,
} from "./layoutRules";
import { DEFAULT_LAYOUT_EXPANSION } from "./layoutExpansion";
import { syncNodesEngineDragLayout } from "./syncNodesEngineDragLayout";
import { buildVisualCablesForLayout } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

const SP_CSV = readFileSync(
  join(process.cwd(), "public/qa-fixtures/sp.csv"),
  "utf8",
);

function graphFromSp() {
  return buildConnectionGraph(parseBentleyCsv(SP_CSV));
}

function ctxFromBuild(
  graph: ReturnType<typeof graphFromSp>,
  built: ReturnType<typeof buildReactFlowGraph>,
): LayoutRuleContext {
  const { visualCables } = buildVisualCablesForLayout(graph);
  const rowIndex = connectionRowIndexMap(graph, visualCables);
  const placement = computeCanvasPlacement(graph, visualCables, rowIndex);
  return {
    graph,
    visualCables,
    placement,
    layout: built.layout as LayoutRuleContext["layout"],
    reactFlow: { nodes: built.nodes, edges: built.edges },
    layoutWidth: built.layout.layoutWidth,
    layoutExpansion: DEFAULT_LAYOUT_EXPANSION,
  };
}

function routingMidXFor6Drop(edges: ReturnType<typeof buildReactFlowGraph>["edges"]) {
  const out: Record<string, number> = {};
  for (const e of edges) {
    if (e.type !== "splice") continue;
    const connId = e.id.replace(/^splice-(?:left-|right-)?/, "");
    if (!connId.includes("6 DROP")) continue;
    if (!connId.includes("|BL|OR|") && !connId.includes("|BL|GR|")) continue;
    const d = (e.data ?? {}) as Record<string, unknown>;
    out[connId.includes("|BL|OR|") ? "OR" : "GR"] = Number(
      d.routingMidX ?? d.midX,
    );
  }
  return out;
}

describe("SP-3254.5 misaligned right-side cable routing", () => {
  it("default import passes SDC-ROUTE-003-B and SDC-LAYOUT-002-H", () => {
    const graph = graphFromSp();
    const built = buildReactFlowGraph(graph, { reportKey: "sp", positions: {} }, 1920);
    const ctx = ctxFromBuild(graph, built);
    expect(findSpliceOverlapPair(ctx)).toBeNull();
    expect(checkLayoutRule("SDC-ROUTE-003-B", ctx).ok).toBe(true);
    expect(checkLayoutRule("SDC-LAYOUT-002-H", ctx).ok).toBe(true);
  });

  it("misaligned right cable Y after drag-stop still passes SDC-ROUTE-003-B", () => {
    const graph = graphFromSp();
    const base = buildReactFlowGraph(graph, { reportKey: "sp", positions: {} }, 1920);
    const rightCables = base.nodes
      .filter(
        (n) =>
          n.type === "cable" &&
          (n.data as { side?: string }).side === "right",
      )
      .sort((a, b) => a.position.y - b.position.y);
    expect(rightCables.length).toBeGreaterThan(1);

    const dragged = rightCables[0]!;
    const dragY = dragged.position.y + 140;
    const positions = Object.fromEntries(
      base.nodes
        .filter((n) => n.type === "cable")
        .map((n) => [n.id, { x: n.position.x, y: n.position.y }]),
    );
    positions[dragged.id] = { x: dragged.position.x, y: dragY };

    const { edges: dragEdges } = syncNodesEngineDragLayout({
      graph,
      overrides: { reportKey: "sp", positions },
      layoutWidth: base.layout.layoutWidth,
      positions,
      draggedNode: { ...dragged, position: positions[dragged.id]! },
    });

    const stop = buildReactFlowGraph(
      graph,
      { reportKey: "sp", positions },
      base.layout.layoutWidth,
      {
        skipTubeAutoAlign: false,
        dragCacheEdges: dragEdges,
      },
    );

    const ctx = ctxFromBuild(graph, stop);
    const overlap = findSpliceOverlapPair(ctx);
    const dropMidX = routingMidXFor6Drop(stop.edges);
    expect(overlap, overlap ?? JSON.stringify({ dropMidX })).toBeNull();
    expect(checkLayoutRule("SDC-ROUTE-003-B", ctx).ok).toBe(true);
    if (dropMidX.OR !== undefined && dropMidX.GR !== undefined) {
      expect(dropMidX.OR).not.toBe(dropMidX.GR);
    }
  });

  it("misaligned left stack (6 DROP between cables) passes SDC-ROUTE-003-B", () => {
    const graph = graphFromSp();
    const base = buildReactFlowGraph(graph, { reportKey: "sp", positions: {} }, 1920);
    const leftCables = base.nodes
      .filter(
        (n) =>
          n.type === "cable" &&
          (n.data as { side?: string }).side === "left",
      )
      .sort((a, b) => a.position.y - b.position.y);
    const top = leftCables[0]!;
    const bottom = leftCables[leftCables.length - 1]!;
    const drop = leftCables.find((n) =>
      (n.data as { label?: string }).label?.includes("6 DROP"),
    )!;
    const betweenY = (top.position.y + bottom.position.y) / 2;
    const positions = Object.fromEntries(
      base.nodes
        .filter((n) => n.type === "cable")
        .map((n) => [n.id, { x: n.position.x, y: n.position.y }]),
    );
    positions[drop.id] = { x: drop.position.x, y: betweenY };

    const built = buildReactFlowGraph(
      graph,
      { reportKey: "sp", positions },
      base.layout.layoutWidth,
    );
    const ctx = ctxFromBuild(graph, built);
    expect(checkLayoutRule("SDC-ROUTE-003-B", ctx).ok, checkLayoutRule("SDC-ROUTE-003-B", ctx).detail).toBe(true);
    expect(findSpliceOverlapPair(ctx)).toBeNull();
  });
});
