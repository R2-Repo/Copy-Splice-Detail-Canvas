import type { Edge, Node } from "@xyflow/react";

import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import {
  computeCableBreakout,
  computeSheathSize,
  SHEATH_SIZE,
  tubeReachFromSheath,
} from "@/features/diagram/cableBreakoutGeometry";
import {
  CABLE_LAYOUT,
  cableXForSide,
  FIBER_ROW_PITCH,
  SPLICE_LANE_SEP,
  TUBE_GROUP_GAP,
} from "@/features/diagram/cableLayoutMetrics";
import { computeCanvasPlacement } from "@/features/diagram/canvasPlacement";
import { connectionRowIndexMap, connectionRowOffsets } from "@/features/diagram/connectionRowOrder";
import {
  computeAlignedLayout,
  computeCableXBounds,
  maxNearStraightResidual,
  type AlignedDiagramLayout,
} from "@/features/diagram/spliceRowLayout";
import { computeSideCircuitLabelSpans } from "@/features/diagram/cableLabels";
import {
  fusionDotCornerClearanceOk,
  fusionDotOnHorizontalSegment,
  fusionDotVerticalLaneClearanceOk,
} from "@/features/manualAdjust/constraints";
// fusionDotOnHorizontalSegment used in DOT-001/003 checks
import { importLayoutWidthForGraph } from "@/features/diagram/layoutSpliceDiagram";
import {
  DEFAULT_LAYOUT_EXPANSION,
  getLayoutExpansion,
  layoutExpansionForIteration,
  MAX_LAYOUT_FEASIBILITY_ITERATIONS,
  runWithLayoutExpansion,
  type LayoutExpansion,
} from "@/features/diagram/layoutExpansion";
import {
  cableFiberTopToBottomOk,
  compactTubeFiberLayoutOk,
  tubesInTiaOrderOk,
} from "@/features/diagram/tubeFiberLayout";
import { resolveSpliceSourceTarget } from "@/features/diagram/resolveSpliceSourceTarget";
import {
  buildVisualCablesForLayout,
  endpointOnVisualSide,
  type VisualCable,
} from "@/features/diagram/visualCables";
import type { ConnectionGraph, FiberConnection, LayoutOverrides, TubeColorCode } from "@/types/splice";
import type { CablePlacement } from "@/features/diagram/canvasPlacement";
import {
  assignSpliceMidXLanes,
  assignSpliceRoutingLanes,
  spliceRoutingZoneKey,
  type MidXLaneCandidate,
  type SpliceRoutingLane,
} from "@/features/diagram/spliceCenterLanes";
import {
  buildButtSplicePath,
  buildSplicePath,
  fiberHandlePosition,
  MAX_SPLICE_BENDS,
  maxSpliceBendsForLane,
  parseButtTubeEndpointsFromEdgeId,
  parseTubeHandleId,
  routingLaneFromData,
  tubeHandlePosition,
  parallelSpliceSegmentsOverlap,
  pickSpliceRouteTemplate,
  resolveSpliceMidX,
  isNestedHandleRowHorizOverlap,
  isSharedSpliceRowLeadInOverlap,
  spliceRouteSegments,
  type SpliceRoutingLaneData,
  SPLICE_PATH_EPS,
  templateUsesMidXLanes,
} from "@/features/canvas/edges/spliceEdgeRouting";
import { orderedFiberConnections } from "@/features/diagram/buildConnectionGraph";
import { visualCableIdFromNodeId } from "@/features/diagram/cableDisplaySide";
import type { CableNodeData } from "@/features/canvas/nodes/types";
import {
  cablePositionsFromNodePositions,
  crossSideTubePairsAligned,
  type TubeRowShiftOptions,
} from "@/features/diagram/tubeRowShift";

/** Composite splice edge or nodes-engine left leg for one connection. */
function spliceEdgeForConnection(
  edges: Edge[],
  connectionId: string,
): Edge | undefined {
  return (
    edges.find((e) => e.id === `splice-left-${connectionId}`) ??
    edges.find((e) => e.id === `splice-${connectionId}`)
  );
}

/** Internal layout check IDs — public contract uses SDC IDs in rule pack. */
export const LAYOUT_RULE_IDS = [
  "FBR-001",
  "FBR-002",
  "FBR-003",
  "FBR-004",
  "TUB-001",
  "TUB-002",
  "TUB-003",
  "TUB-004",
  "TUB-005",
  "TUB-006",
  "TUB-007",
  "TUB-008",
  "CBL-001",
  "CBL-002",
  "CBL-003",
  "ROW-001",
  "ROW-002",
  "EDGE-004",
  "EDGE-006",
  "EDGE-008",
  "EDGE-011",
  "EDGE-012",
  "EDGE-013",
  "DOT-001",
  "DOT-002",
  "DOT-003",
  "DOT-004",
  "STR-001",
] as const;

export type LayoutRuleId = (typeof LAYOUT_RULE_IDS)[number];

export type LayoutRuleMeta = {
  id: LayoutRuleId;
  title: string;
  category: "fiber" | "tube" | "cable" | "row" | "dominant" | "edge" | "dot" | "strand";
};

export const LAYOUT_RULES: LayoutRuleMeta[] = [
  { id: "FBR-001", title: "TIA fiber order within each buffer tube", category: "fiber" },
  { id: "FBR-002", title: "24px pitch within each buffer tube", category: "fiber" },
  { id: "FBR-003", title: "rowYOffset increases top-to-bottom per cable", category: "fiber" },
  { id: "FBR-004", title: "Distinct rowYOffset per fiber on multi-tube cables", category: "fiber" },
  { id: "TUB-001", title: "Tubes attach at cable sheath center", category: "tube" },
  { id: "TUB-002", title: "Tube tip centered on fiber group", category: "tube" },
  { id: "TUB-003", title: "Sheath preserves aspect ratio", category: "tube" },
  { id: "TUB-004", title: "Multi-tube cables have longer tube reach", category: "tube" },
  { id: "TUB-005", title: "Right-side breakout mirrors left", category: "tube" },
  { id: "TUB-006", title: "Buffer tubes in TIA solid then striped order", category: "tube" },
  { id: "CBL-001", title: "Same-side cables do not overlap", category: "cable" },
  { id: "CBL-002", title: "Same-side cables stack with at least cableGap", category: "cable" },
  { id: "CBL-003", title: "Multi-tube cables offset X from center", category: "cable" },
  { id: "ROW-001", title: "Equal pitch within buffer tube in global rows", category: "row" },
  { id: "ROW-002", title: "Extra gap at buffer-tube boundaries", category: "row" },
  { id: "STR-001", title: "Fiber strands fan toward canvas center", category: "strand" },
];

export type LayoutRuleContext = {
  graph: ConnectionGraph;
  visualCables: VisualCable[];
  placement: Map<string, CablePlacement>;
  layout: AlignedDiagramLayout;
  reactFlow: { nodes: Node[]; edges: Edge[] };
  layoutWidth: number;
  layoutExpansion: LayoutExpansion;
};

export type LayoutRuleResult = {
  id: LayoutRuleId;
  ok: boolean;
  detail?: string;
};

