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
  fiberRowOffsetInCable,
  MIN_SPLICE_HORIZONTAL_INSET,
  SPLICE_LANE_SEP,
  TUBE_GROUP_GAP,
} from "@/features/diagram/cableLayoutMetrics";
import { computeCanvasPlacement } from "@/features/diagram/canvasPlacement";
import { connectionRowIndexMap, connectionRowOffsets } from "@/features/diagram/connectionRowOrder";
import {
  connectionInDominantPair,
  findDominantCablePair,
  parentVisualGroupKey,
  type DominantCablePair,
} from "@/features/diagram/dominantCablePair";
import {
  computeAlignedLayout,
  computeCableXBounds,
  type AlignedDiagramLayout,
} from "@/features/diagram/spliceRowLayout";
import { computeSideCircuitLabelSpans, formattedCircuitTagWidth } from "@/features/diagram/cableLabels";
import { importLayoutWidthForGraph } from "@/features/diagram/layoutSpliceDiagram";
import {
  cableFiberTopToBottomOk,
  compactTubeFiberLayoutOk,
  tubesInTiaOrderOk,
} from "@/features/diagram/tubeFiberLayout";
import {
  buildVisualCables,
  buildVisualCablesForLayout,
  endpointOnVisualSide,
  type VisualCable,
} from "@/features/diagram/visualCables";
import type { ConnectionGraph, FiberConnection, LayoutOverrides, TubeColorCode } from "@/types/splice";
import type { CablePlacement } from "@/features/diagram/canvasPlacement";
import {
  assignSpliceMidXLanes,
  assignSpliceRoutingLanes,
  buildButtSplicePath,
  buildSplicePath,
  fiberHandlePosition,
  hvDemarcatedPathsCross,
  horizontalInsetOkFromHandle,
  MAX_SPLICE_BENDS,
  maxSpliceBendsForLane,
  parseButtTubeEndpointsFromEdgeId,
  parseTubeHandleId,
  routingLaneFromData,
  tubeHandlePosition,
  type MidXLaneCandidate,
  parallelSpliceSegmentsOverlap,
  pickSpliceRouteTemplate,
  resolveSpliceMidX,
  isNestedHandleRowHorizOverlap,
  isSharedSpliceRowLeadInOverlap,
  spliceMidOrderInverts,
  splicePathsAvoidHandleColumnVertical,
  spliceRouteSegments,
  type SpliceRoutingLane,
  type SpliceRoutingLaneData,
  SPLICE_PATH_EPS,
  spliceRoutingZoneKey,
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

/** Stable rule IDs — must match docs/agent/LAYOUT_RULES.md */
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
  "CBL-004",
  "CBL-005",
  "ROW-001",
  "ROW-002",
  "ROW-003",
  "DOM-001",
  "DOM-002",
  "DOM-003",
  "DOM-004",
  "EDGE-001",
  "EDGE-004",
  "EDGE-005",
  "EDGE-006",
  "EDGE-007",
  "EDGE-008",
  "EDGE-009",
  "EDGE-010",
  "EDGE-011",
  "EDGE-012",
  "STR-001",
] as const;

export type LayoutRuleId = (typeof LAYOUT_RULE_IDS)[number];

