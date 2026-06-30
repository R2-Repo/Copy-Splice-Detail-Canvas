import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildConnectionGraph,
  orderedFiberConnections,
} from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import {
  buildVisualCablesForLayout,
  findVisualCableForConnection,
} from "@/features/diagram/visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { resolveReferenceCsvPath } from "@/testHelpers/layoutContractCsvPaths";
import type {
  CableNodeData,
  FiberAnchorNodeData,
} from "@/features/canvas/nodes/types";
import type { ConnectionGraph, QuadSide } from "@/types/splice";

function graphFor(name: string) {
  const csv = readFileSync(resolveReferenceCsvPath(name), "utf8");
  return buildConnectionGraph(parseBentleyCsv(csv));
}

/** Connection-weighted neighbor side weights for one visual cable. */
function neighborSideWeights(
  graph: ConnectionGraph,
  sideByVcId: Map<string, QuadSide>,
): Map<string, Record<QuadSide, number>> {
  const { visualCables } = buildVisualCablesForLayout(graph);
  const out = new Map<string, Record<QuadSide, number>>();
  const ensure = (id: string) =>
    out.get(id) ??
    out.set(id, { left: 0, right: 0, top: 0, bottom: 0 }).get(id)!;
  for (const conn of orderedFiberConnections(graph)) {
    const a = findVisualCableForConnection(visualCables, conn.id, {
      cable: conn.pair.endpointA.cable,
    });
    const b = findVisualCableForConnection(visualCables, conn.id, {
      cable: conn.pair.endpointB.cable,
    });
    if (!a || !b || a.id === b.id) continue;
    const aSide = sideByVcId.get(a.id);
    const bSide = sideByVcId.get(b.id);
    if (aSide && bSide) {
      ensure(b.id)[aSide] += 1;
      ensure(a.id)[bSide] += 1;
    }
  }
  return out;
}