const Y_TOLERANCE = 2;
const SHEATH_ASPECT = SHEATH_SIZE.baseWidth / SHEATH_SIZE.baseHeight;

function sideOf(
  vc: VisualCable,
  placement: Map<string, CablePlacement>,
): "left" | "right" {
  return placement.get(vc.id)?.side ?? vc.side;
}

function orderOf(vc: VisualCable, placement: Map<string, CablePlacement>): number {
  return placement.get(vc.id)?.order ?? vc.order;
}

function cableBoxesOverlap(
  a: { y: number; height: number },
  b: { y: number; height: number },
): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

function fibersInTiaOrder(visualCables: VisualCable[]): boolean {
  for (const vc of visualCables) {
    for (const tube of vc.tubes) {
      const fibers = tube.fibers;
      for (let i = 1; i < fibers.length; i++) {
        if (fibers[i]!.fiberNumber <= fibers[i - 1]!.fiberNumber) return false;
      }
    }
  }
  return true;
}

function multiTubeDistinctOffsets(visualCables: VisualCable[]): boolean {
  for (const vc of visualCables.filter((v) => v.tubes.length > 1)) {
    const offsets = vc.tubes.flatMap((t) => t.fibers.map((f) => f.rowYOffset));
    if (new Set(offsets).size !== offsets.length) return false;
  }
  return true;
}

function tubeGeometryOk(
  visualCables: VisualCable[],
  placement: Map<string, CablePlacement>,
): { ok: boolean; detail?: string } {
  for (const vc of visualCables) {
    const side = sideOf(vc, placement);
    const geo = computeCableBreakout(
      vc.tubes,
      side,
      FIBER_ROW_PITCH,
      CABLE_LAYOUT.headerH,
      CABLE_LAYOUT.tubeLabelH,
    );

    for (const tube of geo.tubes) {
      const rowYs = tube.fibers.map((f) => f.rowY);
      const fiberCenterY = (Math.min(...rowYs) + Math.max(...rowYs)) / 2;
      const horizontal = Math.abs(tube.origin.y - tube.end.y) <= Y_TOLERANCE;
      const onSheathFace =
        tube.origin.y >= geo.sheath.y - Y_TOLERANCE &&
        tube.origin.y <= geo.sheath.y + geo.sheath.height + Y_TOLERANCE;
      if (horizontal && !onSheathFace) {
        return {
          ok: false,
          detail: `Cable ${vc.id}: tube ${tube.tubeColor} horizontal origin off sheath face`,
        };
      }
      if (!horizontal && Math.abs(tube.origin.y - geo.cableCenterY) > Y_TOLERANCE) {
        return {
          ok: false,
          detail: `Cable ${vc.id}: tube ${tube.tubeColor} angled origin not at center`,
        };
      }
      if (Math.abs(tube.end.y - fiberCenterY) > Y_TOLERANCE) {
        return {
          ok: false,
          detail: `Cable ${vc.id}: tube ${tube.tubeColor} tip not centered on fibers`,
        };
      }
    }

    const aspect = geo.sheath.width / geo.sheath.height;
    if (Math.abs(aspect - SHEATH_ASPECT) > 0.01) {
      return { ok: false, detail: `Cable ${vc.id}: sheath aspect ratio drift` };
    }
  }
  return { ok: true };
}

function tubeReachIncreases(visualCables: VisualCable[]): boolean {
  const singles = visualCables.filter((v) => v.tubes.length === 1);
  const multis = visualCables.filter((v) => v.tubes.length > 1);
  if (singles.length === 0 || multis.length === 0) return true;

  const maxSingleReach = Math.max(
    ...singles.map((v) => tubeReachFromSheath(v.tubes)),
  );
  const minMultiReach = Math.min(
    ...multis.map((v) => tubeReachFromSheath(v.tubes)),
  );
  return minMultiReach > maxSingleReach;
}

function rightSideMirrors(visualCables: VisualCable[]): boolean {
  const sample = visualCables.find((v) => v.tubes.length >= 1);
  if (!sample) return true;

  const left = computeCableBreakout(
    sample.tubes,
    "left",
    FIBER_ROW_PITCH,
    CABLE_LAYOUT.headerH,
    CABLE_LAYOUT.tubeLabelH,
  );
  const right = computeCableBreakout(
    sample.tubes,
    "right",
    FIBER_ROW_PITCH,
    CABLE_LAYOUT.headerH,
    CABLE_LAYOUT.tubeLabelH,
  );
  return right.sheath.x > left.sheath.x && right.tubes[0]!.origin.x > left.tubes[0]!.origin.x;
}

function sameSideNoOverlap(ctx: LayoutRuleContext): boolean {
  for (const side of ["left", "right"] as const) {
    const boxes = ctx.visualCables
      .filter((vc) => sideOf(vc, ctx.placement) === side)
      .map((vc) => ctx.layout.cablePositions.get(vc.id)!)
      .filter(Boolean);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (cableBoxesOverlap(boxes[i]!, boxes[j]!)) return false;
      }
    }
  }
  return true;
}

function sameSideStackGap(ctx: LayoutRuleContext): boolean {
  for (const side of ["left", "right"] as const) {
    const cables = ctx.visualCables
      .filter((vc) => sideOf(vc, ctx.placement) === side)
      .sort((a, b) => orderOf(a, ctx.placement) - orderOf(b, ctx.placement));
    for (let i = 1; i < cables.length; i++) {
      const prev = ctx.layout.cablePositions.get(cables[i - 1]!.id)!;
      const curr = ctx.layout.cablePositions.get(cables[i]!.id)!;
      const gap = curr.y - (prev.y + prev.height);
      if (gap < CABLE_LAYOUT.cableGap - Y_TOLERANCE) return false;
    }
  }
  return true;
}

function globalRowStepsOk(ctx: LayoutRuleContext): {
  withinTube: boolean;
  tubeBoundary: boolean;
  splitGap: boolean;
} {
  const offsets = connectionRowOffsets(ctx.graph, ctx.visualCables);
  const values = [...offsets.values()].sort((a, b) => a - b);
  const steps = values.slice(1).map((y, i) => y - values[i]!);

  const expansion = getLayoutExpansion();
  const tubeBoundaryStep =
    FIBER_ROW_PITCH + TUBE_GROUP_GAP + expansion.tubeGroupGapExtra;

  const withinTube =
    steps.some((s) => s === FIBER_ROW_PITCH) ||
    values.length <= 1 ||
    (steps.some((s) => s > tubeBoundaryStep) &&
      compactTubeFiberLayoutOk(ctx.visualCables));
  const tubeBoundary =
    steps.some((s) => s === tubeBoundaryStep) || values.length <= 1;
  const splitGap =
    steps.some((s) => s > tubeBoundaryStep) ||
    steps.some((s) => s >= FIBER_ROW_PITCH * 2 + expansion.tubeGroupGapExtra) ||
    values.length <= 1;

  return { withinTube, tubeBoundary, splitGap };
}