export type LayoutRuleMeta = {
  id: LayoutRuleId;
  title: string;
  category: "fiber" | "tube" | "cable" | "row" | "dominant" | "edge" | "strand";
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
  {
    id: "TUB-007",
    title: "Same-side cables align fiber label columns at shared stem X",
    category: "tube",
  },
  {
    id: "TUB-008",
    title: "Cross-side tube pairs align tube handle Y after dynamic shift",
    category: "tube",
  },
  { id: "CBL-001", title: "Same-side cables do not overlap", category: "cable" },
  { id: "CBL-002", title: "Same-side cables stack with at least cableGap", category: "cable" },
  { id: "CBL-003", title: "Multi-tube cables offset X from center", category: "cable" },
  { id: "CBL-004", title: "Dominant-pair splices align straight across", category: "cable" },
  { id: "CBL-005", title: "Ring-cut 144 splits into two visual instances", category: "cable" },
  { id: "ROW-001", title: "Equal pitch within buffer tube in global rows", category: "row" },
  { id: "ROW-002", title: "Extra gap at buffer-tube boundaries", category: "row" },
  { id: "ROW-003", title: "Extra gap at ring-cut split boundaries", category: "row" },
  { id: "DOM-001", title: "Dominant pair has most splice rows", category: "dominant" },
  { id: "DOM-002", title: "Dominant pair rows precede other rows", category: "dominant" },
  { id: "DOM-003", title: "Dominant pair fibers align horizontally", category: "dominant" },
  { id: "DOM-004", title: "High-count pairs (4+ rows) align straight across", category: "dominant" },
  { id: "EDGE-001", title: "Distinct routing lane per splice edge on import", category: "edge" },
  {
    id: "EDGE-004",
    title: "Splice path uses at most two orthogonal bends handle-to-handle",
    category: "edge",
  },
  {
    id: "EDGE-005",
    title: "Center lanes preserve buffer-tube row-offset grouping",
    category: "edge",
  },
  {
    id: "EDGE-006",
    title: "Route template minimizes bends among grouping-preserving paths",
    category: "edge",
  },
  {
    id: "EDGE-007",
    title: "Nested center bends avoid horizontal-vertical strand crossings",
    category: "edge",
  },
  {
    id: "EDGE-008",
    title: "Center vertical lanes keep minimum fiber line spacing",
    category: "edge",
  },
  {
    id: "EDGE-009",
    title: "Splice paths run horizontally toward center before vertical legs",
    category: "edge",
  },
  {
    id: "EDGE-010",
    title: "Same buffer-tube fibers to one target cable share spaced center lanes",
    category: "edge",
  },
  {
    id: "EDGE-011",
    title: "Splice strand segments never stack on the same horizontal or vertical track",
    category: "edge",
  },
  {
    id: "EDGE-012",
    title: "Overlapping vertical center legs use distinct midX lanes",
    category: "edge",
  },
  { id: "STR-001", title: "Fiber strands fan toward canvas center", category: "strand" },
];

