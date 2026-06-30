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
import { edgePlacementFromQuad } from "@/features/diagram/edgePlacement";
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

import { computeQuadFrontiers, type QuadAnchorRef } from "./quadChannels";
import {
  orientTubesForQuadSide,
  quadFiberHandleCenter,
} from "./quadGeometry";
import { computeQuadPlacement } from "./quadPlacement";
import { createQuadRouter } from "./quadRouter";
import { isVerticalSide } from "./quadTypes";

const ANCHOR_DOT = 6;
const SPLICE_DOT = 9;

function horizontalProxySide(side: QuadSide): "left" | "right" {
  return side === "right" ? "right" : "left";
}

type CachedQuadRoute = {
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
};

function cachedQuadRouteFromEdges(
  edges: Edge[],
  connectionId: string,
): CachedQuadRoute | undefined {
  const left = edges.find((e) => e.id === `splice-left-${connectionId}`);
  if (!left?.data || typeof left.data !== "object") return undefined;
  const data = left.data as Record<string, unknown>;
  if (
    typeof data.leftPath !== "string" ||
    typeof data.rightPath !== "string" ||
    typeof data.spliceX !== "number" ||
    typeof data.spliceY !== "number"
  ) {
    return undefined;
  }
  return {
    leftPath: data.leftPath,
    rightPath: data.rightPath,
    spliceX: data.spliceX,
    spliceY: data.spliceY,
  };
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
    rerouteConnectionIds?: string[];
    dragCacheEdges?: import("@xyflow/react").Edge[];
    /** Search harness — stack order per side (cable name keys). */
    fixedQuadStackOrder?: Partial<Record<QuadSide, string[]>>;
  },
): {
  nodes: Node[];
  edges: Edge[];
  layout: DiagramLayout;
  xBounds: CableXBounds;
  autoLayoutY: Record<string, number>;
  visualCables: VisualCable[];
  edgePlacement: ReturnType<typeof edgePlacementFromQuad>;
} {
  const { visualCables } = buildVisualCablesForLayout(graph);
  const connections = orderedFiberConnections(graph);
  const scale = computeDiagramScale(connections.length);
  const autoAdjustOn = overrides?.autoAdjustEnabled !== false;

  const { placement, stemAlign, width, height, centerX, centerY } =
    computeQuadPlacement(graph, visualCables, scale, {
      layoutWidth,
      pinnedSides: overrides?.quadCableSides,
      savedPositions: overrides?.positions,
      stackOrderByCableKey: _buildOptions?.fixedQuadStackOrder,
    });

  const sideOf = (vcId: string): QuadSide => placement.get(vcId)!.side;
  const posOf = (vcId: string) => placement.get(vcId)!.position;

  // Orient each cable for its side (top cables flip so colors read blue-first
  // left->right). Render + handle math share the oriented tubes, so dots stay
  // on the drawn strands.
  const orientedTubesById = new Map(
    visualCables.map((vc) => [
      vc.id,
      orientTubesForQuadSide(vc.tubes, sideOf(vc.id)),
    ]),
  );
  const orientedCableFor = (vc: VisualCable): VisualCable => ({
    ...vc,
    tubes: orientedTubesById.get(vc.id) ?? vc.tubes,
  });

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
        tubes: orientedTubesById.get(vc.id) ?? vc.tubes,
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
    const orientedVc = orientedCableFor(vc);
    const center = quadFiberHandleCenter(
      orientedVc,
      connectionId,
      posOf(vc.id),
      side,
      scale,
      stemAlign[side],
    );
    anchorCenter.set(key, center);

    const fiber = orientedVc.tubes
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

  // Phase 1: materialize every fiber handle so the router can see the full set
  // of port positions before it allocates lanes (placement -> handles -> lanes).
  type RoutePlan = {
    conn: (typeof connections)[number];
    vcAId: string;
    vcBId: string;
    sCenter: { x: number; y: number };
    tCenter: { x: number; y: number };
    sourceColor: string;
    targetColor: string;
  };
  const routePlans: RoutePlan[] = [];

  for (const conn of connections) {
    const epA = conn.pair.endpointA;
    const epB = conn.pair.endpointB;
    const vcA = findVisualCableForConnection(visualCables, conn.id, {
      cable: epA.cable,
    });
    const vcB = findVisualCableForConnection(visualCables, conn.id, {
      cable: epB.cable,
    });
    if (!vcA || !vcB) continue;

    routePlans.push({
      conn,
      vcAId: vcA.id,
      vcBId: vcB.id,
      sCenter: ensureAnchor(vcA, conn.id),
      tCenter: ensureAnchor(vcB, conn.id),
      sourceColor: colorHex(epA.fiberColor),
      targetColor: colorHex(epB.fiberColor),
    });
  }

  // Phase 2: frontiers from the full handle set, then a lane router that keeps
  // splices out of the dead center and minimizes bends.
  const frontierAnchors: QuadAnchorRef[] = [];
  for (const [key, center] of anchorCenter) {
    const vcId = key.slice(0, key.indexOf("::"));
    frontierAnchors.push({ x: center.x, y: center.y, side: sideOf(vcId) });
  }
  const frontiers = computeQuadFrontiers(frontierAnchors, { width, height });
  const router = createQuadRouter(frontiers, { x: centerX, y: centerY });

  const dragSync = _buildOptions?.dragSync === true;
  const rerouteSet = new Set(_buildOptions?.rerouteConnectionIds ?? []);
  const priorEdges = _buildOptions?.dragCacheEdges ?? [];

  for (const plan of routePlans) {
    const { conn, vcAId, vcBId, sCenter, tCenter, sourceColor, targetColor } =
      plan;

    const connId = conn.id;
    const cached =
      dragSync && priorEdges.length > 0 && !rerouteSet.has(connId)
        ? cachedQuadRouteFromEdges(priorEdges, connId)
        : undefined;

    const routed = cached
      ? cached
      : router.route(
          { x: sCenter.x, y: sCenter.y, side: sideOf(vcAId) },
          { x: tCenter.x, y: tCenter.y, side: sideOf(vcBId) },
        );

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
      // Fusion dots are never RF-draggable (no quad manual dot path); inert.
      draggable: false,
      selectable: false,
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
      source: `fiberAnchor-${vcAId}::${conn.id}`,
      target: spliceId,
      sourceHandle: "out",
      targetHandle: "in",
      type: "splice",
      data: { ...shared, splitLeg: "left" as const },
    });
    edges.push({
      id: `splice-right-${conn.id}`,
      source: spliceId,
      target: `fiberAnchor-${vcBId}::${conn.id}`,
      sourceHandle: "out",
      targetHandle: "in",
      type: "splice",
      data: { ...shared, splitLeg: "right" as const },
    });
  }

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
    visualCables,
    edgePlacement: edgePlacementFromQuad(
      placement,
      visualCables,
      _buildOptions?.fixedQuadStackOrder,
    ),
  };
}