function spliceHandleEndpoints(
  ctx: LayoutRuleContext,
  conn: FiberConnection,
): {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  rowOffset: number;
  sourceTagWidth: number;
  targetTagWidth: number;
} | null {
  const csvLeft = endpointOnVisualSide(
    conn,
    ctx.graph,
    ctx.visualCables,
    "left",
  );
  const csvRight = endpointOnVisualSide(
    conn,
    ctx.graph,
    ctx.visualCables,
    "right",
  );
  if (!csvLeft || !csvRight) return null;

  const nodeById = new Map(ctx.reactFlow.nodes.map((n) => [n.id, n]));
  const leftNode = nodeById.get(`cable-${csvLeft.visualCableId}`);
  const rightNode = nodeById.get(`cable-${csvRight.visualCableId}`);
  if (!leftNode || !rightNode) return null;

  const leftVc = ctx.visualCables.find((v) => v.id === csvLeft.visualCableId);
  const rightVc = ctx.visualCables.find((v) => v.id === csvRight.visualCableId);
  if (!leftVc || !rightVc) return null;

  const positions: Record<string, { x: number; y: number }> = {};
  for (const [nodeId, node] of nodeById) {
    positions[nodeId] = node.position;
  }
  const { source: sourceEp, target: targetEp } = resolveSpliceSourceTarget(
    csvLeft,
    csvRight,
    positions,
  );
  const sourceNode = nodeById.get(`cable-${sourceEp.visualCableId}`);
  const targetNode = nodeById.get(`cable-${targetEp.visualCableId}`);
  const sourceVc = ctx.visualCables.find((v) => v.id === sourceEp.visualCableId);
  const targetVc = ctx.visualCables.find((v) => v.id === targetEp.visualCableId);
  if (!sourceNode || !targetNode || !sourceVc || !targetVc) return null;

  const sourceScale =
    (sourceNode.data as { diagramScale?: number }).diagramScale ?? 1;
  const targetScale =
    (targetNode.data as { diagramScale?: number }).diagramScale ?? 1;
  const sourceAligned = (sourceNode.data as { alignedStemX?: number })
    .alignedStemX;
  const targetAligned = (targetNode.data as { alignedStemX?: number })
    .alignedStemX;

  const sourceHandle = fiberHandlePosition(
    sourceVc,
    conn.id,
    sourceNode.position,
    sourceScale,
    sourceAligned,
  );
  const targetHandle = fiberHandlePosition(
    targetVc,
    conn.id,
    targetNode.position,
    targetScale,
    targetAligned,
  );

  const edge = spliceEdgeForConnection(ctx.reactFlow.edges, conn.id);
  const rowOffset = (edge?.data as { rowOffset?: number })?.rowOffset ?? 0;

  return {
    sourceX: sourceHandle.x,
    sourceY: sourceHandle.y,
    targetX: targetHandle.x,
    targetY: targetHandle.y,
    rowOffset,
    sourceTagWidth: 0,
    targetTagWidth: 0,
  };
}

function buttSpliceHandleEndpoints(
  ctx: LayoutRuleContext,
  edge: Edge,
): {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  rowOffset: number;
} | null {
  const sourceNode = ctx.reactFlow.nodes.find((n) => n.id === edge.source);
  const targetNode = ctx.reactFlow.nodes.find((n) => n.id === edge.target);
  if (!sourceNode || !targetNode) return null;

  const vcByNodeId = new Map(
    ctx.visualCables.map((vc) => [`cable-${vc.id}`, vc]),
  );
  const sourceVc = edge.source ? vcByNodeId.get(edge.source) : undefined;
  const targetVc = edge.target ? vcByNodeId.get(edge.target) : undefined;
  if (!sourceVc || !targetVc) return null;

  const sourceTube =
    parseTubeHandleId(edge.sourceHandle) ??
    parseButtTubeEndpointsFromEdgeId(edge.id)?.endpointA;
  const targetTube =
    parseTubeHandleId(edge.targetHandle) ??
    parseButtTubeEndpointsFromEdgeId(edge.id)?.endpointB;
  if (!sourceTube || !targetTube) return null;

  const sourceScale =
    (sourceNode.data as { diagramScale?: number }).diagramScale ?? 1;
  const targetScale =
    (targetNode.data as { diagramScale?: number }).diagramScale ?? 1;
  const sourceAligned = (sourceNode.data as { alignedStemX?: number }).alignedStemX;
  const targetAligned = (targetNode.data as { alignedStemX?: number }).alignedStemX;

  const sourcePos = tubeHandlePosition(
    sourceVc,
    sourceTube.tubeColor,
    sourceNode.position,
    sourceScale,
    sourceAligned,
  );
  const targetPos = tubeHandlePosition(
    targetVc,
    targetTube.tubeColor,
    targetNode.position,
    targetScale,
    targetAligned,
  );
  const rowOffset = (edge.data as { rowOffset?: number })?.rowOffset ?? 0;

  return {
    sourceX: sourcePos.x,
    sourceY: sourcePos.y,
    targetX: targetPos.x,
    targetY: targetPos.y,
    rowOffset,
  };
}

function sideCircuitSpanFromCtx(ctx: LayoutRuleContext) {
  for (const edge of ctx.reactFlow.edges) {
    if (edge.type !== "splice") continue;
    const span = (edge.data as { sideCircuitSpan?: { left: number; right: number } })
      .sideCircuitSpan;
    if (span) return span;
  }
  return computeSideCircuitLabelSpans(ctx.visualCables, (vc) =>
    sideOf(vc, ctx.placement),
  );
}

function buildMidXLaneCandidates(ctx: LayoutRuleContext): MidXLaneCandidate[] {
  const candidates: MidXLaneCandidate[] = [];

  for (const conn of orderedFiberConnections(ctx.graph)) {
    if (conn.kind !== "fiber") continue;
    const endpoints = spliceHandleEndpoints(ctx, conn);
    if (!endpoints) continue;

    const { sourceX, sourceY, targetX, targetY, rowOffset } = endpoints;
    if (
      !templateUsesMidXLanes(
        pickSpliceRouteTemplate(sourceX, sourceY, targetX, targetY),
      )
    ) {
      continue;
    }

    const edge = spliceEdgeForConnection(ctx.reactFlow.edges, conn.id);
    const tubeBundleKey = (edge?.data as { tubeBundleKey?: string })
      ?.tubeBundleKey;

    candidates.push({
      id: conn.id,
      sourceX,
      sourceY,
      targetX,
      targetY,
      rowOffset,
      tubeBundleKey,
    });
  }

  return candidates;
}

function routingLanesFromReactFlow(ctx: LayoutRuleContext): Map<string, SpliceRoutingLane> {
  const map = new Map<string, SpliceRoutingLane>();
  for (const edge of ctx.reactFlow.edges) {
    if (edge.type !== "splice") continue;
    if (edge.id.startsWith("splice-right-")) continue;
    const lane = routingLaneFromData(edge.data as SpliceRoutingLaneData);
    if (!lane || !Number.isFinite(lane.midX)) continue;
    let connId = edge.id;
    if (connId.startsWith("splice-left-")) {
      connId = connId.slice("splice-left-".length);
    } else if (connId.startsWith("splice-")) {
      connId = connId.slice("splice-".length);
    }
    map.set(connId, lane);
  }
  return map;
}

function buildPackedRoutingMap(ctx: LayoutRuleContext): Map<string, SpliceRoutingLane> {
  return assignSpliceRoutingLanes(
    buildMidXLaneCandidates(ctx),
    sideCircuitSpanFromCtx(ctx),
  );
}

