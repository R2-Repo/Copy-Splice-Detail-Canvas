import type { Edge, Node } from "@xyflow/react";

import { orderedFiberConnections } from "@/features/diagram/buildConnectionGraph";
import { computeDiagramScale } from "@/features/diagram/cableBreakoutGeometry";
import { smfoLabelForCable } from "@/features/diagram/cableLabels";
import {
  FIBER_ROW_PITCH,
  type CableXBounds,
} from "@/features/diagram/cableLayoutMetrics";
import { colorHex } from "@/features/diagram/colorCode";
import {
  reportStorageKey,
  type DiagramLayout,
} from "@/features/diagram/layoutSpliceDiagram";
import {
  buildVisualCablesForLayout,
  findVisualCableForConnection,
  type VisualCable,
} from "@/features/diagram/visualCables";
import type {
  ConnectionGraph,
  FiberColorAbbrev,
  LayoutOverrides,
  QuadSide,
  TubeColorCode,
} from "@/types/splice";

import type {
  CableNodeData,
  FiberAnchorNodeData,
  SplicePointNodeData,
} from "@/features/canvas/nodes/types";

import { quadFiberHandleCenter } from "./quadGeometry";
import { computeQuadPlacement } from "./quadPlacement";
import { routeQuadSplice } from "./quadRouter";
import { isVerticalSide } from "./quadTypes";

const ANCHOR_DOT = 6;
const SPLICE_DOT = 8;

function horizontalProxySide(side: QuadSide): "left" | "right" {
  return side === "right" ? "right" : "left";
}

/**
 * Additive 4-side layout pipeline. Reuses the existing slim-cable + fiberAnchor
 * + splicePoint render contract and the precomputed SpliceEdge path data, so no
 * change to the frozen horizontal router is needed.
 */
