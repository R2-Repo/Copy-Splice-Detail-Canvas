import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { resolveReferenceCsvPath } from "@/testHelpers/layoutContractCsvPaths";
import type { CableNodeData } from "@/features/canvas/nodes/types";
import type { QuadSide } from "@/types/splice";

function graphFor(name: string) {
  const csv = readFileSync(resolveReferenceCsvPath(name), "utf8");
  return buildConnectionGraph(parseBentleyCsv(csv));
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
});