/** Lanes stored on import / precomputed edges — matches canvas render. */
function buildRenderRoutingMap(ctx: LayoutRuleContext): Map<string, SpliceRoutingLane> {
  const stored = routingLanesFromReactFlow(ctx);
  if (stored.size > 0) return stored;
  return buildPackedRoutingMap(ctx);
}

function resolveCtxSpliceRouting(
  ctx: LayoutRuleContext,
  connId: string,
  endpoints: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    rowOffset: number;
  },
  packed: Map<string, SpliceRoutingLane>,
): SpliceRoutingLane {
  const packedLane = packed.get(connId);
  if (packedLane) return packedLane;

  const rowOffsets = connectionRowOffsets(
    ctx.graph,
    ctx.visualCables,
      );
  const maxRowOffset = Math.max(0, ...rowOffsets.values());
  const { sourceX, sourceY, targetX, targetY, rowOffset } = endpoints;
  return {
    midX: resolveSpliceMidX(sourceX, sourceY, targetX, targetY, {
      rowOffset,
      maxRowOffset,
      diagramCenterX: ctx.layoutWidth / 2,
      sideCircuitSpan: sideCircuitSpanFromCtx(ctx),
    }),
  };
}

function splicePathsWithinBendLimit(ctx: LayoutRuleContext): boolean {
  const packed = buildRenderRoutingMap(ctx);
  const sideSpans = sideCircuitSpanFromCtx(ctx);

  for (const conn of orderedFiberConnections(ctx.graph)) {
    if (conn.kind !== "fiber") continue;
    const endpoints = spliceHandleEndpoints(ctx, conn);
    if (!endpoints) continue;

    const { sourceX, sourceY, targetX, targetY } = endpoints;
    const lane = resolveCtxSpliceRouting(ctx, conn.id, endpoints, packed);
    const { midX, jogX, sourceHorizY, targetHorizY } = lane;
    const { bendCount } = buildSplicePath(
      sourceX,
      sourceY,
      targetX,
      targetY,
      midX,
      jogX,
      { sourceHorizY, targetHorizY },
      sideSpans,
      ctx.layoutWidth / 2,
      endpoints.sourceTagWidth ?? 0,
      endpoints.targetTagWidth ?? 0,
    );
    const maxBends = maxSpliceBendsForLane(sourceY, targetY, lane);
    if (bendCount > maxBends) return false;
  }

  for (const edge of ctx.reactFlow.edges) {
    if (edge.type !== "splice") continue;
    const edgeData = edge.data as { fullButtSplice?: boolean };
    if (!edge.id.startsWith("butt-") && !edgeData.fullButtSplice) continue;

    const endpoints = buttSpliceHandleEndpoints(ctx, edge);
    if (!endpoints) continue;

    const { sourceX, sourceY, targetX, targetY } = endpoints;
    const storedLane = routingLaneFromData(edge.data as SpliceRoutingLaneData);
    if (!storedLane) return false;

    const { midX } = storedLane;
    const { bendCount } = buildButtSplicePath(
      sourceX,
      sourceY,
      targetX,
      targetY,
      midX,
      sideSpans,
      ctx.layoutWidth / 2,
    );
    if (bendCount > MAX_SPLICE_BENDS) return false;
  }

  return true;
}

function centerLanesKeepMinSpacing(ctx: LayoutRuleContext): boolean {
  const candidates = buildMidXLaneCandidates(ctx);
  const packed = assignSpliceMidXLanes(candidates, sideCircuitSpanFromCtx(ctx));
  const byZone = new Map<string, number[]>();

  for (const candidate of candidates) {
    const midX = packed.get(candidate.id);
    if (midX === undefined) continue;
    const zoneKey = spliceRoutingZoneKey(candidate.sourceX, candidate.targetX);
    const list = byZone.get(zoneKey) ?? [];
    list.push(midX);
    byZone.set(zoneKey, list);
  }

  for (const mids of byZone.values()) {
    const sorted = [...mids].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]! - sorted[i - 1]! < SPLICE_LANE_SEP - SPLICE_PATH_EPS) {
        return false;
      }
    }
  }
  return true;
}

function fusionDotsOnHorizontalSegments(ctx: LayoutRuleContext): boolean {
  const packed = buildRenderRoutingMap(ctx);
  const sideSpans = sideCircuitSpanFromCtx(ctx);

  for (const conn of orderedFiberConnections(ctx.graph)) {
    if (conn.kind !== "fiber") continue;
    const edge = spliceEdgeForConnection(ctx.reactFlow.edges, conn.id);
    if (!edge) continue;
    const edgeData = edge.data as {
      fullButtSplice?: boolean;
      spliceX?: number;
      spliceY?: number;
      routingPrecomputed?: boolean;
    };
    if (edgeData.fullButtSplice) continue;

    const endpoints = spliceHandleEndpoints(ctx, conn);
    if (!endpoints) continue;
    const { sourceX, sourceY, targetX, targetY } = endpoints;
    const lane = resolveCtxSpliceRouting(ctx, conn.id, endpoints, packed);
    const tubeDotColumnX = (edge.data as { tubeDotColumnX?: number })
      .tubeDotColumnX;
    const built = buildSplicePath(
      sourceX,
      sourceY,
      targetX,
      targetY,
      lane.midX,
      lane.jogX,
      {
        sourceHorizY: lane.sourceHorizY,
        targetHorizY: lane.targetHorizY,
        sourceBendX: lane.sourceBendX,
        targetBendX: lane.targetBendX,
      },
      sideSpans,
      ctx.layoutWidth / 2,
      0,
      0,
      tubeDotColumnX !== undefined ? { tubeDotColumnX } : undefined,
    );
    if (
      !fusionDotOnHorizontalSegment(
        built.spliceX,
        built.spliceY,
        built.leftPath,
        built.rightPath,
      )
    ) {
      return false;
    }
  }
  return true;
}

function findBufferTubeDotViolation(
  ctx: LayoutRuleContext,
): string | undefined {
  const byGroup = new Map<
    string,
    Array<{ spliceX: number; sourceY: number; rowOffset: number; id: string }>
  >();

  for (const conn of orderedFiberConnections(ctx.graph)) {
    if (conn.kind !== "fiber") continue;
    const edge = spliceEdgeForConnection(ctx.reactFlow.edges, conn.id);
    if (!edge) continue;
    const edgeData = edge.data as {
      sourceTubeDotGroupKey?: string;
      spliceX?: number;
      rowOffset?: number;
      fullButtSplice?: boolean;
    };
    if (edgeData.fullButtSplice) continue;
    const groupKey = edgeData.sourceTubeDotGroupKey;
    if (!groupKey) continue;
    if (edgeData.spliceX === undefined) continue;
    const endpoints = spliceHandleEndpoints(ctx, conn);
    if (!endpoints) continue;
    const list = byGroup.get(groupKey) ?? [];
    list.push({
      spliceX: edgeData.spliceX,
      sourceY: endpoints.sourceY,
      rowOffset: edgeData.rowOffset ?? 0,
      id: conn.id,
    });
    byGroup.set(groupKey, list);
  }

  for (const [groupKey, members] of byGroup) {
    if (members.length < 2) continue;
    const anchorX = members[0]!.spliceX;
    const xMismatch = members.find((m) => Math.abs(m.spliceX - anchorX) > 2);
    if (xMismatch) {
      return `${groupKey}: spliceX mismatch (${members.map((m) => `${m.id}@${m.spliceX}`).join(", ")})`;
    }
    const sorted = [...members].sort((a, b) => a.sourceY - b.sourceY);
    for (let i = 1; i < sorted.length; i++) {
      const yStep = sorted[i]!.sourceY - sorted[i - 1]!.sourceY;
      if (yStep < FIBER_ROW_PITCH - 2) {
        return `${groupKey}: sourceY collapsed for ${sorted[i]!.id}`;
      }
      const pitchMultiple = Math.round(yStep / FIBER_ROW_PITCH);
      if (Math.abs(yStep - pitchMultiple * FIBER_ROW_PITCH) > 2) {
        return `${groupKey}: sourceY step ${yStep}px is not a 24px multiple between ${sorted[i - 1]!.id} and ${sorted[i]!.id}`;
      }
    }
  }
  return undefined;
}

