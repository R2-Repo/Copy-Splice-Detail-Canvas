import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { Edge } from "@xyflow/react";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import { connectionIdsForVisualCable } from "./connectionIdsForCable";
import { syncNodesEngineDragLayout } from "./syncNodesEngineDragLayout";
import { buildVisualCablesForLayout } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { gridRoutesFromEdges } from "@/features/grid/gridDragCache";
import { onEditLock } from "@/features/layoutHybrid/onEditLock";
import { lockCablePosition } from "@/features/layoutHybrid/applyLocksToGrid";

const legacyExamples = join(
  process.cwd(),
  "docs/reference/examples/old csv examples",
);

function graphFromExample2() {
  const csv = readFileSync(
    join(legacyExamples, "CSV Splice Detail Example #2.csv"),
    "utf8",
  );
  return buildConnectionGraph(parseBentleyCsv(csv));
}

function routingMidXByConnection(edges: Edge[]) {
  const map = new Map<string, number>();
  for (const edge of edges) {
    if (edge.type !== "splice") continue;
    const connId = edge.id.replace(/^splice-(?:left|right)-/, "");
    const midX = (edge.data as { routingMidX?: number }).routingMidX;
    if (midX !== undefined) map.set(connId, Math.round(midX));
  }
  return map;
}

describe("layout determinism", () => {
  it("same graph + overrides yields identical routing midX", () => {
    const graph = graphFromExample2();
    const first = buildReactFlowGraph(graph);
    const second = buildReactFlowGraph(graph);
    expect(routingMidXByConnection(first.edges)).toEqual(
      routingMidXByConnection(second.edges),
    );
  });

  it("locked cable position survives identical rebuilds", () => {
    const graph = graphFromExample2();
    const base = buildReactFlowGraph(graph);
    const leftCable = base.nodes.find(
      (n) =>
        n.type === "cable" && (n.data as { side: string }).side === "left",
    )!;
    const visualCableId = leftCable.id.replace(/^cable-/, "");
    const lockedPos = {
      x: leftCable.position.x + 36,
      y: leftCable.position.y + 12,
    };
    const overrides = lockCablePosition(
      { reportKey: "survival", positions: {}, autoAdjustEnabled: true },
      visualCableId,
      lockedPos,
    );

    const first = buildReactFlowGraph(graph, overrides);
    const second = buildReactFlowGraph(graph, overrides);
    const firstCable = first.nodes.find((n) => n.id === leftCable.id)!;
    const secondCable = second.nodes.find((n) => n.id === leftCable.id)!;

    expect(firstCable.position).toEqual(secondCable.position);
    expect(firstCable.position.x).toBeCloseTo(lockedPos.x, 0);
    expect(firstCable.position.y).toBeCloseTo(lockedPos.y, 0);
  });

  it("fusion-dot lock + dotShiftX survives identical rebuilds", () => {
    const graph = graphFromExample2();
    const base = buildReactFlowGraph(graph);
    const spliceEdge = base.edges.find(
      (e) =>
        e.type === "splice" &&
        !e.id.startsWith("splice-right-") &&
        !(e.data as { fullButtSplice?: boolean }).fullButtSplice,
    );
    expect(spliceEdge).toBeDefined();
    if (!spliceEdge) return;

    const connId = spliceEdge.id
      .replace(/^splice-left-/, "")
      .replace(/^splice-/, "");
    const overrides = {
      ...onEditLock(
        { reportKey: "survival-dot", positions: {}, autoAdjustEnabled: true },
        "fusionDot",
        { dotId: connId },
      ),
      legOverrides: { [connId]: { dotShiftX: 12 } },
    };

    const first = buildReactFlowGraph(graph, overrides);
    const second = buildReactFlowGraph(graph, overrides);
    const findSplice = (edges: Edge[]) =>
      edges.find(
        (e) =>
          e.id === spliceEdge.id ||
          e.id === `splice-left-${connId}` ||
          e.id === `splice-${connId}`,
      )!;
    const baseX = (spliceEdge.data as { spliceX?: number }).spliceX;
    const x1 = (findSplice(first.edges).data as { spliceX: number }).spliceX;
    const x2 = (findSplice(second.edges).data as { spliceX: number }).spliceX;

    expect(x1).toBe(x2);
    expect(x1).not.toBe(baseX);
  });
});

describe("syncNodesEngineDragLayout lane stability", () => {
  it("dragSync preserves dragged cable Y while refreshing routing", () => {
    const graph = graphFromExample2();
    const base = buildReactFlowGraph(graph);
    const dragged = base.nodes.find(
      (n) => n.type === "cable" && (n.data as { side: string }).side === "left",
    )!;
    const dragY = dragged.position.y + 12;
    const positions = {
      ...Object.fromEntries(
        base.nodes
          .filter((n) => n.type === "cable")
          .map((n) => [n.id, { x: n.position.x, y: n.position.y }]),
      ),
      [dragged.id]: { x: dragged.position.x, y: dragY },
    };

    const { nodes, edges: dragEdges } = syncNodesEngineDragLayout({
      graph,
      overrides: { reportKey: "determinism", positions },
      layoutWidth: base.layout.layoutWidth,
      positions,
      draggedNode: { ...dragged, position: positions[dragged.id]! },
    });

    expect(nodes.find((n) => n.id === dragged.id)?.position.y).toBe(dragY);
    expect(routingMidXByConnection(dragEdges).size).toBeGreaterThan(0);
  });

  it("incremental drag-stop build keeps midX stable for non-dragged splices (Example #2)", () => {
    const graph = graphFromExample2();
    const base = buildReactFlowGraph(graph);
    const dragged = base.nodes.find(
      (n) => n.type === "cable" && (n.data as { side: string }).side === "left",
    )!;
    const visualCableId = dragged.id.replace(/^cable-/, "");
    const dragY = dragged.position.y + 12;
    const positions = {
      ...Object.fromEntries(
        base.nodes
          .filter((n) => n.type === "cable")
          .map((n) => [n.id, { x: n.position.x, y: n.position.y }]),
      ),
      [dragged.id]: { x: dragged.position.x, y: dragY },
    };
    const priorGridRoutes = gridRoutesFromEdges(
      base.edges,
      base.layout.layoutWidth,
    );
    const { visualCables } = buildVisualCablesForLayout(graph);
    const rerouteConnectionIds = connectionIdsForVisualCable(
      visualCables,
      visualCableId,
    );
    const rerouteSet = new Set(rerouteConnectionIds);

    const { edges: dragEdges } = syncNodesEngineDragLayout({
      graph,
      overrides: { reportKey: "determinism", positions, autoAdjustEnabled: true },
      layoutWidth: base.layout.layoutWidth,
      positions,
      draggedNode: { ...dragged, position: positions[dragged.id]! },
      dragCacheEdges: base.edges,
      priorGridRoutes,
    });

    const stop = buildReactFlowGraph(
      graph,
      { reportKey: "determinism", positions, autoAdjustEnabled: true },
      base.layout.layoutWidth,
      {
        rerouteConnectionIds,
        dragCacheEdges: dragEdges,
        priorGridRoutes,
      },
    );

    const dragMidX = routingMidXByConnection(dragEdges);
    const stopMidX = routingMidXByConnection(stop.edges);
    for (const [connId, midX] of dragMidX) {
      if (rerouteSet.has(connId)) continue;
      expect(stopMidX.get(connId)).toBe(midX);
    }
  });
});
