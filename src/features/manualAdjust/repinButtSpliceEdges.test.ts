import { describe, expect, it } from "vitest";

import type { CableNodeData } from "@/features/canvas/nodes/types";
import {
  countOrthogonalBends,
  MAX_SPLICE_BENDS,
  parseOrthogonalPathPoints,
  tubeHandlePosition,
} from "@/features/canvas/edges/splicePathGeometry";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { TIA_12_COLORS } from "@/features/diagram/colorCode";
import { visualCableIdFromNodeId } from "@/features/diagram/cableDisplaySide";
import { tubeKeyFor } from "@/features/diagram/tubeRowShift";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import {
  isCollapsedTubeKey,
  repinButtSpliceEdges,
} from "@/features/manualAdjust/repinButtSpliceEdges";
import type { SplicePair } from "@/types/splice";

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

describe("repinButtSpliceEdges", () => {
  it("rebuilds butt edge paths when collapsed tube visualShiftY changes", () => {
    const graph = syntheticFullButtSpliceGraph();
    const { nodes, edges } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      collapseFullButtSplices: true,
    });

    const leftNode = nodes.find(
      (n) => (n.data as CableNodeData).side === "left",
    )!;
    const leftVcId = visualCableIdFromNodeId(leftNode.id)!;
    const tubeKey = tubeKeyFor(leftVcId, "BL");

    expect(isCollapsedTubeKey(nodes, tubeKey)).toBe(true);

    const nodesWithShift = nodes.map((n) => {
      if (n.id !== leftNode.id) return n;
      const data = n.data as CableNodeData;
      return {
        ...n,
        data: {
          ...data,
          tubes: data.tubes.map((t) =>
            t.tubeColor === "BL" ? { ...t, visualShiftY: 14 } : t,
          ),
        },
      };
    });

    const buttEdgeBefore = edges.find((e) => e.id.startsWith("butt-"));
    expect(buttEdgeBefore).toBeDefined();

    const { edges: repinned, touchedEdgeIds } = repinButtSpliceEdges(
      nodesWithShift,
      edges,
      graph,
      { tubeKeys: [tubeKey] },
    );

    expect(touchedEdgeIds.has(buttEdgeBefore!.id)).toBe(true);
    const buttEdge = repinned.find((e) => e.id === buttEdgeBefore!.id)!;
    const data = buttEdge.data as {
      leftPath?: string;
      rightPath?: string;
      spliceY?: number;
    };

    const { visualCables } = buildVisualCablesForLayout(graph);
    const leftVc = visualCables.find((vc) => vc.id === leftVcId)!;
    const leftData = nodesWithShift.find((n) => n.id === leftNode.id)!
      .data as CableNodeData;
    const liveVc = {
      ...leftVc,
      tubes: leftVc.tubes.map((t) => {
        const live = leftData.tubes.find((lt) => lt.tubeColor === t.tubeColor);
        return live ? { ...t, ...live } : t;
      }),
    };
    const handlePos = tubeHandlePosition(
      liveVc,
      "BL",
      leftNode.position,
      leftData.diagramScale ?? 1,
      leftData.alignedStemX,
    );

    const leftStart = parseOrthogonalPathPoints(String(data.leftPath))[0];
    expect(leftStart?.y).toBeCloseTo(handlePos.y, 5);
    expect(
      countOrthogonalBends(String(data.leftPath), String(data.rightPath)),
    ).toBeLessThanOrEqual(MAX_SPLICE_BENDS);
  });

  it("uses tubePreview for live drag without persisting to cable node", () => {
    const graph = syntheticFullButtSpliceGraph();
    const { nodes, edges } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      collapseFullButtSplices: true,
    });

    const leftNode = nodes.find(
      (n) => (n.data as CableNodeData).side === "left",
    )!;
    const leftVcId = visualCableIdFromNodeId(leftNode.id)!;
    const tubeKey = tubeKeyFor(leftVcId, "BL");
    const preview = new Map([[tubeKey, { visualShiftY: 14 }]]);

    const { edges: repinned } = repinButtSpliceEdges(nodes, edges, graph, {
      tubeKeys: [tubeKey],
      tubePreview: preview,
    });

    const buttEdge = repinned.find((e) => e.id.startsWith("butt-"))!;
    const data = buttEdge.data as { leftPath?: string };
    const leftStart = parseOrthogonalPathPoints(String(data.leftPath))[0];

    const { visualCables } = buildVisualCablesForLayout(graph);
    const leftVc = visualCables.find((vc) => vc.id === leftVcId)!;
    const previewVc = {
      ...leftVc,
      tubes: leftVc.tubes.map((t) =>
        t.tubeColor === "BL" ? { ...t, visualShiftY: 14 } : t,
      ),
    };
    const handlePos = tubeHandlePosition(
      previewVc,
      "BL",
      leftNode.position,
      (leftNode.data as CableNodeData).diagramScale ?? 1,
      (leftNode.data as CableNodeData).alignedStemX,
    );

    expect(leftStart?.y).toBeCloseTo(handlePos.y, 5);
  });
});