function fusionDotsCornerClearanceOk(ctx: LayoutRuleContext): boolean {
  const packed = buildRenderRoutingMap(ctx);
  const sideSpans = sideCircuitSpanFromCtx(ctx);

  for (const conn of orderedFiberConnections(ctx.graph)) {
    if (conn.kind !== "fiber") continue;
    const edge = spliceEdgeForConnection(ctx.reactFlow.edges, conn.id);
    if (!edge) continue;
    const edgeData = edge.data as { fullButtSplice?: boolean };
    if (edgeData.fullButtSplice) continue;

    const endpoints = spliceHandleEndpoints(ctx, conn);
    if (!endpoints) continue;
    const { sourceX, sourceY, targetX, targetY } = endpoints;
    const lane = resolveCtxSpliceRouting(ctx, conn.id, endpoints, packed);
    const built = buildSplicePath(
      sourceX,
      sourceY,
      targetX,
      targetY,
      lane.midX,
      lane.jogX,
      {
        sourceHorizY: lane.sourceHorizY,
        targetHorizY: lane.targetHorizY,
        sourceBendX: lane.sourceBendX,
        targetBendX: lane.targetBendX,
      },
      sideSpans,
      ctx.layoutWidth / 2,
      0,
      0,
      (edge.data as { tubeDotColumnX?: number }).tubeDotColumnX !== undefined
        ? {
            tubeDotColumnX: (edge.data as { tubeDotColumnX?: number })
              .tubeDotColumnX,
          }
        : undefined,
    );
    if (
      !fusionDotCornerClearanceOk(
        built.spliceX,
        built.spliceY,
        built.leftPath,
        built.rightPath,
      )
    ) {
      return false;
    }
  }
  return true;
}

function fusionDotsVerticalLaneClearanceOk(ctx: LayoutRuleContext): boolean {
  const packed = buildRenderRoutingMap(ctx);
  const sideSpans = sideCircuitSpanFromCtx(ctx);

  for (const conn of orderedFiberConnections(ctx.graph)) {
    if (conn.kind !== "fiber") continue;
    const edge = spliceEdgeForConnection(ctx.reactFlow.edges, conn.id);
    if (!edge) continue;
    const edgeData = edge.data as { fullButtSplice?: boolean };
    if (edgeData.fullButtSplice) continue;

    const endpoints = spliceHandleEndpoints(ctx, conn);
    if (!endpoints) continue;
    const { sourceX, sourceY, targetX, targetY } = endpoints;
    const lane = resolveCtxSpliceRouting(ctx, conn.id, endpoints, packed);
    const built = buildSplicePath(
      sourceX,
      sourceY,
      targetX,
      targetY,
      lane.midX,
      lane.jogX,
      {
        sourceHorizY: lane.sourceHorizY,
        targetHorizY: lane.targetHorizY,
        sourceBendX: lane.sourceBendX,
        targetBendX: lane.targetBendX,
      },
      sideSpans,
      ctx.layoutWidth / 2,
      0,
      0,
      (edge.data as { tubeDotColumnX?: number }).tubeDotColumnX !== undefined
        ? {
            tubeDotColumnX: (edge.data as { tubeDotColumnX?: number })
              .tubeDotColumnX,
          }
        : undefined,
    );
    if (
      !fusionDotVerticalLaneClearanceOk(
        built.spliceX,
        built.spliceY,
        built.leftPath,
        built.rightPath,
      )
    ) {
      return false;
    }
  }
  return true;
}

function bufferTubeDotsStackVertically(ctx: LayoutRuleContext): boolean {
  return findBufferTubeDotViolation(ctx) === undefined;
}

function verticalCenterLegsSpaced(ctx: LayoutRuleContext): boolean {
  const packed = buildRenderRoutingMap(ctx);
  const byZone = new Map<
    string,
    Array<{ midX: number; y0: number; y1: number; id: string }>
  >();

  for (const conn of orderedFiberConnections(ctx.graph)) {
    if (conn.kind !== "fiber") continue;
    const endpoints = spliceHandleEndpoints(ctx, conn);
    if (!endpoints) continue;
    const lane = packed.get(conn.id);
    if (!lane) continue;
    const { sourceX, sourceY, targetX, targetY } = endpoints;
    const srcHY = lane.sourceHorizY ?? sourceY;
    const tgtHY = lane.targetHorizY ?? targetY;
    const spliceY = (sourceY + targetY) / 2;
    const y0 = Math.min(srcHY, spliceY, tgtHY);
    const y1 = Math.max(srcHY, spliceY, tgtHY);
    const zoneKey = spliceRoutingZoneKey(sourceX, targetX);
    const list = byZone.get(zoneKey) ?? [];
    list.push({ midX: lane.midX, y0, y1, id: conn.id });
    byZone.set(zoneKey, list);
  }

  for (const members of byZone.values()) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i]!;
        const b = members[j]!;
        const yOverlap =
          Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > SPLICE_PATH_EPS;
        if (!yOverlap) continue;
        if (Math.abs(a.midX - b.midX) < SPLICE_LANE_SEP - SPLICE_PATH_EPS) {
          return false;
        }
      }
    }
  }
  return true;
}

function splicePathsDoNotOverlap(ctx: LayoutRuleContext): boolean {
  return findSpliceOverlapPair(ctx) === null;
}

