import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import {
  crossSideTubePairsAligned,
  MAX_TUBE_ROW_SHIFT_COLLAPSED,
  tubeCenterRowOffset,
  type TubeRowShiftOptions,
} from "@/features/diagram/tubeRowShift";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { TIA_12_COLORS } from "@/features/diagram/colorCode";
import type { SplicePair, TubeColorCode } from "@/types/splice";
import { visualCableIdFromNodeId } from "@/features/diagram/cableDisplaySide";
import type { CableNodeData } from "@/features/canvas/nodes/types";
import {
  applyRowLayoutWithDragPreservation,
  autoPositionsFromLayout,
} from "@/features/diagram/layoutSpliceDiagram";
import { computeCanvasPlacement } from "@/features/diagram/canvasPlacement";
import { connectionRowIndexMap } from "@/features/diagram/connectionRowOrder";
import { computeAlignedLayout } from "@/features/diagram/spliceRowLayout";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

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

function visualCablesFromNodes(nodes: ReturnType<typeof buildReactFlowGraph>["nodes"]) {
  return nodes
    .filter((n) => n.type === "cable")
    .map((n) => {
      const data = n.data as CableNodeData;
      return {
        id: visualCableIdFromNodeId(n.id)!,
        tubes: data.tubes,
        side: data.side,
        cable: data.label,
        legId: data.legId,
        device: "",
        order: 0,
      };
    });
}

describe("applyTubeRowAlignmentShifts", () => {
  it("aligns cross-side tube handles without moving fiber rowYOffset", () => {
    const graph = syntheticFullButtSpliceGraph();
    const { visualCables } = buildVisualCablesForLayout(graph);
    const fiberOffsetsBefore = visualCables.flatMap((vc) =>
      vc.tubes.flatMap((t) => t.fibers.map((f) => f.rowYOffset)),
    );

    const { nodes } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      collapseFullButtSplices: true,
    });

    const builtCables = visualCablesFromNodes(nodes);
    const leftNode = nodes.find((n) => (n.data as CableNodeData).side === "left")!;
    const rightNode = nodes.find((n) => (n.data as CableNodeData).side === "right")!;
    const leftVc = builtCables.find((vc) => vc.id === visualCableIdFromNodeId(leftNode.id))!;
    const rightVc = builtCables.find((vc) => vc.id === visualCableIdFromNodeId(rightNode.id))!;

    const positions = new Map([
      [
        leftVc.id,
        { x: leftNode.position.x, y: leftNode.position.y, height: 0 },
      ],
      [
        rightVc.id,
        { x: rightNode.position.x, y: rightNode.position.y, height: 0 },
      ],
    ]);

    const shiftOptions: TubeRowShiftOptions = {
      collapsedTubeColorsByVcId: new Map<string, Set<TubeColorCode>>([
        [leftVc.id, new Set<TubeColorCode>(["BL"])],
        [rightVc.id, new Set<TubeColorCode>(["OR"])],
      ]),
    };

    expect(
      crossSideTubePairsAligned(graph, builtCables, positions, shiftOptions),
    ).toBe(true);

    const fiberOffsetsAfter = visualCables.flatMap((vc) =>
      vc.tubes.flatMap((t) => t.fibers.map((f) => f.rowYOffset)),
    );
    expect(fiberOffsetsAfter).toEqual(fiberOffsetsBefore);

    const leftTube = leftVc.tubes.find((t) => t.tubeColor === "BL")!;
    const rightTube = rightVc.tubes.find((t) => t.tubeColor === "OR")!;
    expect(Math.abs(leftTube.visualShiftY ?? 0)).toBeLessThanOrEqual(
      MAX_TUBE_ROW_SHIFT_COLLAPSED + 0.01,
    );
    expect(Math.abs(rightTube.visualShiftY ?? 0)).toBeLessThanOrEqual(
      MAX_TUBE_ROW_SHIFT_COLLAPSED + 0.01,
    );
  });

  it("skips auto visualShiftY for locked manual tube overrides", () => {
    const graph = syntheticFullButtSpliceGraph();
    const { visualCables } = buildVisualCablesForLayout(graph);
    const leftVc = visualCables.find((vc) => vc.side === "left")!;
    const tube = leftVc.tubes[0]!;
    tube.visualShiftY = 8;

    const { nodes } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      collapseFullButtSplices: true,
      autoAdjustEnabled: false,
      tubeOverrides: {
        [`${leftVc.id}|${tube.tubeColor}`]: { visualShiftY: 8 },
      },
    });

    const builtCables = visualCablesFromNodes(nodes);
    const rebuiltLeft = builtCables.find((vc) => vc.id === leftVc.id)!;
    const rebuiltTube = rebuiltLeft.tubes.find(
      (t) => t.tubeColor === tube.tubeColor,
    )!;
    expect(rebuiltTube.visualShiftY).toBe(8);
  });

  it("tubeCenterRowOffset matches default tube tip before shift", () => {
    const graph = syntheticFullButtSpliceGraph();
    const { visualCables } = buildVisualCablesForLayout(graph);
    const leftVc = visualCables.find((vc) => vc.side === "left")!;
    const tube = leftVc.tubes[0]!;
    expect(tubeCenterRowOffset(tube)).toBeGreaterThan(0);
    expect(tube.visualShiftY ?? 0).toBe(0);
  });

  for (const n of [1, 2] as const) {
    it(`Example #${n} alignable tube pairs pass TUB-008`, () => {
      const graph = buildConnectionGraph(
        parseBentleyCsv(
          readReferenceCsv(`CSV Splice Detail Example #${n}.csv`),
        ),
      );
      const { nodes } = buildReactFlowGraph(graph, {
        reportKey: "test",
        positions: {},
      });
      const builtCables = visualCablesFromNodes(nodes);
      const positions = new Map(
        nodes
          .filter((node) => node.type === "cable")
          .map((node) => {
            const vcId = visualCableIdFromNodeId(node.id)!;
            return [
              vcId,
              { x: node.position.x, y: node.position.y, height: 0 },
            ] as const;
          }),
      );
      expect(
        crossSideTubePairsAligned(graph, builtCables, positions),
      ).toBe(true);
    });
  }
});