export function buildQuadReactFlowGraph(
  graph: ConnectionGraph,
  overrides?: LayoutOverrides,
  layoutWidth?: number,
  _buildOptions?: {
    refreshColumnX?: boolean;
    refreshRowLayout?: boolean;
    skipFeasibility?: boolean;
    stageWidth?: number;
    skipTubeAutoAlign?: boolean;
    dragSync?: boolean;
  },
): {
  nodes: Node[];
  edges: Edge[];
  layout: DiagramLayout;
  xBounds: CableXBounds;
  autoLayoutY: Record<string, number>;
} {
  const { visualCables } = buildVisualCablesForLayout(graph);
  const connections = orderedFiberConnections(graph);
  const scale = computeDiagramScale(connections.length);
  const autoAdjustOn = overrides?.autoAdjustEnabled !== false;

  const { placement, stemAlign, width, centerX, centerY } = computeQuadPlacement(
    graph,
    visualCables,
    scale,
    {
      layoutWidth,
      pinnedSides: overrides?.quadCableSides,
      savedPositions: overrides?.positions,
    },
  );

  const sideOf = (vcId: string): QuadSide => placement.get(vcId)!.side;
  const posOf = (vcId: string) => placement.get(vcId)!.position;

  const cableNodes: Node[] = visualCables.map((vc) => {
    const p = placement.get(vc.id)!;
    return {
      id: `cable-${vc.id}`,
      type: "cable",
      position: p.position,
      width: p.boxWidth,
      height: p.boxHeight,
      data: {
        smfoLabel: smfoLabelForCable(vc.cable),
        label: vc.cable,
        legId: vc.legId,
        side: horizontalProxySide(p.side),
        quadSide: p.side,
        orientation: isVerticalSide(p.side) ? "vertical" : "horizontal",
        tubes: vc.tubes,
        nodeHeight: p.boxHeight,
        fiberPitch: FIBER_ROW_PITCH,
        diagramScale: scale,
        alignedStemX: stemAlign[p.side],
        spliceNumber: graph.report.header.spliceNumber,
        slim: true,
        manualAdjustEnabled: !autoAdjustOn,
      } satisfies CableNodeData,
      draggable: true,
    };
  });

  const anchorNodes: Node[] = [];
  const anchorCenter = new Map<string, { x: number; y: number }>();

  const ensureAnchor = (
    vc: VisualCable,
    connectionId: string,
  ): { x: number; y: number } => {
    const key = `${vc.id}::${connectionId}`;
    const cached = anchorCenter.get(key);
    if (cached) return cached;

    const side = sideOf(vc.id);
    const center = quadFiberHandleCenter(
      vc,
      connectionId,
      posOf(vc.id),
      side,
      scale,
      stemAlign[side],
    );
    anchorCenter.set(key, center);

    const fiber = vc.tubes
      .flatMap((t) => t.fibers)
      .find((f) => f.connectionId === connectionId);

    anchorNodes.push({
      id: `fiberAnchor-${key}`,
      type: "fiberAnchor",
      position: { x: center.x - ANCHOR_DOT / 2, y: center.y - ANCHOR_DOT / 2 },
      data: {
        connectionId,
        fiberColor: (fiber?.fiberColor ?? "BL") as FiberColorAbbrev,
        fiberNumber: fiber?.fiberNumber ?? 0,
        tubeColor: (fiber?.tubeColor ?? "BL") as TubeColorCode,
        side: horizontalProxySide(side),
        quadSide: side,
        visualCableId: vc.id,
        circuitName: fiber?.circuitName,
      } satisfies FiberAnchorNodeData,
      draggable: true,
      selectable: true,
    });
    return center;
  };

  const edges: Edge[] = [];
  const spliceNodes: Node[] = [];

  connections.forEach((conn, index) => {
    const epA = conn.pair.endpointA;
    const epB = conn.pair.endpointB;
    const vcA = findVisualCableForConnection(visualCables, conn.id, {
      cable: epA.cable,
    });
    const vcB = findVisualCableForConnection(visualCables, conn.id, {
      cable: epB.cable,
    });
    if (!vcA || !vcB) return;

    const sCenter = ensureAnchor(vcA, conn.id);
    const tCenter = ensureAnchor(vcB, conn.id);

    const routed = routeQuadSplice(
      { x: sCenter.x, y: sCenter.y, side: sideOf(vcA.id) },
      { x: tCenter.x, y: tCenter.y, side: sideOf(vcB.id) },
      index,
      { x: centerX, y: centerY },
    );

    const sourceColor = colorHex(epA.fiberColor);
    const targetColor = colorHex(epB.fiberColor);
    const spliceId = `splicePoint-${conn.id}`;

    spliceNodes.push({
      id: spliceId,
      type: "splicePoint",
      position: {
        x: routed.spliceX - SPLICE_DOT / 2,
        y: routed.spliceY - SPLICE_DOT / 2,
      },
      data: {
        connectionId: conn.id,
        sourceColor,
        targetColor,
      } satisfies SplicePointNodeData,
      draggable: true,
      selectable: true,
    });

    const shared = {
      routingPrecomputed: true as const,
      leftPath: routed.leftPath,
      rightPath: routed.rightPath,
      spliceX: routed.spliceX,
      spliceY: routed.spliceY,
      sourceColor,
      targetColor,
      circuitName: conn.pair.circuitName,
      existing: overrides?.existingEdgeIds?.includes(`splice-${conn.id}`),
      diagramCenterX: centerX,
    };

    edges.push({
      id: `splice-left-${conn.id}`,
      source: `fiberAnchor-${vcA.id}::${conn.id}`,
      target: spliceId,
      sourceHandle: "out",
      targetHandle: "in",
      type: "splice",
      data: { ...shared, splitLeg: "left" as const },
    });
    edges.push({
      id: `splice-right-${conn.id}`,
      source: spliceId,
      target: `fiberAnchor-${vcB.id}::${conn.id}`,
      sourceHandle: "out",
      targetHandle: "in",
      type: "splice",
      data: { ...shared, splitLeg: "right" as const },
    });
  });

  const cablePositions = new Map<
    string,
    { x: number; y: number; height: number }
  >();
  const autoLayoutY: Record<string, number> = {};
  for (const vc of visualCables) {
    const p = placement.get(vc.id)!;
    cablePositions.set(vc.id, {
      x: p.position.x,
      y: p.position.y,
      height: p.boxHeight,
    });
    autoLayoutY[`cable-${vc.id}`] = p.position.y;
  }

  const layout: DiagramLayout = {
    reportKey: reportStorageKey(graph),
    rowYs: new Map(),
    cablePositions,
    layoutWidth: width,
  };

  return {
    nodes: [...cableNodes, ...anchorNodes, ...spliceNodes],
    edges,
    layout,
    xBounds: { leftX: 0, rightX: width },
    autoLayoutY,
  };
}