/** @internal test helper — first overlapping strand pair, if any. */
export function findSpliceOverlapPair(ctx: LayoutRuleContext): string | null {
  const packed = buildRenderRoutingMap(ctx);
  const routed: Array<{
    id: string;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    midX: number;
    jogX?: number;
    sourceHorizY?: number;
    targetHorizY?: number;
    sourceBendX?: number;
    targetBendX?: number;
    tubeBundleKey?: string;
  }> = [];

  for (const conn of orderedFiberConnections(ctx.graph)) {
    if (conn.kind !== "fiber") continue;
    const endpoints = spliceHandleEndpoints(ctx, conn);
    if (!endpoints) continue;

    const { sourceX, sourceY, targetX, targetY } = endpoints;
    const template = pickSpliceRouteTemplate(
      sourceX,
      sourceY,
      targetX,
      targetY,
    );
    if (template === "straight") continue;

    const edge = spliceEdgeForConnection(ctx.reactFlow.edges, conn.id);
    const tubeBundleKey = (edge?.data as { tubeBundleKey?: string })
      ?.tubeBundleKey;
    const lane = packed.get(conn.id);
    if (!lane || !Number.isFinite(lane.midX)) continue;
    routed.push({
      id: conn.id,
      sourceX,
      sourceY,
      targetX,
      targetY,
      midX: lane.midX,
      jogX: lane.jogX,
      sourceHorizY: lane.sourceHorizY,
      targetHorizY: lane.targetHorizY,
      sourceBendX: lane.sourceBendX,
      targetBendX: lane.targetBendX,
      tubeBundleKey,
    });
  }

  for (let i = 0; i < routed.length; i++) {
    for (let j = i + 1; j < routed.length; j++) {
      const a = routed[i]!;
      const b = routed[j]!;
      if (a.tubeBundleKey && a.tubeBundleKey === b.tubeBundleKey) continue;
      if (
        spliceRoutingZoneKey(a.sourceX, a.targetX) !==
        spliceRoutingZoneKey(b.sourceX, b.targetX)
      ) {
        continue;
      }
      if (
        Math.abs(a.targetX - b.targetX) <= Y_TOLERANCE &&
        Math.abs(a.targetY - b.targetY) <= Y_TOLERANCE
      ) {
        continue;
      }
      const segsA = spliceRouteSegments(
        a.sourceX,
        a.sourceY,
        a.targetX,
        a.targetY,
        a.midX,
        a.jogX,
        {
          sourceHorizY: a.sourceHorizY,
          targetHorizY: a.targetHorizY,
          sourceBendX: a.sourceBendX,
          targetBendX: a.targetBendX,
        },
      );
      const segsB = spliceRouteSegments(
        b.sourceX,
        b.sourceY,
        b.targetX,
        b.targetY,
        b.midX,
        b.jogX,
        {
          sourceHorizY: b.sourceHorizY,
          targetHorizY: b.targetHorizY,
          sourceBendX: b.sourceBendX,
          targetBendX: b.targetBendX,
        },
      );
      for (const segA of segsA) {
        for (const segB of segsB) {
          if (
            isSharedSpliceRowLeadInOverlap(
              a.sourceY,
              b.sourceY,
              a.targetY,
              b.targetY,
              segA,
              segB,
            )
          ) {
            continue;
          }
          if (isNestedHandleRowHorizOverlap(segA, segB, a.midX, b.midX)) {
            continue;
          }
          if (parallelSpliceSegmentsOverlap(segA, segB)) {
            return `${a.id} vs ${b.id} :: ${segA.kind}/${segB.kind} mid=${a.midX}/${b.midX}`;
          }
        }
      }
    }
  }

  return null;
}



function spliceRoutesMinimizeBends(ctx: LayoutRuleContext): boolean {
  for (const conn of orderedFiberConnections(ctx.graph)) {
    if (conn.kind !== "fiber") continue;
    const endpoints = spliceHandleEndpoints(ctx, conn);
    if (!endpoints) continue;

    const { sourceX, sourceY, targetX, targetY } = endpoints;
    const expected = pickSpliceRouteTemplate(
      sourceX,
      sourceY,
      targetX,
      targetY,
    );
    const midX = resolveSpliceMidX(sourceX, sourceY, targetX, targetY);
    const built = buildSplicePath(sourceX, sourceY, targetX, targetY, midX);
    if (built.template !== expected) return false;
  }
  return true;
}

function sameSideFiberStemColumnsAligned(ctx: LayoutRuleContext): boolean {
  for (const side of ["left", "right"] as const) {
    const stemCanvasX: number[] = [];

    for (const node of ctx.reactFlow.nodes) {
      if (node.type !== "cable") continue;
      const data = node.data as {
        side: "left" | "right";
        alignedStemX?: number;
        diagramScale?: number;
      };
      const vc = ctx.visualCables.find((v) => `cable-${v.id}` === node.id);
      if (!vc) continue;
      if (sideOf(vc, ctx.placement) !== side) continue;

      const scale = data.diagramScale ?? 1;
      const geo = computeCableBreakout(
        vc.tubes,
        side,
        CABLE_LAYOUT.fiberRowH,
        CABLE_LAYOUT.headerH,
        CABLE_LAYOUT.tubeLabelH,
        scale,
        data.alignedStemX,
      );
      stemCanvasX.push(
        side === "left"
          ? node.position.x + geo.stemX
          : node.position.x + geo.viewWidth - geo.stemX,
      );
    }

    if (stemCanvasX.length <= 1) continue;
    const expected = stemCanvasX[0]!;
    for (const x of stemCanvasX.slice(1)) {
      if (Math.abs(x - expected) > Y_TOLERANCE) return false;
    }
  }
  return true;
}

function strandFansTowardCenter(ctx: LayoutRuleContext): boolean {
  const centerX = ctx.layoutWidth / 2;

  for (const node of ctx.reactFlow.nodes) {
    if (node.type !== "cable") continue;
    const data = node.data as {
      side: "left" | "right";
      tubes: VisualCable["tubes"];
      diagramScale?: number;
      fiberPitch?: number;
      alignedStemX?: number;
    };
    const scale = data.diagramScale ?? 1;
    const pitch = data.fiberPitch ?? CABLE_LAYOUT.fiberRowH;
    const geo = computeCableBreakout(
      data.tubes,
      data.side,
      pitch,
      CABLE_LAYOUT.headerH,
      CABLE_LAYOUT.tubeLabelH,
      scale,
      data.alignedStemX,
    );
    const sheathCenterLocal = geo.sheath.x + geo.sheath.width / 2;

    for (const tube of geo.tubes) {
      for (const fiber of tube.fibers) {
        const absSheathCenter = node.position.x + sheathCenterLocal;
        const absFanTo = node.position.x + fiber.fanTo.x;
        if (data.side === "left" && absFanTo <= absSheathCenter + Y_TOLERANCE) {
          return false;
        }
        if (data.side === "right" && absFanTo >= absSheathCenter - Y_TOLERANCE) {
          return false;
        }
      }
    }

    const absSheathCenter = node.position.x + sheathCenterLocal;
    if (data.side === "left" && absSheathCenter >= centerX) return false;
    if (data.side === "right" && absSheathCenter <= centerX) return false;
  }

  return true;
}

function cablePositionsFromReactFlowNodes(
  nodes: Node[],
): Map<string, { x: number; y: number; height: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    if (node.type !== "cable") continue;
    positions[node.id] = node.position;
  }
  return cablePositionsFromNodePositions(positions);
}

function visualCablesFromReactFlowNodes(nodes: Node[]): VisualCable[] {
  return nodes
    .filter((node) => node.type === "cable")
    .map((node) => {
      const vcId = visualCableIdFromNodeId(node.id);
      const data = node.data as CableNodeData;
      return {
        id: vcId ?? node.id,
        cable: data.label,
        legId: data.legId,
        device: "",
        side: data.side,
        order: 0,
        tubes: data.tubes,
      } as VisualCable;
    });
}