describe("buildQuadReactFlowGraph (4-side layout mode)", () => {
  it("places cables on more than two sides and routes precomputed orthogonal legs", () => {
    const graph = graphFor("CSV Splice Detail Example #2.csv");
    const { nodes, edges } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      layoutMode: "quad",
    });

    const cables = nodes.filter((n) => n.type === "cable");
    expect(cables).toHaveLength(4);

    const sides = new Set<QuadSide>(
      cables.map((n) => (n.data as CableNodeData).quadSide!),
    );
    // Dominant pair → left/right, stubs → top/bottom: genuinely uses 4 sides.
    expect(sides.size).toBeGreaterThanOrEqual(3);

    // Vertical cables (top/bottom) carry the transposed-render flag.
    for (const n of cables) {
      const d = n.data as CableNodeData;
      const vertical = d.quadSide === "top" || d.quadSide === "bottom";
      expect(d.orientation).toBe(vertical ? "vertical" : "horizontal");
    }

    const splicePoints = nodes.filter((n) => n.type === "splicePoint");
    const anchors = nodes.filter((n) => n.type === "fiberAnchor");
    expect(splicePoints.length).toBeGreaterThan(0);
    expect(anchors.length).toBeGreaterThan(0);

    const spliceEdges = edges.filter((e) => e.type === "splice");
    // Each fiber connection split into a left + right leg.
    expect(spliceEdges.length).toBe(splicePoints.length * 2);
    for (const e of spliceEdges) {
      const d = e.data as {
        routingPrecomputed?: boolean;
        leftPath?: string;
        rightPath?: string;
        spliceX?: number;
        spliceY?: number;
      };
      expect(d.routingPrecomputed).toBe(true);
      expect(d.leftPath?.startsWith("M")).toBe(true);
      expect(d.rightPath?.startsWith("M")).toBe(true);
      expect(Number.isFinite(d.spliceX)).toBe(true);
      expect(Number.isFinite(d.spliceY)).toBe(true);
    }
  });

  it("fiber handle anchors land inside their cable node box on every side", () => {
    const graph = graphFor("CSV Splice Detail Example #2.csv");
    const { nodes } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      layoutMode: "quad",
    });

    const cableById = new Map(
      nodes
        .filter((n) => n.type === "cable")
        .map((n) => [n.id, n] as const),
    );

    for (const anchor of nodes.filter((n) => n.type === "fiberAnchor")) {
      const vcId = anchor.id.slice("fiberAnchor-".length).split("::")[0]!;
      const cable = cableById.get(`cable-${vcId}`)!;
      const cx = anchor.position.x + 3;
      const cy = anchor.position.y + 3;
      const w = cable.width ?? 0;
      const h = cable.height ?? 0;
      expect(cx).toBeGreaterThanOrEqual(cable.position.x - 1);
      expect(cx).toBeLessThanOrEqual(cable.position.x + w + 1);
      expect(cy).toBeGreaterThanOrEqual(cable.position.y - 1);
      expect(cy).toBeLessThanOrEqual(cable.position.y + h + 1);
    }
  });

  it("does not touch horizontal mode (default stays left/right)", () => {
    const graph = graphFor("CSV Splice Detail Example #2.csv");
    const { nodes } = buildReactFlowGraph(graph);
    const cables = nodes.filter((n) => n.type === "cable");
    for (const n of cables) {
      const d = n.data as CableNodeData;
      expect(d.quadSide).toBeUndefined();
      expect(d.side === "left" || d.side === "right").toBe(true);
    }
  });

  it("never parks a cable on the same side as its dominant neighbor", () => {
    const graph = graphFor("Left-SPI-215_I-80.csv");
    const { nodes } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      layoutMode: "quad",
    });

    const sideByVcId = new Map<string, QuadSide>();
    for (const n of nodes.filter((n) => n.type === "cable")) {
      const d = n.data as CableNodeData;
      sideByVcId.set(n.id.replace(/^cable-/, ""), d.quadSide!);
    }

    const weights = neighborSideWeights(graph, sideByVcId);
    for (const [vcId, side] of sideByVcId) {
      const w = weights.get(vcId);
      if (!w) continue;
      const total = w.left + w.right + w.top + w.bottom;
      if (total === 0) continue;
      // A strictly dominant neighbor side (>50% of links) must NOT be this
      // cable's own side — that is the pointless same-side loop the user hit.
      for (const s of ["left", "right", "top", "bottom"] as QuadSide[]) {
        if (w[s] > total / 2) expect(side).not.toBe(s);
      }
    }
  });

  it("orders top-cable fibers blue-first (left->right)", () => {
    const graph = graphFor("Left-SPI-215_I-80.csv");
    const baseline = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      layoutMode: "quad",
    });

    // Pin the busiest cable to the top edge so the assertion is deterministic.
    const anchorsByCable = new Map<string, number>();
    for (const n of baseline.nodes.filter((n) => n.type === "fiberAnchor")) {
      const vcId = n.id.slice("fiberAnchor-".length).split("::")[0]!;
      anchorsByCable.set(vcId, (anchorsByCable.get(vcId) ?? 0) + 1);
    }
    const target = [...anchorsByCable.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0]![0];

    const { nodes } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      layoutMode: "quad",
      quadCableSides: { [target]: "top" },
    });

    const cable = nodes.find((n) => n.id === `cable-${target}`)!;
    expect((cable.data as CableNodeData).quadSide).toBe("top");

    const anchors = nodes
      .filter(
        (n) =>
          n.type === "fiberAnchor" &&
          n.id.startsWith(`fiberAnchor-${target}::`),
      )
      .map((n) => ({
        fiberNumber: (n.data as FiberAnchorNodeData).fiberNumber,
        x: n.position.x,
      }))
      .sort((a, b) => a.fiberNumber - b.fiberNumber);

    expect(anchors.length).toBeGreaterThan(1);
    for (let i = 1; i < anchors.length; i++) {
      // Lower fiber number (blue-first) sits further left on a top cable.
      expect(anchors[i]!.x).toBeGreaterThanOrEqual(anchors[i - 1]!.x - 0.5);
    }
  });

  it("dragSync reuses prior splice paths for connections outside reroute set", () => {
    const graph = graphFor("CSV Splice Detail Example #2.csv");
    const { edges: fullEdges } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      layoutMode: "quad",
    });
    const sampleLeft = fullEdges.find((e) => e.id.startsWith("splice-left-"));
    expect(sampleLeft).toBeDefined();
    const connId = sampleLeft!.id.slice("splice-left-".length);
    const priorData = sampleLeft!.data as Record<string, unknown>;

    const { edges: syncedEdges } = buildReactFlowGraph(
      graph,
      {
        reportKey: "test",
        positions: {},
        layoutMode: "quad",
      },
      undefined,
      {
        dragSync: true,
        dragCacheEdges: fullEdges,
        rerouteConnectionIds: [],
      },
    );

    const syncedLeft = syncedEdges.find(
      (e) => e.id === `splice-left-${connId}`,
    );
    expect(syncedLeft).toBeDefined();
    const syncedData = syncedLeft!.data as Record<string, unknown>;
    expect(syncedData.leftPath).toBe(priorData.leftPath);
    expect(syncedData.rightPath).toBe(priorData.rightPath);
    expect(syncedData.spliceX).toBe(priorData.spliceX);
    expect(syncedData.spliceY).toBe(priorData.spliceY);
  });
});
