import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import type { Edge } from "@xyflow/react";

import {
  loadLayoutOverrides,
  mergeLayoutOverrides,
  saveLayoutOverrides,
} from "@/features/canvas/layoutStorage";
import type { CableNodeData } from "@/features/canvas/nodes/types";
import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import { connectionIdsForVisualCable } from "./connectionIdsForCable";
import { syncNodesEngineDragLayout } from "./syncNodesEngineDragLayout";
import { buildVisualCablesForLayout } from "./visualCables";
import { tubeKeyFor } from "./tubeRowShift";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { gridRoutesFromEdges } from "@/features/grid/gridDragCache";
import { onEditLock } from "@/features/layoutHybrid/onEditLock";
import { lockCablePosition } from "@/features/layoutHybrid/applyLocksToGrid";
import { LAYOUT_OVERRIDE_VERSION } from "@/types/splice";

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

type RoutingSnapshot = Record<
  string,
  {
    midX?: number;
    jogX?: number;
    leftPath?: string;
    rightPath?: string;
    spliceX?: number;
  }
>;

function connectionIdFromSpliceEdge(edge: Edge): string {
  return edge.id
    .replace(/^splice-left-/, "")
    .replace(/^splice-right-/, "")
    .replace(/^splice-/, "");
}

function fullRoutingSnapshot(edges: Edge[]): RoutingSnapshot {
  const out: RoutingSnapshot = {};
  for (const edge of edges) {
    if (edge.type !== "splice") continue;
    if (edge.id.startsWith("splice-right-")) continue;
    const connId = connectionIdFromSpliceEdge(edge);
    const data = edge.data as Record<string, unknown>;
    out[connId] = {
      midX:
        data.routingMidX != null
          ? Math.round(data.routingMidX as number)
          : undefined,
      jogX:
        data.routingJogX != null
          ? Math.round(data.routingJogX as number)
          : undefined,
      leftPath: data.leftPath as string | undefined,
      rightPath: data.rightPath as string | undefined,
      spliceX:
        data.spliceX != null ? Math.round(data.spliceX as number) : undefined,
    };
  }
  return out;
}

function cablePositionsFromBuild(
  nodes: ReturnType<typeof buildReactFlowGraph>["nodes"],
) {
  return Object.fromEntries(
    nodes
      .filter((n) => n.type === "cable")
      .map((n) => [n.id, { x: n.position.x, y: n.position.y }]),
  );
}

function example2ManualOverrideBundle(graph: ReturnType<typeof graphFromExample2>) {
  const base = buildReactFlowGraph(graph);
  const { visualCables } = buildVisualCablesForLayout(graph);
  const leftVc = visualCables.find((vc) => vc.side === "left")!;
  const tube = leftVc.tubes[0]!;
  const tubeKey = tubeKeyFor(leftVc.id, tube.tubeColor);
  const leftCable = base.nodes.find((n) => n.id === `cable-${leftVc.id}`)!;
  const positions = {
    ...cablePositionsFromBuild(base.nodes),
    [leftCable.id]: {
      x: leftCable.position.x,
      y: leftCable.position.y + 14,
    },
  };
  const spliceEdge = base.edges.find(
    (e) =>
      e.type === "splice" &&
      !e.id.startsWith("splice-right-") &&
      !(e.data as { fullButtSplice?: boolean }).fullButtSplice,
  )!;
  const connId = connectionIdFromSpliceEdge(spliceEdge);
  return {
    base,
    leftVc,
    tubeKey,
    connId,
    overrides: {
      reportKey: "phase4",
      positions,
      autoAdjustEnabled: false as const,
      tubeOverrides: { [tubeKey]: { visualShiftY: 8, stemReachX: 4 } },
      fanoutOverrides: { [tubeKey]: { shiftY: 8 } },
      legOverrides: { [connId]: { dotShiftX: 16 } },
    },
  };
}

function tubeVisualShiftY(
  nodes: ReturnType<typeof buildReactFlowGraph>["nodes"],
  cableNodeId: string,
  tubeColor: string,
) {
  const node = nodes.find((n) => n.id === cableNodeId)!;
  const tube = (node.data as CableNodeData).tubes.find(
    (t) => t.tubeColor === tubeColor,
  )!;
  return tube.visualShiftY ?? 0;
}