function tubeShiftOptionsFromReactFlowNodes(
  nodes: Node[],
): TubeRowShiftOptions | undefined {
  const collapsedTubeColorsByVcId = new Map<string, Set<TubeColorCode>>();
  for (const node of nodes) {
    if (node.type !== "cable") continue;
    const vcId = visualCableIdFromNodeId(node.id);
    const collapsed = (node.data as CableNodeData).collapsedTubes;
    if (!vcId || !collapsed?.length) continue;
    collapsedTubeColorsByVcId.set(
      vcId,
      new Set(collapsed as TubeColorCode[]),
    );
  }
  if (collapsedTubeColorsByVcId.size === 0) return undefined;
  return { collapsedTubeColorsByVcId };
}

export function buildLayoutRuleContext(
  graph: ConnectionGraph,
  layoutWidth?: number,
  overrides?: Pick<LayoutOverrides, "collapseFullButtSplices">,
  options?: { stageWidth?: number; skipFeasibility?: boolean },
): LayoutRuleContext {
  const baseWidth =
    layoutWidth ??
    importLayoutWidthForGraph(graph, { stageWidth: options?.stageWidth ?? 0 });

  if (options?.skipFeasibility) {
    return buildLayoutRuleContextWithExpansion(
      graph,
      baseWidth,
      DEFAULT_LAYOUT_EXPANSION,
      overrides,
    );
  }

  let lastWidth = baseWidth;
  let lastExpansion = DEFAULT_LAYOUT_EXPANSION;

  for (let iteration = 0; iteration <= MAX_LAYOUT_FEASIBILITY_ITERATIONS; iteration++) {
    const expansion = layoutExpansionForIteration(iteration);
    const width = baseWidth + expansion.centerGapPadding;
    const ctx = runWithLayoutExpansion(expansion, () =>
      buildLayoutRuleContextWithExpansion(graph, width, expansion, overrides),
    );
    lastWidth = width;
    lastExpansion = expansion;
    if (
      checkLayoutRule("EDGE-004", ctx).ok &&
      checkLayoutRule("EDGE-011", ctx).ok &&
      checkLayoutRule("EDGE-012", ctx).ok
    ) {
      return ctx;
    }
  }

  return runWithLayoutExpansion(lastExpansion, () =>
    buildLayoutRuleContextWithExpansion(graph, lastWidth, lastExpansion, overrides),
  );
}

function buildLayoutRuleContextWithExpansion(
  graph: ConnectionGraph,
  width: number,
  expansion: LayoutExpansion,
  overrides?: Pick<LayoutOverrides, "collapseFullButtSplices">,
): LayoutRuleContext {
  const { visualCables: ruleVisualCables } = buildVisualCablesForLayout(graph);
  const rowIndex = connectionRowIndexMap(graph, ruleVisualCables);
  const rulePlacement = computeCanvasPlacement(graph, ruleVisualCables, rowIndex);
  const layout = computeAlignedLayout(graph, ruleVisualCables, rulePlacement, width);
  const {
    nodes,
    edges,
    visualCables: routedVisualCables,
    placement: routedPlacement,
  } = buildReactFlowGraph(
    graph,
    overrides?.collapseFullButtSplices
      ? {
          reportKey: "layout-rules",
          positions: {},
          collapseFullButtSplices: true,
        }
      : undefined,
    width,
    { skipFeasibility: true, sharedVisualCables: ruleVisualCables },
  );
  return {
    graph,
    visualCables: routedVisualCables ?? ruleVisualCables,
    placement: routedPlacement ?? rulePlacement,
    layout,
    reactFlow: { nodes, edges },
    layoutWidth: width,
    layoutExpansion: expansion,
  };
}

/** Resolved import width + expansion after feasibility loop (EDGE-004/011/012). */
export function resolveFeasibleImportLayout(
  graph: ConnectionGraph,
  options?: {
    stageWidth?: number;
    layoutWidth?: number;
    collapseFullButtSplices?: boolean;
  },
): { layoutWidth: number; expansion: LayoutExpansion } {
  const ctx = buildLayoutRuleContext(
    graph,
    options?.layoutWidth,
    options?.collapseFullButtSplices
      ? { collapseFullButtSplices: true }
      : undefined,
    { stageWidth: options?.stageWidth },
  );
  return { layoutWidth: ctx.layoutWidth, expansion: ctx.layoutExpansion };
}