export type LayoutRuleContext = {
  graph: ConnectionGraph;
  visualCables: VisualCable[];
  dominant: DominantCablePair | null;
  placement: Map<string, CablePlacement>;
  layout: AlignedDiagramLayout;
  reactFlow: { nodes: Node[]; edges: Edge[] };
  layoutWidth: number;
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

function spliceEndpointsAligned(
  ctx: LayoutRuleContext,
  connectionFilter: (conn: FiberConnection) => boolean,
): boolean {
  for (const conn of ctx.graph.connections) {
    if (conn.kind !== "fiber" || !connectionFilter(conn)) continue;

    const sides: number[] = [];
    for (const side of ["left", "right"] as const) {
      const ep = endpointOnVisualSide(
        conn,
        ctx.graph,
        ctx.visualCables,
        side,
      );
      if (!ep) continue;
      const pos = ctx.layout.cablePositions.get(ep.visualCableId);
      if (!pos) continue;
      const vc = ctx.visualCables.find((v) => v.id === ep.visualCableId);
      if (!vc) continue;
      sides.push(pos.y + fiberRowOffsetInCable(vc, conn.id));
    }

    if (sides.length === 2 && Math.abs(sides[0]! - sides[1]!) > Y_TOLERANCE) {
      return false;
    }
  }
  return true;
}

function highCountPairRowAlignment(ctx: LayoutRuleContext): boolean {
  const counts = new Map<string, number>();
  for (const conn of ctx.graph.connections) {
    if (conn.kind !== "fiber") continue;
    const left = endpointOnVisualSide(conn, ctx.graph, ctx.visualCables, "left");
    const right = endpointOnVisualSide(conn, ctx.graph, ctx.visualCables, "right");
    if (!left || !right) continue;
    const key = `${left.visualCableId}\0${right.visualCableId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const highCountKeys = new Set(
    [...counts.entries()]
      .filter(([, n]) => n >= 4)
      .map(([k]) => k),
  );
  if (highCountKeys.size === 0) return true;
  return spliceEndpointsAligned(ctx, (conn) => {
    const left = endpointOnVisualSide(conn, ctx.graph, ctx.visualCables, "left");
    const right = endpointOnVisualSide(conn, ctx.graph, ctx.visualCables, "right");
    if (!left || !right) return false;
    return highCountKeys.has(`${left.visualCableId}\0${right.visualCableId}`);
  });
}

function fiberHandleRowAlignment(ctx: LayoutRuleContext): boolean {
  if (!ctx.dominant) return true;
  return spliceEndpointsAligned(ctx, (conn) =>
    connectionInDominantPair(conn, ctx.graph, ctx.visualCables, ctx.dominant!),
  );
}

function globalRowStepsOk(ctx: LayoutRuleContext): {
  withinTube: boolean;
  tubeBoundary: boolean;
  splitGap: boolean;
} {
  const offsets = connectionRowOffsets(ctx.graph, ctx.visualCables, ctx.dominant);
  const values = [...offsets.values()].sort((a, b) => a - b);
  const steps = values.slice(1).map((y, i) => y - values[i]!);

  const withinTube = steps.some((s) => s === FIBER_ROW_PITCH) || values.length <= 1;
  const tubeBoundary =
    steps.some((s) => s === FIBER_ROW_PITCH + TUBE_GROUP_GAP) || values.length <= 1;
  const splitGap =
    steps.some((s) => s > FIBER_ROW_PITCH + TUBE_GROUP_GAP) ||
    steps.some((s) => s >= FIBER_ROW_PITCH * 2) ||
    values.length <= 1;

  return { withinTube, tubeBoundary, splitGap };
}

function dominantPairOk(ctx: LayoutRuleContext): boolean {
  if (!ctx.dominant) return true;

  const pass1 = buildVisualCables(ctx.graph);
  const recomputed = findDominantCablePair(ctx.graph, pass1);
  if (!recomputed || recomputed.connectionCount !== ctx.dominant.connectionCount) {
    return false;
  }

  const rowIdx = connectionRowIndexMap(ctx.graph, ctx.visualCables, ctx.dominant);
  const dominantRows = ctx.graph.connections
    .filter(
      (c) =>
        c.kind === "fiber" &&
        connectionInDominantPair(c, ctx.graph, ctx.visualCables, ctx.dominant!),
    )
    .map((c) => rowIdx.get(c.id)!);
  const otherRows = ctx.graph.connections
    .filter(
      (c) =>
        c.kind === "fiber" &&
        !connectionInDominantPair(c, ctx.graph, ctx.visualCables, ctx.dominant!),
    )
    .map((c) => rowIdx.get(c.id)!);

  if (dominantRows.length === 0 || otherRows.length === 0) return true;
  if (Math.max(...dominantRows) >= Math.min(...otherRows)) return false;

  const left = ctx.visualCables.find(
    (v) => parentVisualGroupKey(v.id) === ctx.dominant!.leftGroupKey,
  );
  const right = ctx.visualCables.find(
    (v) => parentVisualGroupKey(v.id) === ctx.dominant!.rightGroupKey,
  );
  if (!left || !right) return true;

  for (const conn of ctx.graph.connections.filter((c) => c.kind === "fiber")) {
    const lf = left.tubes.flatMap((t) => t.fibers).find((f) => f.connectionId === conn.id);
    const rf = right.tubes.flatMap((t) => t.fibers).find((f) => f.connectionId === conn.id);
    if (!lf || !rf) continue;
    const leftY =
      ctx.layout.cablePositions.get(left.id)!.y +
      fiberRowOffsetInCable(left, lf.connectionId);
    const rightY =
      ctx.layout.cablePositions.get(right.id)!.y +
      fiberRowOffsetInCable(right, rf.connectionId);
    if (Math.abs(leftY - rightY) > Y_TOLERANCE) return false;
  }

  return true;
}

function distinctEdgeLanes(edges: Edge[]): boolean {
  const spliceEdges = edges.filter((e) => e.type === "splice");
  if (spliceEdges.length === 0) return true;
  const lanes = spliceEdges.map((e) => (e.data as { laneIndex?: number }).laneIndex);
  return new Set(lanes).size === spliceEdges.length;
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

  const leftScale =
    (leftNode.data as { diagramScale?: number }).diagramScale ?? 1;
  const rightScale =
    (rightNode.data as { diagramScale?: number }).diagramScale ?? 1;
  const leftAligned = (leftNode.data as { alignedStemX?: number }).alignedStemX;
  const rightAligned = (rightNode.data as {
    alignedStemX?: number;
  }).alignedStemX;
  const leftHandle = fiberHandlePosition(
    leftVc,
    conn.id,
    leftNode.position,
    leftScale,
    leftAligned,
  );
  const rightHandle = fiberHandlePosition(
    rightVc,
    conn.id,
    rightNode.position,
    rightScale,
    rightAligned,
  );

  let sourceHandle = leftHandle;
  let targetHandle = rightHandle;
  let sourceVc = leftVc;
  let targetVc = rightVc;
  if (
    csvLeft.canvasSide === "right" &&
    csvRight.canvasSide === "left"
  ) {
    sourceHandle = rightHandle;
    targetHandle = leftHandle;
    sourceVc = rightVc;
    targetVc = leftVc;
  }

  const edge = ctx.reactFlow.edges.find((e) => e.id === `splice-${conn.id}`);
  const rowOffset = (edge?.data as { rowOffset?: number })?.rowOffset ?? 0;
  const sourceFiber = sourceVc.tubes
    .flatMap((tube) => tube.fibers)
    .find((fiber) => fiber.connectionId === conn.id);
  const targetFiber = targetVc.tubes
    .flatMap((tube) => tube.fibers)
    .find((fiber) => fiber.connectionId === conn.id);

  return {
    sourceX: sourceHandle.x,
    sourceY: sourceHandle.y,
    targetX: targetHandle.x,
    targetY: targetHandle.y,
    rowOffset,
    sourceTagWidth: formattedCircuitTagWidth(sourceFiber?.circuitName),
    targetTagWidth: formattedCircuitTagWidth(targetFiber?.circuitName),
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

    const edge = ctx.reactFlow.edges.find((e) => e.id === `splice-${conn.id}`);
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

function buildPackedRoutingMap(ctx: LayoutRuleContext): Map<string, SpliceRoutingLane> {
  return assignSpliceRoutingLanes(
    buildMidXLaneCandidates(ctx),
    sideCircuitSpanFromCtx(ctx),
  );
}

function buildPackedMidXMap(ctx: LayoutRuleContext): Map<string, number> {
  const packed = buildPackedRoutingMap(ctx);
  const result = new Map<string, number>();
  for (const [id, lane] of packed) {
    result.set(id, lane.midX);
  }
  return result;
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
    ctx.dominant,
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

function resolveCtxSpliceMidX(
  ctx: LayoutRuleContext,
  connId: string,
  endpoints: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    rowOffset: number;
  },
  packed: Map<string, number>,
): number {
  const packedMidX = packed.get(connId);
  if (packedMidX !== undefined) return packedMidX;

  const rowOffsets = connectionRowOffsets(
    ctx.graph,
    ctx.visualCables,
    ctx.dominant,
  );
  const maxRowOffset = Math.max(0, ...rowOffsets.values());
  const { sourceX, sourceY, targetX, targetY, rowOffset } = endpoints;
  return resolveSpliceMidX(sourceX, sourceY, targetX, targetY, {
    rowOffset,
    maxRowOffset,
    diagramCenterX: ctx.layoutWidth / 2,
    sideCircuitSpan: sideCircuitSpanFromCtx(ctx),
  });
}

function splicePathsWithinBendLimit(ctx: LayoutRuleContext): boolean {
  const packed = buildPackedRoutingMap(ctx);
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

function centerLanesPreserveTubeGrouping(ctx: LayoutRuleContext): boolean {
  const packed = buildPackedMidXMap(ctx);
  type LaneEntry = {
    rowOffset: number;
    midX: number;
    inverts: boolean;
    tubeBundleKey?: string;
    zoneKey: string;
  };
  const lanes: LaneEntry[] = [];

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

    const edge = ctx.reactFlow.edges.find((e) => e.id === `splice-${conn.id}`);
    const tubeBundleKey = (edge?.data as { tubeBundleKey?: string })
      ?.tubeBundleKey;

    lanes.push({
      rowOffset,
      midX: resolveCtxSpliceMidX(ctx, conn.id, endpoints, packed),
      inverts: spliceMidOrderInverts(sourceX, sourceY, targetX, targetY),
      tubeBundleKey,
      zoneKey: spliceRoutingZoneKey(sourceX, targetX),
    });
  }

  const byBundle = new Map<string, LaneEntry[]>();
  const unbundled: LaneEntry[] = [];
  for (const lane of lanes) {
    if (lane.tubeBundleKey) {
      const key = `${lane.zoneKey}::${lane.tubeBundleKey}`;
      const list = byBundle.get(key) ?? [];
      list.push(lane);
      byBundle.set(key, list);
    } else {
      unbundled.push(lane);
    }
  }

  for (const bundle of byBundle.values()) {
    if (bundle.length <= 1) continue;
    bundle.sort((a, b) => a.rowOffset - b.rowOffset);
    for (let i = 1; i < bundle.length; i++) {
      const prev = bundle[i - 1]!;
      const curr = bundle[i]!;
      if (prev.inverts !== curr.inverts) continue;
      if (prev.inverts) {
        if (curr.midX > prev.midX + Y_TOLERANCE) return false;
      } else if (curr.midX < prev.midX - Y_TOLERANCE) {
        return false;
      }
    }
  }

  const byZone = new Map<string, LaneEntry[]>();
  for (const lane of unbundled) {
    const list = byZone.get(lane.zoneKey) ?? [];
    list.push(lane);
    byZone.set(lane.zoneKey, list);
  }

  for (const group of byZone.values()) {
    group.sort((a, b) => a.rowOffset - b.rowOffset);
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1]!;
      const curr = group[i]!;
      if (prev.inverts !== curr.inverts) continue;
      if (prev.inverts) {
        if (curr.midX > prev.midX + Y_TOLERANCE) return false;
      } else if (curr.midX < prev.midX - Y_TOLERANCE) {
        return false;
      }
    }
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

function tubeBundleRoutesAreSpaced(ctx: LayoutRuleContext): boolean {
  const packed = buildPackedRoutingMap(ctx);
  const byBundle = new Map<string, Array<{ midX: number; jogX?: number }>>();

  for (const conn of orderedFiberConnections(ctx.graph)) {
    if (conn.kind !== "fiber") continue;
    const edge = ctx.reactFlow.edges.find((e) => e.id === `splice-${conn.id}`);
    const tubeBundleKey = (edge?.data as { tubeBundleKey?: string })
      ?.tubeBundleKey;
    if (!tubeBundleKey) continue;

    const endpoints = spliceHandleEndpoints(ctx, conn);
    if (!endpoints) continue;
    const { sourceX, sourceY, targetX, targetY } = endpoints;
    if (
      !templateUsesMidXLanes(
        pickSpliceRouteTemplate(sourceX, sourceY, targetX, targetY),
      )
    ) {
      continue;
    }

    const lane = resolveCtxSpliceRouting(ctx, conn.id, endpoints, packed);
    const zoneKey = spliceRoutingZoneKey(sourceX, targetX);
    const key = `${zoneKey}::${tubeBundleKey}`;
    const list = byBundle.get(key) ?? [];
    list.push({ midX: lane.midX, jogX: lane.jogX });
    byBundle.set(key, list);
  }

  for (const members of byBundle.values()) {
    if (members.length <= 1) continue;
    const sorted = [...members].sort((a, b) => a.midX - b.midX);
    for (let i = 1; i < sorted.length; i++) {
      if (
        sorted[i]!.midX - sorted[i - 1]!.midX <
        SPLICE_LANE_SEP - SPLICE_PATH_EPS
      ) {
        return false;
      }
    }
    const jogValues = [
      ...new Set(
        members
          .map((member) => member.jogX)
          .filter((jogX): jogX is number => jogX !== undefined)
          .map((jogX) => Math.round(jogX)),
      ),
    ];
    if (jogValues.length > 1) return false;
  }

  return true;
}

function verticalCenterLegsSpaced(ctx: LayoutRuleContext): boolean {
  const packed = buildPackedRoutingMap(ctx);
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
  const packed = buildPackedRoutingMap(ctx);
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

    const edge = ctx.reactFlow.edges.find((e) => e.id === `splice-${conn.id}`);
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

function spliceCenterPathsDoNotCross(ctx: LayoutRuleContext): boolean {
  const packed = buildPackedRoutingMap(ctx);
  const routed: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    midX: number;
    jogX?: number;
    sourceHorizY?: number;
    targetHorizY?: number;
    inverts: boolean;
    tubeBundleKey?: string;
  }[] = [];

  for (const conn of orderedFiberConnections(ctx.graph)) {
    if (conn.kind !== "fiber") continue;
    const endpoints = spliceHandleEndpoints(ctx, conn);
    if (!endpoints) continue;

    const { sourceX, sourceY, targetX, targetY } = endpoints;
    if (
      !templateUsesMidXLanes(
        pickSpliceRouteTemplate(sourceX, sourceY, targetX, targetY),
      )
    ) {
      continue;
    }
    const edge = ctx.reactFlow.edges.find((e) => e.id === `splice-${conn.id}`);
    const tubeBundleKey = (edge?.data as { tubeBundleKey?: string })
      ?.tubeBundleKey;
    const lane = resolveCtxSpliceRouting(ctx, conn.id, endpoints, packed);
    routed.push({
      sourceX,
      sourceY,
      targetX,
      targetY,
      midX: lane.midX,
      jogX: lane.jogX,
      sourceHorizY: lane.sourceHorizY,
      targetHorizY: lane.targetHorizY,
      inverts: spliceMidOrderInverts(sourceX, sourceY, targetX, targetY),
      tubeBundleKey,
    });
  }

  for (let i = 0; i < routed.length; i++) {
    for (let j = i + 1; j < routed.length; j++) {
      const a = routed[i]!;
      const b = routed[j]!;
      if (a.inverts !== b.inverts) continue;
      if (a.tubeBundleKey && a.tubeBundleKey === b.tubeBundleKey) continue;
      if (
        Math.abs(a.sourceX - b.sourceX) > Y_TOLERANCE * 8 ||
        Math.abs(a.targetX - b.targetX) > Y_TOLERANCE * 8
      ) {
        continue;
      }
      if (
        hvDemarcatedPathsCross(
          a.sourceX,
          a.sourceY,
          a.targetX,
          a.targetY,
          a.midX,
          b.sourceX,
          b.sourceY,
          b.targetX,
          b.targetY,
          b.midX,
          a.jogX,
          b.jogX,
          { sourceHorizY: a.sourceHorizY, targetHorizY: a.targetHorizY },
          { sourceHorizY: b.sourceHorizY, targetHorizY: b.targetHorizY },
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

function sameSideSplicesDetourTowardCenter(ctx: LayoutRuleContext): boolean {
  const packed = buildPackedRoutingMap(ctx);
  const centerX = ctx.layoutWidth / 2;
  const sideSpans = sideCircuitSpanFromCtx(ctx);

  for (const conn of orderedFiberConnections(ctx.graph)) {
    if (conn.kind !== "fiber") continue;
    const endpoints = spliceHandleEndpoints(ctx, conn);
    if (!endpoints) continue;

    const { sourceX, sourceY, targetX, targetY, sourceTagWidth, targetTagWidth } =
      endpoints;
    const template = pickSpliceRouteTemplate(
      sourceX,
      sourceY,
      targetX,
      targetY,
    );
    if (template === "straight") continue;

    const lane = resolveCtxSpliceRouting(ctx, conn.id, endpoints, packed);
    const { midX, jogX, sourceHorizY, targetHorizY } = lane;
    if (
      !horizontalInsetOkFromHandle(
        midX,
        sourceX,
        centerX,
        sideSpans,
        MIN_SPLICE_HORIZONTAL_INSET,
        sourceTagWidth ?? 0,
        true,
      ) ||
      !horizontalInsetOkFromHandle(
        midX,
        targetX,
        centerX,
        sideSpans,
        MIN_SPLICE_HORIZONTAL_INSET,
        targetTagWidth ?? 0,
        true,
      )
    ) {
      return false;
    }

    if (
      !splicePathsAvoidHandleColumnVertical(
        sourceX,
        sourceY,
        targetX,
        targetY,
        midX,
        jogX,
        { sourceHorizY, targetHorizY },
        sideSpans,
        centerX,
        sourceTagWidth ?? 0,
        targetTagWidth ?? 0,
      )
    ) {
      return false;
    }

    if (template !== "same_side") continue;

    const columnX = (sourceX + targetX) / 2;
    const inward = columnX <= centerX ? 1 : -1;
    if (inward > 0 && midX <= columnX + SPLICE_PATH_EPS) return false;
    if (inward < 0 && midX >= columnX - SPLICE_PATH_EPS) return false;
  }
  return true;
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
): LayoutRuleContext {
  const width = layoutWidth ?? importLayoutWidthForGraph(graph);
  const { visualCables, dominant } = buildVisualCablesForLayout(graph);
  const rowIndex = connectionRowIndexMap(graph, visualCables, dominant);
  const placement = computeCanvasPlacement(graph, visualCables, dominant, rowIndex);
  const layout = computeAlignedLayout(graph, visualCables, placement, dominant, width);
  const { nodes, edges } = buildReactFlowGraph(
    graph,
    overrides?.collapseFullButtSplices
      ? {
          reportKey: "layout-rules",
          positions: {},
          collapseFullButtSplices: true,
        }
      : undefined,
    width,
  );
  return {
    graph,
    visualCables,
    dominant,
    placement,
    layout,
    reactFlow: { nodes, edges },
    layoutWidth: width,
  };
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
        detail: "Same-side cable fiber label columns are not vertically aligned",
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
    case "CBL-004":
      if (!ctx.dominant) return { id, ok: true };
      return {
        id,
        ok: fiberHandleRowAlignment(ctx),
        detail: "Dominant-pair splice handles are not horizontally aligned",
      };
    case "CBL-005": {
      const throughSide = ctx.visualCables.filter(
        (v) => /144|288/i.test(v.cable) && v.side === "right",
      );
      const needsSplit = ctx.graph.connections.filter((c) => c.kind === "fiber").length === 4;
      if (!needsSplit) return { id, ok: true };
      return {
        id,
        ok: throughSide.length === 2,
        detail: "Ring-cut 144 should produce two right-side visual cables",
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
    case "ROW-003": {
      const hasSplit = ctx.visualCables.some((vc) => /~\d+$/.test(vc.id));
      if (!hasSplit) return { id, ok: true };
      const steps = globalRowStepsOk(ctx);
      return {
        id,
        ok: steps.splitGap,
        detail: "Ring-cut split missing extra row gap",
      };
    }
    case "DOM-001":
    case "DOM-002":
    case "DOM-003":
      return {
        id,
        ok: dominantPairOk(ctx),
        detail: "Dominant cable pair layout invariant failed",
      };
    case "DOM-004":
      return {
        id,
        ok: highCountPairRowAlignment(ctx),
        detail: "High-count cable pair splice handles are not horizontally aligned",
      };
    case "EDGE-001":
      return {
        id,
        ok: distinctEdgeLanes(ctx.reactFlow.edges),
        detail: "Splice edges share routing lanes on import",
      };
    case "EDGE-004":
      return {
        id,
        ok: splicePathsWithinBendLimit(ctx),
        detail: "Splice path exceeds two orthogonal bends handle-to-handle",
      };
    case "EDGE-005":
      return {
        id,
        ok: centerLanesPreserveTubeGrouping(ctx),
        detail: "Center lane midX order breaks buffer-tube row-offset grouping",
      };
    case "EDGE-006":
      return {
        id,
        ok: spliceRoutesMinimizeBends(ctx),
        detail: "Splice route template is not the minimum-bend choice",
      };
    case "EDGE-007":
      return {
        id,
        ok: spliceCenterPathsDoNotCross(ctx),
        detail: "Splice center paths cross between horizontal and vertical legs",
      };
    case "EDGE-008":
      return {
        id,
        ok: centerLanesKeepMinSpacing(ctx),
        detail: "Center vertical splice lanes are closer than minimum fiber line spacing",
      };
    case "EDGE-009":
      return {
        id,
        ok: sameSideSplicesDetourTowardCenter(ctx),
        detail: "Splice paths do not run horizontally toward center before vertical legs",
      };
    case "EDGE-010":
      return {
        id,
        ok: tubeBundleRoutesAreSpaced(ctx),
        detail: "Tube bundle splice lanes overlap or lack shared horizontal trunk spacing",
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

/** Sheath aspect ratio check exported for unit reuse. */
export function sheathAspectOk(scale: number, tubeCount: number): boolean {
  const size = computeSheathSize(scale, tubeCount);
  return Math.abs(size.width / size.height - SHEATH_ASPECT) < 0.01;
}