describe("applyRowLayoutWithDragPreservation", () => {
  it("preserves user drag delta when row layout refreshes", () => {
    const graph = syntheticFullButtSpliceGraph();
    const expanded = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
    });
    const cableNodeId = expanded.nodes[0]!.id;
    const dragDelta = 40;
    const savedPositions = {
      [cableNodeId]: {
        x: expanded.nodes[0]!.position.x,
        y: expanded.autoLayoutY[cableNodeId]! + dragDelta,
      },
    };

    const collapsed = buildReactFlowGraph(
      graph,
      {
        reportKey: "test",
        positions: savedPositions,
        autoLayoutY: expanded.autoLayoutY,
        collapseFullButtSplices: true,
      },
      undefined,
      { refreshRowLayout: true },
    );

    const mergedY = collapsed.nodes.find((n) => n.id === cableNodeId)!.position.y;
    const newAutoY = collapsed.autoLayoutY[cableNodeId]!;
    expect(mergedY - newAutoY).toBeCloseTo(dragDelta, 0);
  });

  it("applyRowLayoutWithDragPreservation merges delta directly", () => {
    const graph = syntheticFullButtSpliceGraph();
    const { visualCables, dominant } = buildVisualCablesForLayout(graph);
    const rowIndex = connectionRowIndexMap(graph, visualCables, dominant);
    const placement = computeCanvasPlacement(
      graph,
      visualCables,
      dominant,
      rowIndex,
    );
    const layout = computeAlignedLayout(
      graph,
      visualCables,
      placement,
      dominant,
    );
    const auto = autoPositionsFromLayout(layout);
    const nodeId = Object.keys(auto)[0]!;
    const overrides = {
      reportKey: "test",
      positions: { [nodeId]: { x: auto[nodeId]!.x, y: auto[nodeId]!.y + 25 } },
      autoLayoutY: { [nodeId]: auto[nodeId]!.y },
    };
    const shiftedAuto = {
      ...auto,
      [nodeId]: { x: auto[nodeId]!.x, y: auto[nodeId]!.y + 10 },
    };
    const merged = applyRowLayoutWithDragPreservation(shiftedAuto, overrides);
    expect(merged[nodeId]!.y).toBeCloseTo(shiftedAuto[nodeId]!.y + 25, 0);
  });
});