export function checkLayoutRule(
  id: LayoutRuleId,
  ctx: LayoutRuleContext,
): LayoutRuleResult {
  switch (id) {
    case "FBR-001":
      return {
        id,
        ok: fibersInTiaOrder(ctx.visualCables),
        detail: "Fibers not in TIA order within a buffer tube",
      };
    case "FBR-002":
      return {
        id,
        ok: compactTubeFiberLayoutOk(ctx.visualCables),
        detail: "Buffer tube fiber pitch is not 24px",
      };
    case "FBR-003":
      return {
        id,
        ok: cableFiberTopToBottomOk(ctx.visualCables),
        detail: "rowYOffset does not increase top-to-bottom",
      };
    case "FBR-004":
      return {
        id,
        ok: multiTubeDistinctOffsets(ctx.visualCables),
        detail: "Multi-tube cable has duplicate rowYOffset values",
      };
    case "TUB-001":
    case "TUB-002":
    case "TUB-003": {
      const geo = tubeGeometryOk(ctx.visualCables, ctx.placement);
      return { id, ok: geo.ok, detail: geo.detail };
    }
    case "TUB-004":
      return {
        id,
        ok: tubeReachIncreases(ctx.visualCables),
        detail: "Multi-tube cable does not extend tube reach",
      };
    case "TUB-005":
      return {
        id,
        ok: rightSideMirrors(ctx.visualCables),
        detail: "Right-side breakout is not mirrored",
      };
    case "TUB-006":
      return {
        id,
        ok: tubesInTiaOrderOk(ctx.visualCables),
        detail: "Buffer tubes are not in TIA color order",
      };
    case "TUB-007":
      return {
        id,
        ok: sameSideFiberStemColumnsAligned(ctx),
        detail: "Same-side cable stem columns are not vertically aligned",
      };
    case "TUB-008":
      return {
        id,
        ok: crossSideTubePairsAligned(
          ctx.graph,
          visualCablesFromReactFlowNodes(ctx.reactFlow.nodes),
          cablePositionsFromReactFlowNodes(ctx.reactFlow.nodes),
          tubeShiftOptionsFromReactFlowNodes(ctx.reactFlow.nodes),
        ),
        detail: "Cross-side buffer tube handles are not horizontally aligned",
      };
    case "CBL-001":
      return {
        id,
        ok: sameSideNoOverlap(ctx),
        detail: "Same-side cable nodes overlap vertically",
      };
    case "CBL-002":
      return {
        id,
        ok: sameSideStackGap(ctx),
        detail: "Stacked cables have less than cableGap spacing",
      };
    case "CBL-003": {
      const multi = ctx.visualCables.find((v) => v.tubes.length > 1);
      if (!multi) return { id, ok: true };
      const side = sideOf(multi, ctx.placement);
      const pos = ctx.layout.cablePositions.get(multi.id)!;
      const bounds = computeCableXBounds(
        ctx.visualCables,
        ctx.placement,
        ctx.layout.layoutWidth,
      );
      const expectedX = cableXForSide(side, multi.tubes.length, bounds);
      return {
        id,
        ok: Math.abs(pos.x - expectedX) < 1,
        detail: "Multi-tube cable X does not match tubeCount offset",
      };
    }


    case "ROW-001": {
      const steps = globalRowStepsOk(ctx);
      return {
        id,
        ok: steps.withinTube,
        detail: "Global row layout missing FIBER_ROW_PITCH steps",
      };
    }
    case "ROW-002": {
      const multiTube = ctx.visualCables.some((v) => v.tubes.length > 1);
      if (!multiTube) return { id, ok: true };
      const steps = globalRowStepsOk(ctx);
      return {
        id,
        ok: steps.tubeBoundary,
        detail: "Global row layout missing TUBE_GROUP_GAP at tube boundaries",
      };
    }






    case "EDGE-004":
      return {
        id,
        ok: splicePathsWithinBendLimit(ctx),
        detail: "Splice path exceeds two orthogonal bends handle-to-handle",
      };

    case "EDGE-006":
      return {
        id,
        ok: spliceRoutesMinimizeBends(ctx),
        detail: "Splice route template is not the minimum-bend choice",
      };

    case "EDGE-008":
      return {
        id,
        ok: centerLanesKeepMinSpacing(ctx),
        detail: "Center vertical splice lanes are closer than minimum fiber line spacing",
      };


    case "EDGE-011":
      return {
        id,
        ok: splicePathsDoNotOverlap(ctx),
        detail:
          findSpliceOverlapPair(ctx) ??
          "Splice strand segments stack on the same horizontal or vertical track",
      };
    case "EDGE-012":
      return {
        id,
        ok: verticalCenterLegsSpaced(ctx),
        detail: "Overlapping vertical center legs share the same midX lane",
      };
    case "EDGE-013":
      return {
        id,
        ok:
          maxNearStraightResidual(
            ctx.visualCables,
            ctx.placement,
            ctx.layout.cablePositions,
            ctx.layout.alignmentLocked,
          ) <= 0.5,
        detail:
          "A near-straight leg could still be snapped flat (alignment not at fixpoint)",
      };
    case "DOT-001":
      return {
        id,
        ok: fusionDotsOnHorizontalSegments(ctx),
        detail: "Fusion splice dot is not on a horizontal path segment",
      };
    case "DOT-002":
      return {
        id,
        ok: bufferTubeDotsStackVertically(ctx),
        detail:
          findBufferTubeDotViolation(ctx) ??
          "Source buffer tube fusion dots do not share one column X or 24px vertical pitch",
      };
    case "DOT-003":
      return {
        id,
        ok: fusionDotsCornerClearanceOk(ctx),
        detail: "Fusion splice dot is too close to a leg corner or not on a horizontal segment",
      };
    case "DOT-004":
      return {
        id,
        ok: fusionDotsVerticalLaneClearanceOk(ctx),
        detail:
          "A vertical leg lane runs through or within 48px of a fusion splice dot row",
      };
    case "STR-001":
      return {
        id,
        ok: strandFansTowardCenter(ctx),
        detail: "Fiber strand fans away from canvas center",
      };
    default:
      return { id, ok: false, detail: "Unknown rule" };
  }
}

export function checkAllLayoutRules(ctx: LayoutRuleContext): LayoutRuleResult[] {
  return LAYOUT_RULE_IDS.map((id) => checkLayoutRule(id, ctx));
}

export function layoutRulesOk(ctx: LayoutRuleContext): boolean {
  return checkAllLayoutRules(ctx).every((r) => r.ok);
}

/** SDC-LAYOUT-001 spacing checks (direct evaluators — not via checkLayoutRule). */
export function evaluateSdcLayoutSpacingRules(
  ctx: LayoutRuleContext,
): LayoutRuleResult[] {
  const rowSteps = globalRowStepsOk(ctx);
  const multiTube = ctx.visualCables.some((v) => v.tubes.length > 1);
  return [
    {
      id: "CBL-001",
      ok: sameSideNoOverlap(ctx),
      detail: "Same-side cable nodes overlap vertically",
    },
    {
      id: "CBL-002",
      ok: sameSideStackGap(ctx),
      detail: "Stacked cables have less than cableGap spacing",
    },
    {
      id: "FBR-002",
      ok: compactTubeFiberLayoutOk(ctx.visualCables),
      detail: "Buffer tube fiber pitch is not 24px",
    },
    {
      id: "ROW-001",
      ok: rowSteps.withinTube,
      detail: "Global row layout missing FIBER_ROW_PITCH steps",
    },
    {
      id: "ROW-002",
      ok: !multiTube || rowSteps.tubeBoundary,
      detail: "Global row layout missing TUBE_GROUP_GAP at tube boundaries",
    },
  ];
}

/** SDC-LAYOUT-002 fan-out geometry checks (direct evaluators). */
export function evaluateSdcLayoutFanoutRules(
  ctx: LayoutRuleContext,
): LayoutRuleResult[] {
  const geo = tubeGeometryOk(ctx.visualCables, ctx.placement);
  return [
    { id: "TUB-001", ok: geo.ok, detail: geo.detail },
    { id: "TUB-002", ok: geo.ok, detail: geo.detail },
    {
      id: "TUB-005",
      ok: rightSideMirrors(ctx.visualCables),
      detail: "Right-side breakout is not mirrored",
    },
    {
      id: "TUB-007",
      ok: sameSideFiberStemColumnsAligned(ctx),
      detail: "Same-side cable stem columns are not vertically aligned",
    },
    {
      id: "STR-001",
      ok: strandFansTowardCenter(ctx),
      detail: "Fiber strand fans away from canvas center",
    },
  ];
}

/** SDC-ROUTE-002 nesting checks (direct evaluators). */
export function evaluateSdcRouteNestingRules(
  _ctx: LayoutRuleContext,
): LayoutRuleResult[] {
  return [];
}

/** SDC-ROUTE-002 when grid lanes are attached — uses snapped midX from grid router. */
export function evaluateSdcRouteNestingRulesForGrid(
  _ctx: LayoutRuleContext,
): LayoutRuleResult[] {
  return [];
}

/** SDC-ROUTE-003 collision checks when grid routes are unavailable. */
export function evaluateSdcRouteCollisionRules(
  ctx: LayoutRuleContext,
): LayoutRuleResult[] {
  return [
    {
      id: "EDGE-011",
      ok: splicePathsDoNotOverlap(ctx),
      detail:
        findSpliceOverlapPair(ctx) ??
        "Splice strand segments stack on the same horizontal or vertical track",
    },
    {
      id: "EDGE-012",
      ok: verticalCenterLegsSpaced(ctx),
      detail: "Overlapping vertical center legs share the same midX lane",
    },
  ];
}

/** Sheath aspect ratio check exported for unit reuse. */
export function sheathAspectOk(scale: number, tubeCount: number): boolean {
  const size = computeSheathSize(scale, tubeCount);
  return Math.abs(size.width / size.height - SHEATH_ASPECT) < 0.01;
}
