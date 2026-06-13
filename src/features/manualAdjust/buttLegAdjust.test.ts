import { describe, expect, it } from "vitest";

import type { CableNodeData } from "@/features/canvas/nodes/types";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { TIA_12_COLORS } from "@/features/diagram/colorCode";
import { visualCableIdFromNodeId } from "@/features/diagram/cableDisplaySide";
import { tubeKeyFor } from "@/features/diagram/tubeRowShift";
import {
  applyButtCenterVerticalDelta,
  draggableButtCenterSegments,
  isButtCenterVerticalSegment,
} from "@/features/manualAdjust/buttLegAdjust";
import { repinButtSpliceEdges } from "@/features/manualAdjust/repinButtSpliceEdges";
import { pathToLegSegments } from "@/features/manualAdjust/legSegments";
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

describe("buttLegAdjust", () => {
  it("exposes center vertical segment on bent collapsed butt splices", () => {
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

    const { edges: repinned } = repinButtSpliceEdges(
      nodesWithShift,
      edges,
      graph,
      { tubeKeys: [tubeKey] },
    );

    const buttEdge = repinned.find((e) => e.id.startsWith("butt-"));
    expect(buttEdge).toBeDefined();

    const data = buttEdge!.data as {
      leftPath?: string;
      spliceX?: number;
    };
    const leftPath = String(data.leftPath ?? "");
    const spliceX = Number(data.spliceX ?? NaN);
    const segments = pathToLegSegments(leftPath);
    const centerVertical = segments.filter((seg) =>
      isButtCenterVerticalSegment(seg, spliceX),
    );

    expect(centerVertical.length).toBeGreaterThan(0);

    const draggable = draggableButtCenterSegments(buttEdge!);
    expect(draggable.length).toBeGreaterThan(0);
    expect(draggable[0]?.segment.kind).toBe("v");
  });

  it("shifts center vertical lane horizontally on drag", () => {
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

    const { edges: repinned } = repinButtSpliceEdges(
      nodesWithShift,
      edges,
      graph,
      { tubeKeys: [tubeKey] },
    );

    const buttEdge = repinned.find((e) => e.id.startsWith("butt-"))!;
    const data = buttEdge.data as {
      leftPath?: string;
      rightPath?: string;
      spliceX?: number;
    };
    const spliceXBefore = Number(data.spliceX ?? NaN);
    const draggable = draggableButtCenterSegments(buttEdge);
    expect(draggable.length).toBeGreaterThan(0);

    const leftSegs = pathToLegSegments(String(data.leftPath ?? ""));
    const shifted = applyButtCenterVerticalDelta(
      leftSegs,
      draggable[0]!.segmentIndex,
      24,
    );
    const centerAfter = shifted.find(
      (seg) =>
        seg.kind === "v" &&
        isButtCenterVerticalSegment(seg, spliceXBefore + 24),
    );
    expect(centerAfter?.kind).toBe("v");
    if (centerAfter?.kind === "v") {
      expect(centerAfter.x).toBe(spliceXBefore + 24);
    }
  });
});