function spliceXForConnection(edges: Edge[], connId: string) {
  const edge = edges.find(
    (e) =>
      e.type === "splice" &&
      (e.id === `splice-left-${connId}` || e.id === `splice-${connId}`),
  )!;
  return Math.round((edge.data as { spliceX: number }).spliceX);
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

  it("same graph + manual overrides yields identical midX, jogX, and paths", () => {
    const graph = graphFromExample2();
    const { overrides } = example2ManualOverrideBundle(graph);
    const first = buildReactFlowGraph(graph, overrides);
    const second = buildReactFlowGraph(graph, overrides);
    expect(fullRoutingSnapshot(first.edges)).toEqual(
      fullRoutingSnapshot(second.edges),
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

describe("override survival", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("positions survive mergeLayoutOverrides round-trip and identical rebuilds", () => {
    const graph = graphFromExample2();
    const { base, overrides, leftVc } = example2ManualOverrideBundle(graph);
    const cableId = `cable-${leftVc.id}`;

    saveLayoutOverrides({
      ...overrides,
      layoutVersion: LAYOUT_OVERRIDE_VERSION,
    });

    const merged = mergeLayoutOverrides(overrides.reportKey, {
      autoAdjustEnabled: true,
    });
    saveLayoutOverrides(merged);
    const reloaded = loadLayoutOverrides(overrides.reportKey);

    expect(reloaded?.positions[cableId]).toEqual(overrides.positions[cableId]);

    const first = buildReactFlowGraph(graph, merged);
    const second = buildReactFlowGraph(graph, merged);
    expect(first.nodes.find((n) => n.id === cableId)?.position).toEqual(
      second.nodes.find((n) => n.id === cableId)?.position,
    );
    expect(first.nodes.find((n) => n.id === cableId)?.position.y).toBeCloseTo(
      overrides.positions[cableId]!.y,
      0,
    );
    expect(base.nodes.find((n) => n.id === cableId)?.position.y).not.toBeCloseTo(
      overrides.positions[cableId]!.y,
      0,
    );
  });

  it("tubeOverrides and fanoutOverrides survive Auto→Manual→Auto rebuild", () => {
    const graph = graphFromExample2();
    const { overrides, leftVc, tubeKey } = example2ManualOverrideBundle(graph);
    const tubeColor = leftVc.tubes[0]!.tubeColor;
    const cableId = `cable-${leftVc.id}`;

    const auto = buildReactFlowGraph(graph, {
      ...overrides,
      autoAdjustEnabled: true,
    });
    const manual = buildReactFlowGraph(graph, overrides);
    const autoAgain = buildReactFlowGraph(graph, {
      ...overrides,
      autoAdjustEnabled: true,
    });

    for (const result of [auto, manual, autoAgain]) {
      expect(tubeVisualShiftY(result.nodes, cableId, tubeColor)).toBe(8);
    }

    const toggled = mergeLayoutOverrides(overrides.reportKey, {
      autoAdjustEnabled: true,
      tubeOverrides: overrides.tubeOverrides,
      fanoutOverrides: overrides.fanoutOverrides,
    });
    expect(toggled.fanoutOverrides?.[tubeKey]).toEqual({ shiftY: 8 });
    expect(toggled.tubeOverrides?.[tubeKey]).toEqual({
      visualShiftY: 8,
      stemReachX: 4,
    });
  });

  it("connectionOverrides-only dotOffsetX matches leg dotShiftX rebuild (Example #2)", () => {
    const graph = graphFromExample2();
    const base = buildReactFlowGraph(graph);
    const { connId, overrides } = example2ManualOverrideBundle(graph);
    const positions = overrides.positions;

    const fromLeg = buildReactFlowGraph(graph, {
      reportKey: "phase5-leg",
      positions,
      autoAdjustEnabled: false,
      legOverrides: { [connId]: { dotShiftX: 16 } },
    });
    const fromConnection = buildReactFlowGraph(graph, {
      reportKey: "phase5-conn",
      positions,
      autoAdjustEnabled: false,
      connectionOverrides: { [connId]: { dotOffsetX: 16 } },
    });

    expect(spliceXForConnection(fromLeg.edges, connId)).toBe(
      spliceXForConnection(fromConnection.edges, connId),
    );
    expect(spliceXForConnection(fromLeg.edges, connId)).not.toBe(
      spliceXForConnection(base.edges, connId),
    );
  });

  it("legOverrides survive storage toggle but apply only in manual mode", () => {
    const graph = graphFromExample2();
    const { base, overrides, connId } = example2ManualOverrideBundle(graph);
    const baseX = spliceXForConnection(base.edges, connId);

    saveLayoutOverrides({
      ...overrides,
      layoutVersion: LAYOUT_OVERRIDE_VERSION,
      autoAdjustEnabled: false,
    });
    const toggledAuto = mergeLayoutOverrides(overrides.reportKey, {
      autoAdjustEnabled: true,
    });
    expect(toggledAuto.legOverrides?.[connId]).toEqual({ dotShiftX: 16 });

    const auto = buildReactFlowGraph(graph, {
      ...overrides,
      autoAdjustEnabled: true,
    });
    const manual = buildReactFlowGraph(graph, overrides);
    const manualAgain = buildReactFlowGraph(graph, {
      ...overrides,
      autoAdjustEnabled: false,
    });

    expect(spliceXForConnection(auto.edges, connId)).toBe(baseX);
    expect(spliceXForConnection(manual.edges, connId)).not.toBe(baseX);
    expect(spliceXForConnection(manualAgain.edges, connId)).toBe(
      spliceXForConnection(manual.edges, connId),
    );

    const toggledManual = mergeLayoutOverrides(overrides.reportKey, {
      autoAdjustEnabled: false,
    });
    const afterToggle = buildReactFlowGraph(graph, toggledManual);
    expect(spliceXForConnection(afterToggle.edges, connId)).toBe(
      spliceXForConnection(manual.edges, connId),
    );
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
