import { useEffect, useLayoutEffect, useReducer } from "react";

import {
  SPLICE_LANE_SEP,
  SPLICE_ROUTING_END_MARGIN,
  MIN_SPLICE_HORIZONTAL_INSET,
  MIN_HORIZONTAL_INSET_FLOOR,
  FIBER_CIRCUIT_MAX_WIDTH,
  SPLICE_HANDLE_OVERHANG,
  fiberRowPrefixWidth,
  CABLE_LAYOUT,
  FIBER_ROW_PITCH,
  fiberRowOffsetInCable,
} from "@/features/diagram/cableLayoutMetrics";
import {
  formattedCircuitTagWidth,
  spliceHandleOutsetFromStem,
  type SideCircuitLabelSpan,
} from "@/features/diagram/cableLabels";
import { computeCableBreakout } from "@/features/diagram/cableBreakoutGeometry";
import type { VisualCable } from "@/features/diagram/visualCables";
import type { CableLegId, TubeColorCode } from "@/types/splice";

export type SpliceEdgeRouteEntry = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  fallbackLane: number;
  /** Global row offset (px) — drives proportional center spacing with tube gaps. */
  rowOffset?: number;
  /** Same source tube + target cable — fibers share one center lane. */
  tubeBundleKey?: string;
};

/** Frozen routing persisted on edge data after import or cable drag. */
export type SpliceRoutingLaneData = {
  routingMidX: number;
  routingJogX?: number;
  routingSourceHorizY?: number;
  routingTargetHorizY?: number;
  routingSourceBendX?: number;
  routingTargetBendX?: number;
  /** Canvas center X used for inward-sign / EDGE-009 clearance. */
  diagramCenterX?: number;
};

export type SpliceHandleEntry = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  fallbackLane: number;
  rowOffset?: number;
  tubeBundleKey?: string;
  fullButtSplice?: boolean;
  sideCircuitSpan?: SideCircuitLabelSpan;
  sourceTagWidth?: number;
  targetTagWidth?: number;
};

export function buildSpliceHandleEntries(
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: unknown;
  }>,
  edges: Array<{
    id: string;
    source?: string | null;
    target?: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    type?: string | null;
    data?: unknown;
  }>,
  visualCables: VisualCable[],
  options?: { cableNodeId?: string },
): SpliceHandleEntry[] {
  const vcByNodeId = new Map<string, VisualCable>(
    visualCables.map((vc) => [`cable-${vc.id}`, vc]),
  );
  const entries: SpliceHandleEntry[] = [];

  for (const edge of edges) {
    if (edge.type !== "splice") continue;
    if (
      options?.cableNodeId &&
      edge.source !== options.cableNodeId &&
      edge.target !== options.cableNodeId
    ) {
      continue;
    }

    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    const sourceVc = edge.source ? vcByNodeId.get(edge.source) : undefined;
    const targetVc = edge.target ? vcByNodeId.get(edge.target) : undefined;
    if (!sourceNode || !targetNode || !sourceVc || !targetVc) continue;

    const edgeData = (edge.data ?? {}) as {
      rowOffset?: number;
      tubeBundleKey?: string;
      fullButtSplice?: boolean;
      laneIndex?: number;
      sideCircuitSpan?: SideCircuitLabelSpan;
      circuitName?: string;
    };
    const isButtEdge =
      edgeData.fullButtSplice === true || edge.id.startsWith("butt-");
    const connectionId = edge.id.replace(/^splice-/, "").replace(/^butt-/, "");
    const sourceFiber = sourceVc.tubes
      .flatMap((t) => t.fibers)
      .find((f) => f.connectionId === connectionId);
    const targetFiber = targetVc.tubes
      .flatMap((t) => t.fibers)
      .find((f) => f.connectionId === connectionId);
    const sourceScale = (sourceNode.data as { diagramScale?: number }).diagramScale ?? 1;
    const targetScale = (targetNode.data as { diagramScale?: number }).diagramScale ?? 1;
    const sourceAligned = (sourceNode.data as { alignedStemX?: number }).alignedStemX;
    const targetAligned = (targetNode.data as { alignedStemX?: number }).alignedStemX;

    let sourcePos: { x: number; y: number };
    let targetPos: { x: number; y: number };
    let sourceTagWidth = 0;
    let targetTagWidth = 0;

    if (isButtEdge) {
      const sourceTube =
        parseTubeHandleId(edge.sourceHandle) ??
        parseButtTubeEndpointsFromEdgeId(edge.id)?.endpointA;
      const targetTube =
        parseTubeHandleId(edge.targetHandle) ??
        parseButtTubeEndpointsFromEdgeId(edge.id)?.endpointB;
      if (!sourceTube || !targetTube) continue;
      sourcePos = tubeHandlePosition(
        sourceVc,
        sourceTube.tubeColor,
        sourceNode.position,
        sourceScale,
        sourceAligned,
      );
      targetPos = tubeHandlePosition(
        targetVc,
        targetTube.tubeColor,
        targetNode.position,
        targetScale,
        targetAligned,
      );
    } else {
      sourcePos = fiberHandlePosition(
        sourceVc,
        connectionId,
        sourceNode.position,
        sourceScale,
        sourceAligned,
        sourceFiber?.circuitName ?? edgeData.circuitName,
      );
      targetPos = fiberHandlePosition(
        targetVc,
        connectionId,
        targetNode.position,
        targetScale,
        targetAligned,
        targetFiber?.circuitName ?? edgeData.circuitName,
      );
      sourceTagWidth = formattedCircuitTagWidth(
        sourceFiber?.circuitName ?? edgeData.circuitName,
      );
      targetTagWidth = formattedCircuitTagWidth(
        targetFiber?.circuitName ?? edgeData.circuitName,
      );
    }

    entries.push({
      id: edge.id,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      sourceX: sourcePos.x,
      sourceY: sourcePos.y,
      targetX: targetPos.x,
      targetY: targetPos.y,
      fallbackLane: edgeData.laneIndex ?? 0,
      rowOffset: edgeData.rowOffset,
      tubeBundleKey: edgeData.tubeBundleKey,
      fullButtSplice: isButtEdge,
      sideCircuitSpan: edgeData.sideCircuitSpan,
      sourceTagWidth,
      targetTagWidth,
    });
  }

  return entries;
}


/** Rank 0 = highest (smallest row offset / sourceY) on the left cable. */

import {
  assignGapBendLaneXs,
  assignSideHorizLaneYs,
  assignSpliceRoutingLanes,
  assignSpliceRoutingLanesFromLiveHandles,
  globalDiagramCenterX,
  type MidXLaneCandidate,
} from "@/features/diagram/spliceCenterLanes";

export {
  assignCenterLanes,
  assignSpliceMidXLanes,
  assignSpliceRoutingLanes,
  assignSpliceRoutingLanesFromHandleEntries,
  assignSpliceRoutingLanesFromLiveHandles,
  bundleMidOrderInverts,
  globalDiagramCenterX,
  handleEntriesToCandidates,
  idealSpliceMidXFromRowOffset,
  normalizeVisualCableIdForRouting,
  packMidXLanes,
  recomputeRowOffsetsFromHandleYs,
  spliceRoutingZoneKey,
  spliceTubeBundleKey,
  type MidXLaneCandidate,
} from "@/features/diagram/spliceCenterLanes";

export function sortSpliceRouteEntries(
  entries: SpliceEdgeRouteEntry[],
): SpliceEdgeRouteEntry[] {
  return [...entries].sort(
    (a, b) =>
      (a.rowOffset ?? a.fallbackLane) - (b.rowOffset ?? b.fallbackLane) ||
      a.fallbackLane - b.fallbackLane ||
      a.sourceY - b.sourceY ||
      a.targetY - b.targetY ||
      a.id.localeCompare(b.id),
  );
}

export const SPLICE_PATH_EPS = 0.5;

/**
 * When the diagram-right endpoint sits below diagram-left, upper fibers bend
 * farther toward the target so horizontal legs do not cross vertical legs.
 * Works when either endpoint is dragged to the opposite screen side.
 */
export function spliceMidOrderInverts(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): boolean {
  const leftY = sourceX <= targetX ? sourceY : targetY;
  const rightY = sourceX <= targetX ? targetY : sourceY;
  return rightY > leftY + SPLICE_PATH_EPS;
}

export function effectiveRoutingLane(
  rank: number,
  laneCount: number,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): number {
  if (laneCount <= 1) return 0;
  if (spliceMidOrderInverts(sourceX, sourceY, targetX, targetY)) {
    return laneCount - 1 - rank;
  }
  return rank;
}

export function routingLaneFromEntries(
  entries: SpliceEdgeRouteEntry[],
  edgeId: string,
): number {
  const sorted = sortSpliceRouteEntries(entries);
  const laneCount = sorted.length;
  const rank = sorted.findIndex((e) => e.id === edgeId);
  if (rank < 0) return 0;
  const entry = sorted[rank]!;
  return effectiveRoutingLane(
    rank,
    laneCount,
    entry.sourceX,
    entry.sourceY,
    entry.targetX,
    entry.targetY,
  );
}

export type SpliceRouteTemplate =
  | "straight"
  | "same_side"
  | "hv_demarcated";

/** True when handle X is shared — same-side splices need an inward center detour. */
export function isSameColumnSplice(
  sourceX: number,
  targetX: number,
): boolean {
  return Math.abs(sourceX - targetX) <= SPLICE_PATH_EPS;
}

/** +1 = route toward increasing X; -1 = toward decreasing X. */
export function inwardSignForColumn(
  columnX: number,
  diagramCenterX: number,
): 1 | -1 {
  return columnX <= diagramCenterX ? 1 : -1;
}

export function templateUsesMidXLanes(template: SpliceRouteTemplate): boolean {
  return template === "hv_demarcated" || template === "same_side";
}

export function defaultSideCircuitLabelSpan(): SideCircuitLabelSpan {
  const prefix = fiberRowPrefixWidth();
  return { left: prefix, right: prefix };
}

export function canvasSideForHandle(
  handleX: number,
  diagramCenterX: number,
): "left" | "right" {
  return handleX <= diagramCenterX ? "left" : "right";
}

export function circuitLabelSpanForSide(
  side: "left" | "right",
  sideSpans: SideCircuitLabelSpan,
): number {
  return side === "left" ? sideSpans.left : sideSpans.right;
}

/** Full stem→outer-edge label column (swatch + code + max circuit tag). */
export function labelColumnRunForSide(
  side: "left" | "right",
  sideSpans: SideCircuitLabelSpan,
): number {
  return Math.max(
    circuitLabelSpanForSide(side, sideSpans),
    fiberRowPrefixWidth() + FIBER_CIRCUIT_MAX_WIDTH,
  );
}

/** Minimum horizontal run from handle: past full label column, then inward jog. */
export function minHorizontalRunFromHandle(
  handleX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
  jog = MIN_SPLICE_HORIZONTAL_INSET,
): number {
  const side = canvasSideForHandle(handleX, diagramCenterX);
  return labelColumnRunForSide(side, sideSpans) + jog;
}

/** Minimum midX that clears the side-wide OS label column before the vertical leg. */
export function minClearMidXForHandle(
  handleX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
  tagWidth = 0,
  jog = MIN_SPLICE_HORIZONTAL_INSET,
  handleAtLabelOuterEdge = false,
): number {
  const side = canvasSideForHandle(handleX, diagramCenterX);
  const prefix = fiberRowPrefixWidth();
  const columnRun = handleAtLabelOuterEdge
    ? labelColumnRunForSide(side, sideSpans)
    : circuitLabelSpanForSide(side, sideSpans);
  if (side === "left") {
    const columnClear = handleAtLabelOuterEdge
      ? handleX - prefix - tagWidth + columnRun + jog
      : handleX + columnRun + jog;
    return Math.max(handleX + jog, columnClear);
  }
  const columnClear = handleAtLabelOuterEdge
    ? handleX + prefix + tagWidth - columnRun - jog
    : handleX - columnRun - jog;
  return Math.min(handleX - jog, columnClear);
}

/** Feasible midX range: each handle clears the side-wide OS column + inward jog. */
export function spliceMidXInsetBounds(
  sourceX: number,
  targetX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
  jog = MIN_SPLICE_HORIZONTAL_INSET,
  sourceTagWidth = 0,
  targetTagWidth = 0,
  sourceAtLabelOuterEdge = false,
  targetAtLabelOuterEdge = false,
): { lo: number; hi: number } {
  let lo = Number.NEGATIVE_INFINITY;
  let hi = Number.POSITIVE_INFINITY;

  for (const [handleX, tagWidth, atLabelEdge] of [
    [sourceX, sourceTagWidth, sourceAtLabelOuterEdge] as const,
    [targetX, targetTagWidth, targetAtLabelOuterEdge] as const,
  ]) {
    const clear = minClearMidXForHandle(
      handleX,
      diagramCenterX,
      sideSpans,
      tagWidth,
      jog,
      atLabelEdge,
    );
    const side = canvasSideForHandle(handleX, diagramCenterX);
    if (side === "left") {
      lo = Math.max(lo, clear);
    } else {
      hi = Math.min(hi, clear);
    }
  }

  return { lo, hi };
}

export function sourceHorizontalLeg(midX: number, sourceX: number): number {
  return Math.abs(midX - sourceX);
}

export function targetHorizontalLeg(midX: number, targetX: number): number {
  return Math.abs(targetX - midX);
}

export function horizontalInsetOkFromHandle(
  midX: number,
  handleX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
  jog = MIN_SPLICE_HORIZONTAL_INSET,
  tagWidth = 0,
  handleAtLabelOuterEdge = false,
): boolean {
  const side = canvasSideForHandle(handleX, diagramCenterX);
  const clear = minClearMidXForHandle(
    handleX,
    diagramCenterX,
    sideSpans,
    tagWidth,
    jog,
    handleAtLabelOuterEdge,
  );
  if (side === "left") return midX >= clear - SPLICE_PATH_EPS;
  return midX <= clear + SPLICE_PATH_EPS;
}

/** Push midX toward center until both legs clear OS labels + inward jog. */
export function enforceMinHorizontalInset(
  midX: number,
  sourceX: number,
  targetX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  jog = MIN_SPLICE_HORIZONTAL_INSET,
  sourceTagWidth = 0,
  targetTagWidth = 0,
  sourceAtLabelOuterEdge = false,
  targetAtLabelOuterEdge = false,
): number {
  for (
    let attempt = jog;
    attempt >= MIN_HORIZONTAL_INSET_FLOOR;
    attempt -= 8
  ) {
    const { lo, hi } = spliceMidXInsetBounds(
      sourceX,
      targetX,
      diagramCenterX,
      sideSpans,
      attempt,
      sourceTagWidth,
      targetTagWidth,
      sourceAtLabelOuterEdge,
      targetAtLabelOuterEdge,
    );
    if (lo <= hi + SPLICE_PATH_EPS) {
      return Math.max(lo, Math.min(hi, midX));
    }
  }

  // EDGE-009 hard floor — never place the vertical leg over the OS/fan column.
  let x = midX;
  for (const [handleX, tagWidth, atLabelEdge] of [
    [sourceX, sourceTagWidth, sourceAtLabelOuterEdge] as const,
    [targetX, targetTagWidth, targetAtLabelOuterEdge] as const,
  ]) {
    const clear = minClearMidXForHandle(
      handleX,
      diagramCenterX,
      sideSpans,
      tagWidth,
      MIN_HORIZONTAL_INSET_FLOOR,
      atLabelEdge,
    );
    const side = canvasSideForHandle(handleX, diagramCenterX);
    if (side === "left") {
      x = Math.max(x, clear);
    } else {
      x = Math.min(x, clear);
    }
  }
  const routeBounds = spliceRoutingBounds(sourceX, targetX);
  if (routeBounds.lo <= routeBounds.hi + SPLICE_PATH_EPS) {
    return Math.max(routeBounds.lo, Math.min(routeBounds.hi, x));
  }
  // Same-column stems: routing margin band is empty — keep OS clearance.
  return x;
}

/** @deprecated alias — use enforceMinHorizontalInset */
export function clampMidXForMinHorizontalInset(
  midX: number,
  sourceX: number,
  targetX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  jog = MIN_SPLICE_HORIZONTAL_INSET,
  sourceTagWidth = 0,
  targetTagWidth = 0,
  sourceAtLabelOuterEdge = false,
  targetAtLabelOuterEdge = false,
): number {
  return enforceMinHorizontalInset(
    midX,
    sourceX,
    targetX,
    diagramCenterX,
    sideSpans,
    jog,
    sourceTagWidth,
    targetTagWidth,
    sourceAtLabelOuterEdge,
    targetAtLabelOuterEdge,
  );
}

/** Pick route shape from handle coordinates (handle → handle span). */
export function pickSpliceRouteTemplate(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): SpliceRouteTemplate {
  if (Math.abs(sourceY - targetY) <= SPLICE_PATH_EPS) return "straight";
  if (isSameColumnSplice(sourceX, targetX)) return "same_side";
  return "hv_demarcated";
}

export function parseOrthogonalPathPoints(
  path: string,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const re = /[ML]\s*([-\d.]+),([-\d.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(path)) !== null) {
    points.push({ x: Number(match[1]), y: Number(match[2]) });
  }
  return points;
}

/** Count 90° direction changes across one or more orthogonal path strings. */
export function countOrthogonalBends(...paths: string[]): number {
  const points: Array<{ x: number; y: number }> = [];
  for (const path of paths) {
    points.push(...parseOrthogonalPathPoints(path));
  }
  if (points.length < 3) return 0;

  let bends = 0;
  for (let i = 2; i < points.length; i++) {
    const prev = points[i - 2]!;
    const mid = points[i - 1]!;
    const curr = points[i]!;
    const dx1 = mid.x - prev.x;
    const dy1 = mid.y - prev.y;
    const dx2 = curr.x - mid.x;
    const dy2 = curr.y - mid.y;
    if (Math.abs(dx1) <= SPLICE_PATH_EPS && Math.abs(dy1) <= SPLICE_PATH_EPS) {
      continue;
    }
    if (Math.abs(dx2) <= SPLICE_PATH_EPS && Math.abs(dy2) <= SPLICE_PATH_EPS) {
      continue;
    }
    const horiz1 = Math.abs(dy1) <= SPLICE_PATH_EPS;
    const horiz2 = Math.abs(dy2) <= SPLICE_PATH_EPS;
    const vert1 = Math.abs(dx1) <= SPLICE_PATH_EPS;
    const vert2 = Math.abs(dx2) <= SPLICE_PATH_EPS;
    if ((horiz1 && vert2) || (vert1 && horiz2)) bends += 1;
  }
  return bends;
}

function inwardAnchorFromColumn(
  columnX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
  laneOffsetPx = 0,
): number {
  const inward = inwardSignForColumn(columnX, diagramCenterX);
  const side = canvasSideForHandle(columnX, diagramCenterX);
  const run =
    circuitLabelSpanForSide(side, sideSpans) +
    MIN_SPLICE_HORIZONTAL_INSET +
    laneOffsetPx;
  return columnX + inward * run;
}

export function resolveSpliceMidX(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  options: {
    rowOffset?: number;
    maxRowOffset?: number;
    routingLane?: number;
    laneCount?: number;
    diagramCenterX?: number;
    sideCircuitSpan?: SideCircuitLabelSpan;
  } = {},
): number {
  const sideSpans = options.sideCircuitSpan ?? defaultSideCircuitLabelSpan();
  const centerX = options.diagramCenterX ?? (sourceX + targetX) / 2;
  const template = pickSpliceRouteTemplate(sourceX, sourceY, targetX, targetY);
  if (template === "straight") {
    return (sourceX + targetX) / 2;
  }
  if (template === "same_side") {
    const columnX = (sourceX + targetX) / 2;
    const { routingLane = 0 } = options;
    const raw = inwardAnchorFromColumn(
      columnX,
      centerX,
      sideSpans,
      routingLane * SPLICE_LANE_SEP,
    );
    return clampMidXForMinHorizontalInset(
      raw,
      sourceX,
      targetX,
      centerX,
      sideSpans,
    );
  }
  const { rowOffset, maxRowOffset, routingLane = 0, laneCount = 1 } = options;
  let midX: number;
  if (
    rowOffset !== undefined &&
    maxRowOffset !== undefined &&
    maxRowOffset > 0
  ) {
    midX = spliceMidXFromRowOffset(
      sourceX,
      targetX,
      rowOffset,
      maxRowOffset,
      sourceY,
      targetY,
    );
  } else {
    midX = spliceMidX(sourceX, targetX, routingLane, laneCount);
  }
  return clampMidXForMinHorizontalInset(
    midX,
    sourceX,
    targetX,
    centerX,
    sideSpans,
  );
}

export type SplicePathResult = {
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
  bendCount: number;
  template: SpliceRouteTemplate;
};

export type SpliceRoutingLane = {
  midX: number;
  /** Shared inward trunk X for tube bundles — optional H stub before vertical lane. */
  jogX?: number;
  /** Distinct Y for source-side horizontal legs when same-row paths would stack. */
  sourceHorizY?: number;
  /** Distinct Y for target-side horizontal legs when same-row paths would stack. */
  targetHorizY?: number;
  /** Staggered gap X for source-side vertical bend (EDGE-011). */
  sourceBendX?: number;
  /** Staggered gap X for target-side vertical bend (EDGE-011). */
  targetBendX?: number;
};

export function routingLaneDataFromLane(
  lane: SpliceRoutingLane,
): SpliceRoutingLaneData {
  return {
    routingMidX: lane.midX,
    ...(lane.jogX !== undefined ? { routingJogX: lane.jogX } : {}),
    ...(lane.sourceHorizY !== undefined
      ? { routingSourceHorizY: lane.sourceHorizY }
      : {}),
    ...(lane.targetHorizY !== undefined
      ? { routingTargetHorizY: lane.targetHorizY }
      : {}),
    ...(lane.sourceBendX !== undefined
      ? { routingSourceBendX: lane.sourceBendX }
      : {}),
    ...(lane.targetBendX !== undefined
      ? { routingTargetBendX: lane.targetBendX }
      : {}),
  };
}

export function routingLaneFromData(
  data?: Partial<SpliceRoutingLaneData>,
): SpliceRoutingLane | undefined {
  if (data?.routingMidX === undefined) return undefined;
  return {
    midX: data.routingMidX,
    jogX: data.routingJogX,
    sourceHorizY: data.routingSourceHorizY,
    targetHorizY: data.routingTargetHorizY,
    sourceBendX: data.routingSourceBendX,
    targetBendX: data.routingTargetBendX,
  };
}

export const MAX_SPLICE_BENDS = 2;

export function maxSpliceBendsForLane(
  _sourceY: number,
  _targetY: number,
  _lane: SpliceRoutingLane,
): number {
  return MAX_SPLICE_BENDS;
}

/**
 * Build handle→handle splice paths with ≤2 orthogonal bends.
 * Prefers straight (0) before same-side or cross-side H–V–H (2 each).
 */
export function buildSplicePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  midX: number,
  jogX?: number,
  sideHoriz?: Pick<
    SpliceRoutingLane,
    "sourceHorizY" | "targetHorizY" | "sourceBendX" | "targetBendX"
  >,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  diagramCenterX = (sourceX + targetX) / 2,
  sourceTagWidth = 0,
  targetTagWidth = 0,
): SplicePathResult {
  const template = pickSpliceRouteTemplate(sourceX, sourceY, targetX, targetY);

  if (template === "straight") {
    const spliceX = (sourceX + targetX) / 2;
    const spliceY = sourceY;
    const leftPath = `M ${sourceX},${sourceY} L ${spliceX},${spliceY}`;
    const rightPath = `M ${spliceX},${spliceY} L ${targetX},${targetY}`;
    return {
      leftPath,
      rightPath,
      spliceX,
      spliceY,
      bendCount: countOrthogonalBends(leftPath, rightPath),
      template,
    };
  }

  const demarcated = buildDemarcatedSplicePaths(
    sourceX,
    sourceY,
    targetX,
    targetY,
    midX,
    jogX,
    sideHoriz,
    sideSpans,
    diagramCenterX,
    sourceTagWidth,
    targetTagWidth,
  );
  return {
    ...demarcated,
    bendCount: countOrthogonalBends(demarcated.leftPath, demarcated.rightPath),
    template,
  };
}

/** Explicit H–V–H splice path; each edge owns its vertical at `midX`. */
export function buildOrthogonalSplicePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  midX: number,
): { path: string; labelX: number; labelY: number } {
  return {
    path: `M ${sourceX},${sourceY} L ${midX},${sourceY} L ${midX},${targetY} L ${targetX},${targetY}`,
    labelX: midX,
    labelY: (sourceY + targetY) / 2,
  };
}

/**
 * First X on the handle row where a vertical bend is allowed (EDGE-009).
 * Clears the side-wide OS label column plus inward jog before turning vertical.
 */
export function inwardClearXBeforeVertical(
  handleX: number,
  anchorX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  tagWidth = 0,
  jog = MIN_SPLICE_HORIZONTAL_INSET,
  handleAtLabelOuterEdge = true,
): number {
  const minClear = minClearMidXForHandle(
    handleX,
    diagramCenterX,
    sideSpans,
    tagWidth,
    jog,
    handleAtLabelOuterEdge,
  );
  const side = canvasSideForHandle(handleX, diagramCenterX);
  if (side === "left") {
    return Math.min(anchorX, Math.max(minClear, handleX));
  }
  return Math.max(anchorX, Math.min(minClear, handleX));
}

/** Symmetric clear-X for the target handle (same math, inward from target). */
export function targetClearXBeforeVertical(
  targetX: number,
  anchorX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  tagWidth = 0,
  jog = MIN_SPLICE_HORIZONTAL_INSET,
  handleAtLabelOuterEdge = true,
): number {
  return inwardClearXBeforeVertical(
    targetX,
    anchorX,
    diagramCenterX,
    sideSpans,
    tagWidth,
    jog,
    handleAtLabelOuterEdge,
  );
}

function clampGapBendX(
  staggered: number,
  handleX: number,
  anchorX: number,
  base: number,
): number {
  const spanLo = Math.min(handleX, anchorX, base);
  const spanHi = Math.max(handleX, anchorX, base);
  return Math.max(spanLo, Math.min(staggered, spanHi));
}

/**
 * Per-lane clear X for Y-track bends — staggers inward by global gap lane index
 * so strands never stack vertical legs at one shared OS column X.
 */
export function laneClearXBeforeVertical(
  handleX: number,
  anchorX: number,
  anchorY: number,
  horizY: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  tagWidth = 0,
  jog = MIN_SPLICE_HORIZONTAL_INSET,
  gapLaneIndex = 0,
): number {
  const base = inwardClearXBeforeVertical(
    handleX,
    anchorX,
    diagramCenterX,
    sideSpans,
    tagWidth,
    jog,
  );
  const horizLaneIndex =
    Math.abs(horizY - anchorY) > SPLICE_PATH_EPS
      ? Math.round(Math.abs(horizY - anchorY) / SPLICE_LANE_SEP)
      : 0;
  const laneIndex = gapLaneIndex + horizLaneIndex;
  if (laneIndex <= 0) {
    return base;
  }
  const inward = canvasSideForHandle(handleX, diagramCenterX) === "left" ? 1 : -1;
  const staggered = base + inward * laneIndex * SPLICE_LANE_SEP;
  return clampGapBendX(staggered, handleX, anchorX, base);
}

function appendHorizontalPoint(
  parts: string[],
  x: number,
  y: number,
  lastX: number,
): number {
  if (Math.abs(x - lastX) <= SPLICE_PATH_EPS) return lastX;
  parts.push(`L ${x},${y}`);
  return x;
}

/** Drop or clamp bundle trunk X so fan-out never backtracks after render inset. */
export function reconcileBundleJogXForRender(
  midX: number,
  jogX: number | undefined,
  sourceX: number,
  diagramCenterX: number,
): number | undefined {
  if (jogX === undefined || !Number.isFinite(jogX)) return undefined;
  const inward =
    inwardSignForColumn(sourceX, diagramCenterX) > 0 ? 1 : -1;
  if (inward > 0) {
    if (jogX >= midX - SPLICE_PATH_EPS) return undefined;
    return jogX;
  }
  if (jogX <= midX + SPLICE_PATH_EPS) return undefined;
  return jogX;
}

function sourceHorizWaypoints(
  sourceX: number,
  midX: number,
  jogX: number | undefined,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
  sourceTagWidth: number,
  sourceBendX?: number,
): number[] {
  const rawSourceClearX =
    sourceBendX !== undefined && Number.isFinite(sourceBendX)
      ? sourceBendX
      : inwardClearXBeforeVertical(
          sourceX,
          midX,
          diagramCenterX,
          sideSpans,
          sourceTagWidth,
        );
  const inward =
    inwardSignForColumn(sourceX, diagramCenterX) > 0 ? 1 : -1;
  const sourceClearX =
    inward > 0
      ? Math.min(rawSourceClearX, midX)
      : Math.max(rawSourceClearX, midX);
  const trunkX = reconcileBundleJogXForRender(
    midX,
    jogX,
    sourceX,
    diagramCenterX,
  );
  const raw: number[] = [sourceClearX];
  if (
    trunkX !== undefined &&
    Math.abs(trunkX - midX) > SPLICE_PATH_EPS
  ) {
    raw.push(trunkX);
  }
  raw.push(midX);

  const waypoints: number[] = [];
  let lastX = sourceX;
  for (const x of raw) {
    if (Math.abs(x - lastX) <= SPLICE_PATH_EPS) continue;
    if (waypoints.length === 0) {
      waypoints.push(x);
      lastX = x;
      continue;
    }
    const delta = x - lastX;
    if (inward > 0 && delta <= SPLICE_PATH_EPS) continue;
    if (inward < 0 && delta >= -SPLICE_PATH_EPS) continue;
    waypoints.push(x);
    lastX = x;
  }
  return waypoints;
}

function appendSourceHorizWaypoints(
  parts: string[],
  waypoints: number[],
  y: number,
  startX: number,
): number {
  let lastX = startX;
  for (const x of waypoints) {
    lastX = appendHorizontalPoint(parts, x, y, lastX);
  }
  return lastX;
}

/**
 * Left leg stops at the fusion dot; right leg starts there (different strand colors).
 *
 * EDGE-004: at most two 90° bends handle-to-handle — route on handle rows only;
 * optional bundle jog uses same-Y horizontals before one center vertical.
 */
export function buildDemarcatedSplicePaths(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  midX: number,
  jogX?: number,
  _sideHoriz?: Pick<
    SpliceRoutingLane,
    "sourceHorizY" | "targetHorizY" | "sourceBendX" | "targetBendX"
  >,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  diagramCenterX = (sourceX + targetX) / 2,
  sourceTagWidth = 0,
  _targetTagWidth = 0,
): {
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
} {
  const spliceY = (sourceY + targetY) / 2;
  const horizXs = sourceHorizWaypoints(
    sourceX,
    midX,
    jogX,
    diagramCenterX,
    sideSpans,
    sourceTagWidth,
    _sideHoriz?.sourceBendX,
  );

  const leftParts = [`M ${sourceX},${sourceY}`];
  appendSourceHorizWaypoints(leftParts, horizXs, sourceY, sourceX);
  leftParts.push(`L ${midX},${spliceY}`);

  const rightParts = [
    `M ${midX},${spliceY}`,
    `L ${midX},${targetY}`,
    `L ${targetX},${targetY}`,
  ];

  const leftPath = leftParts.join(" ");
  const rightPath = rightParts.join(" ");
  return {
    leftPath,
    rightPath,
    spliceX: midX,
    spliceY,
  };
}

export function effectiveSpliceLaneSep(
  sourceX: number,
  targetX: number,
  laneCount: number,
): number {
  const availableGap = spliceRoutingSpan(sourceX, targetX);
  if (laneCount <= 1 || availableGap <= 0) return SPLICE_LANE_SEP;
  const minSpan = (laneCount - 1) * SPLICE_LANE_SEP;
  if (availableGap < minSpan) return SPLICE_LANE_SEP;
  return availableGap / (laneCount - 1);
}

export function spliceRoutingSpan(sourceX: number, targetX: number): number {
  return (
    Math.abs(targetX - sourceX) - 2 * SPLICE_ROUTING_END_MARGIN
  );
}

export function spliceRoutingBounds(
  sourceX: number,
  targetX: number,
): { lo: number; hi: number; span: number } {
  const lo = Math.min(sourceX, targetX) + SPLICE_ROUTING_END_MARGIN;
  const hi = Math.max(sourceX, targetX) - SPLICE_ROUTING_END_MARGIN;
  return { lo, hi, span: Math.max(0, hi - lo) };
}

/**
 * Map global row offset to midX so center lanes mirror vertical tube-group spacing.
 * Fills the full center gap when import width is computed from row-offset span.
 */
export function spliceMidXFromRowOffset(
  sourceX: number,
  targetX: number,
  rowOffset: number,
  maxRowOffset: number,
  sourceY?: number,
  targetY?: number,
): number {
  const { lo, span } = spliceRoutingBounds(sourceX, targetX);
  if (span <= 0 || maxRowOffset <= 0) return (sourceX + targetX) / 2;
  let clampedOffset = Math.max(0, Math.min(rowOffset, maxRowOffset));
  if (
    sourceY !== undefined &&
    targetY !== undefined &&
    spliceMidOrderInverts(sourceX, sourceY, targetX, targetY)
  ) {
    clampedOffset = maxRowOffset - clampedOffset;
  }
  return lo + (clampedOffset / maxRowOffset) * span;
}


export function clampButtSpliceMidX(
  midX: number,
  sourceX: number,
  targetX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
): number {
  return enforceMinHorizontalInset(
    midX,
    sourceX,
    targetX,
    diagramCenterX,
    sideSpans,
    MIN_SPLICE_HORIZONTAL_INSET,
    0,
    0,
    true,
    true,
  );
}

export const BUTT_SPLICE_STRAIGHT_Y_TOLERANCE = FIBER_ROW_PITCH / 2;

/**
 * Vertical lane X for collapsed tubes — always in the center routing band,
 * never hugging a cable column (row-offset packed midX is for fibers only).
 */
export function resolveButtSpliceMidX(
  sourceX: number,
  targetX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  laneIndex = 0,
  laneCount = 1,
): number {
  const { lo, hi, span } = spliceRoutingBounds(sourceX, targetX);
  const inset = spliceMidXInsetBounds(
    sourceX,
    targetX,
    diagramCenterX,
    sideSpans,
    MIN_SPLICE_HORIZONTAL_INSET,
    0,
    0,
    true,
    true,
  );
  let useLo = Math.max(lo, inset.lo);
  let useHi = Math.min(hi, inset.hi);
  if (useLo > useHi + SPLICE_PATH_EPS) {
    return clampButtSpliceMidX(
      (sourceX + targetX) / 2,
      sourceX,
      targetX,
      diagramCenterX,
      sideSpans,
    );
  }
  if (useLo > useHi) {
    const swap = useLo;
    useLo = useHi;
    useHi = swap;
  }
  const center = (useLo + useHi) / 2;
  const count = Math.max(1, laneCount);
  if (count <= 1 || span <= SPLICE_PATH_EPS) {
    return center;
  }
  const sep = Math.min(
    SPLICE_LANE_SEP,
    (useHi - useLo) / Math.max(1, count - 1),
  );
  const offset = (laneIndex - (count - 1) / 2) * sep;
  return Math.max(useLo, Math.min(useHi, center + offset));
}

function buttSpliceYsAligned(sourceY: number, targetY: number): boolean {
  return Math.abs(sourceY - targetY) <= BUTT_SPLICE_STRAIGHT_Y_TOLERANCE;
}

/**
 * Collapsed full-butt-splice tube path — ≤2 bends, bend only when row Y differs.
 * Straight (0 bends) when handle rows align within half pitch.
 * Cross-side: vertical at center midX on source leg; target leg horizontal only.
 */
export function buildButtSplicePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  _midX: number,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  diagramCenterX = (sourceX + targetX) / 2,
  laneIndex = 0,
  laneCount = 1,
): SplicePathResult {
  const verticalX = resolveButtSpliceMidX(
    sourceX,
    targetX,
    diagramCenterX,
    sideSpans,
    laneIndex,
    laneCount,
  );

  if (buttSpliceYsAligned(sourceY, targetY)) {
    const routeY = (sourceY + targetY) / 2;
    const spliceX = (sourceX + targetX) / 2;
    const leftPath = `M ${sourceX},${routeY} L ${spliceX},${routeY}`;
    const rightPath = `M ${spliceX},${routeY} L ${targetX},${routeY}`;
    return {
      leftPath,
      rightPath,
      spliceX,
      spliceY: routeY,
      bendCount: countOrthogonalBends(leftPath, rightPath),
      template: "straight",
    };
  }

  const template = pickSpliceRouteTemplate(sourceX, sourceY, targetX, targetY);
  const sourceClearX = inwardClearXBeforeVertical(
    sourceX,
    verticalX,
    diagramCenterX,
    sideSpans,
    0,
  );
  const leftParts = [`M ${sourceX},${sourceY}`];
  if (Math.abs(sourceClearX - sourceX) > SPLICE_PATH_EPS) {
    leftParts.push(`L ${sourceClearX},${sourceY}`);
  }
  if (Math.abs(verticalX - sourceClearX) > SPLICE_PATH_EPS) {
    leftParts.push(`L ${verticalX},${sourceY}`);
  } else if (
    Math.abs(verticalX - sourceX) > SPLICE_PATH_EPS &&
    Math.abs(sourceClearX - sourceX) <= SPLICE_PATH_EPS
  ) {
    leftParts.push(`L ${verticalX},${sourceY}`);
  }
  if (Math.abs(targetY - sourceY) > SPLICE_PATH_EPS) {
    leftParts.push(`L ${verticalX},${targetY}`);
  }

  const rightParts = [`M ${verticalX},${targetY}`, `L ${targetX},${targetY}`];

  return {
    leftPath: leftParts.join(" "),
    rightPath: rightParts.join(" "),
    spliceX: verticalX,
    spliceY: targetY,
    bendCount: countOrthogonalBends(leftParts.join(" "), rightParts.join(" ")),
    template,
  };
}

type OrthogonalSegment =
  | { kind: "h"; y: number; x0: number; x1: number }
  | { kind: "v"; x: number; y0: number; y1: number };


function hvDemarcatedSegments(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  midX: number,
  jogX?: number,
  _sideHoriz?: Pick<
    SpliceRoutingLane,
    "sourceHorizY" | "targetHorizY" | "sourceBendX" | "targetBendX"
  >,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  diagramCenterX = (sourceX + targetX) / 2,
  sourceTagWidth = 0,
  _targetTagWidth = 0,
): OrthogonalSegment[] {
  const spliceY = (sourceY + targetY) / 2;
  const horizXs = sourceHorizWaypoints(
    sourceX,
    midX,
    jogX,
    diagramCenterX,
    sideSpans,
    sourceTagWidth,
    _sideHoriz?.sourceBendX,
  );
  const segments: OrthogonalSegment[] = [];

  let x0 = sourceX;
  for (const x1 of horizXs) {
    if (Math.abs(x1 - x0) > SPLICE_PATH_EPS) {
      segments.push({ kind: "h", y: sourceY, x0, x1 });
      x0 = x1;
    }
  }
  segments.push({ kind: "v", x: midX, y0: sourceY, y1: spliceY });
  segments.push({ kind: "v", x: midX, y0: spliceY, y1: targetY });
  segments.push({ kind: "h", y: targetY, x0: midX, x1: targetX });

  return segments;
}

/** Orthogonal segments for overlap checks (includes optional bundle jog trunk). */
export function spliceRouteSegments(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  midX: number,
  jogX?: number,
  sideHoriz?: Pick<
    SpliceRoutingLane,
    "sourceHorizY" | "targetHorizY" | "sourceBendX" | "targetBendX"
  >,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  diagramCenterX = (sourceX + targetX) / 2,
  sourceTagWidth = 0,
  targetTagWidth = 0,
): OrthogonalSegment[] {
  const template = pickSpliceRouteTemplate(sourceX, sourceY, targetX, targetY);
  if (template === "straight") {
    const spliceX = (sourceX + targetX) / 2;
    return [
      { kind: "h", y: sourceY, x0: sourceX, x1: spliceX },
      { kind: "h", y: targetY, x0: spliceX, x1: targetX },
    ];
  }
  return hvDemarcatedSegments(
    sourceX,
    sourceY,
    targetX,
    targetY,
    midX,
    jogX,
    sideHoriz,
    sideSpans,
    diagramCenterX,
    sourceTagWidth,
    targetTagWidth,
  );
}

/** True when rendered splice paths never turn vertical at handle X (EDGE-009). */
export function splicePathsAvoidHandleColumnVertical(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  midX: number,
  jogX?: number,
  sideHoriz?: Pick<
    SpliceRoutingLane,
    "sourceHorizY" | "targetHorizY" | "sourceBendX" | "targetBendX"
  >,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  diagramCenterX = (sourceX + targetX) / 2,
  sourceTagWidth = 0,
  targetTagWidth = 0,
): boolean {
  const template = pickSpliceRouteTemplate(sourceX, sourceY, targetX, targetY);
  if (template === "straight") return true;

  const segs = spliceRouteSegments(
    sourceX,
    sourceY,
    targetX,
    targetY,
    midX,
    jogX,
    sideHoriz,
    sideSpans,
    diagramCenterX,
    sourceTagWidth,
    targetTagWidth,
  );
  for (const seg of segs) {
    if (seg.kind !== "v") continue;
    if (Math.abs(seg.x - sourceX) <= SPLICE_PATH_EPS) return false;
    if (Math.abs(seg.x - targetX) <= SPLICE_PATH_EPS) return false;
  }
  return true;
}

function segmentInterval(lo: number, hi: number): { lo: number; hi: number } {
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
}

/** True when collinear strand segments share the same track (not merely parallel lanes). */
export function parallelSpliceSegmentsOverlap(
  a: OrthogonalSegment,
  b: OrthogonalSegment,
): boolean {
  if (a.kind === "h" && b.kind === "h") {
    if (!Number.isFinite(a.y) || !Number.isFinite(b.y)) return false;
    if (Math.abs(a.y - b.y) > SPLICE_PATH_EPS) return false;
    const xA = segmentInterval(a.x0, a.x1);
    const xB = segmentInterval(b.x0, b.x1);
    return Math.min(xA.hi, xB.hi) - Math.max(xA.lo, xB.lo) > SPLICE_PATH_EPS;
  }
  if (a.kind === "v" && b.kind === "v") {
    if (!Number.isFinite(a.x) || !Number.isFinite(b.x)) return false;
    if (Math.abs(a.x - b.x) > SPLICE_PATH_EPS) return false;
    const yA = segmentInterval(a.y0, a.y1);
    const yB = segmentInterval(b.y0, b.y1);
    return Math.min(yA.hi, yB.hi) - Math.max(yA.lo, yB.lo) > SPLICE_PATH_EPS;
  }
  return false;
}

/** Nested handle-row horizontals at the same splice row Y (EDGE-004 two-bend lead-in). */
export function isSharedSpliceRowLeadInOverlap(
  sourceYA: number,
  sourceYB: number,
  targetYA: number,
  targetYB: number,
  segA: OrthogonalSegment,
  segB: OrthogonalSegment,
): boolean {
  if (segA.kind !== "h" || segB.kind !== "h") return false;
  if (Math.abs(segA.y - segB.y) > SPLICE_PATH_EPS) return false;
  if (Math.abs(sourceYA - sourceYB) <= SPLICE_PATH_EPS) return true;
  if (Math.abs(targetYA - targetYB) <= SPLICE_PATH_EPS) return true;
  return false;
}

/** Same-Y handle horizontals when center lanes are already ≥24px apart (nested lead-ins). */
export function isNestedHandleRowHorizOverlap(
  segA: OrthogonalSegment,
  segB: OrthogonalSegment,
  midXA: number,
  midXB: number,
): boolean {
  if (segA.kind !== "h" || segB.kind !== "h") return false;
  if (Math.abs(segA.y - segB.y) > SPLICE_PATH_EPS) return false;
  return Math.abs(midXA - midXB) >= SPLICE_LANE_SEP - 0.01;
}

/** Center vertical leg crossing another strand's handle-row lead-in (inherent to ≤2-bend routes). */
export function isTwoBendRoutingCrossing(
  a: OrthogonalSegment,
  b: OrthogonalSegment,
): boolean {
  const vertical = a.kind === "v" ? a : b.kind === "v" ? b : undefined;
  const horizontal = a.kind === "h" ? a : b.kind === "h" ? b : undefined;
  if (!vertical || !horizontal) return false;
  const vLo = Math.min(vertical.y0, vertical.y1);
  const vHi = Math.max(vertical.y0, vertical.y1);
  if (horizontal.y < vLo - SPLICE_PATH_EPS || horizontal.y > vHi + SPLICE_PATH_EPS) {
    return false;
  }
  const hLo = Math.min(horizontal.x0, horizontal.x1);
  const hHi = Math.max(horizontal.x0, horizontal.x1);
  return (
    vertical.x >= hLo - SPLICE_PATH_EPS && vertical.x <= hHi + SPLICE_PATH_EPS
  );
}

export function isCenterVerticalCrossingHandleRowLeadIn(
  vertical: OrthogonalSegment,
  horizontal: OrthogonalSegment,
  horizontalOwnerSourceY: number,
): boolean {
  if (vertical.kind !== "v" || horizontal.kind !== "h") return false;
  if (Math.abs(horizontal.y - horizontalOwnerSourceY) > SPLICE_PATH_EPS) return false;
  return isTwoBendRoutingCrossing(vertical, horizontal);
}

function orthogonalSegmentsCross(
  a: OrthogonalSegment,
  b: OrthogonalSegment,
): boolean {
  if (a.kind === "h" && b.kind === "v") {
    const hLo = Math.min(a.x0, a.x1);
    const hHi = Math.max(a.x0, a.x1);
    const vLo = Math.min(b.y0, b.y1);
    const vHi = Math.max(b.y0, b.y1);
    return (
      b.x >= hLo - SPLICE_PATH_EPS &&
      b.x <= hHi + SPLICE_PATH_EPS &&
      a.y >= vLo - SPLICE_PATH_EPS &&
      a.y <= vHi + SPLICE_PATH_EPS
    );
  }
  if (a.kind === "v" && b.kind === "h") {
    return orthogonalSegmentsCross(b, a);
  }
  return false;
}

/** True when two H–V–H splice paths share a crossing segment intersection. */
export function hvDemarcatedPathsCross(
  sourceXA: number,
  sourceYA: number,
  targetXA: number,
  targetYA: number,
  midXA: number,
  sourceXB: number,
  sourceYB: number,
  targetXB: number,
  targetYB: number,
  midXB: number,
  jogXA?: number,
  jogXB?: number,
  sideHorizA?: Pick<SpliceRoutingLane, "sourceHorizY" | "targetHorizY">,
  sideHorizB?: Pick<SpliceRoutingLane, "sourceHorizY" | "targetHorizY">,
): boolean {
  const segsA = hvDemarcatedSegments(
    sourceXA,
    sourceYA,
    targetXA,
    targetYA,
    midXA,
    jogXA,
    sideHorizA,
  );
  const segsB = hvDemarcatedSegments(
    sourceXB,
    sourceYB,
    targetXB,
    targetYB,
    midXB,
    jogXB,
    sideHorizB,
  );
  for (const a of segsA) {
    for (const b of segsB) {
      if (orthogonalSegmentsCross(a, b)) {
        if (isTwoBendRoutingCrossing(a, b)) {
          continue;
        }
        return true;
      }
    }
  }
  return false;
}

export function spliceMidX(
  sourceX: number,
  targetX: number,
  routingLane: number,
  laneCount: number,
): number {
  const towardTarget = targetX >= sourceX ? 1 : -1;
  const { lo, hi } = spliceRoutingBounds(sourceX, targetX);
  const sep = effectiveSpliceLaneSep(sourceX, targetX, laneCount);
  const laneOffset =
    (routingLane - (laneCount - 1) / 2) * sep * towardTarget;
  const raw = (sourceX + targetX) / 2 + laneOffset;
  return Math.max(lo, Math.min(hi, raw));
}

type Registry = {
  entries: Map<string, SpliceEdgeRouteEntry>;
  signature: string;
  subscribers: Set<() => void>;
  raf: number;
};

const registry: Registry = {
  entries: new Map(),
  signature: "",
  subscribers: new Set(),
  raf: 0,
};

function entrySignature(entries: Iterable<SpliceEdgeRouteEntry>): string {
  return [...entries]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (e) =>
        `${e.id}:${Math.round(e.sourceX)}:${Math.round(e.sourceY)}:${Math.round(e.targetX)}:${Math.round(e.targetY)}:${e.fallbackLane}:${e.rowOffset ?? ""}`,
    )
    .join("|");
}

function notifySubscribers() {
  for (const sub of registry.subscribers) sub();
}

/** Sync lane recompute when subscribers exist; skip signature commit if nobody listens yet. */
function flushNotify() {
  const next = entrySignature(registry.entries.values());
  if (registry.subscribers.size === 0) return;
  if (next === registry.signature) return;
  registry.signature = next;
  notifySubscribers();
}

function scheduleNotify() {
  if (registry.raf) return;
  registry.raf = requestAnimationFrame(() => {
    registry.raf = 0;
    flushNotify();
  });
}

function publishEntry(entry: SpliceEdgeRouteEntry) {
  registry.entries.set(entry.id, entry);
  scheduleNotify();
}

function removeEntry(id: string) {
  if (!registry.entries.delete(id)) return;
  scheduleNotify();
}

let activeDragCableNodeId: string | null = null;
let dragRoutingSnapshot: Map<string, SpliceRoutingLane> | null = null;
const dragRoutingListeners = new Set<() => void>();

function notifyDragRoutingListeners() {
  for (const listener of dragRoutingListeners) listener();
}

/** Full-graph lane snapshot while a cable is dragged (avoids partial-registry packing). */
export function publishDragRoutingSnapshot(
  entries: SpliceHandleEntry[],
  diagramCenterX?: number,
): void {
  if (activeDragCableNodeId === null) return;
  dragRoutingSnapshot = assignSpliceRoutingLanesFromLiveHandles(
    entries,
    diagramCenterX,
  ).lanes;
  notifyDragRoutingListeners();
}

function getDragRoutingLane(edgeId: string): SpliceRoutingLane | undefined {
  return dragRoutingSnapshot?.get(edgeId);
}

function clearDragRoutingSnapshot(): void {
  dragRoutingSnapshot = null;
}

/** Limit live lane registry to one cable while the user drags it. */
export function setActiveDragCableNodeId(nodeId: string | null): void {
  activeDragCableNodeId = nodeId;
  if (nodeId === null) {
    clearDragRoutingSnapshot();
    registry.entries.clear();
    registry.signature = "";
    notifySubscribers();
  }
}

export function getActiveDragCableNodeId(): string | null {
  return activeDragCableNodeId;
}

export function routingMidXForRender(
  midX: number,
  sourceX: number,
  targetX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
  sourceTagWidth = 0,
  targetTagWidth = 0,
): number {
  const { lo, hi } = spliceMidXInsetBounds(
    sourceX,
    targetX,
    diagramCenterX,
    sideSpans,
    MIN_SPLICE_HORIZONTAL_INSET,
    sourceTagWidth,
    targetTagWidth,
    true,
    true,
  );
  if (
    lo <= hi + SPLICE_PATH_EPS &&
    midX >= lo - SPLICE_PATH_EPS &&
    midX <= hi + SPLICE_PATH_EPS
  ) {
    return midX;
  }
  return enforceMinHorizontalInset(
    midX,
    sourceX,
    targetX,
    diagramCenterX,
    sideSpans,
    MIN_SPLICE_HORIZONTAL_INSET,
    sourceTagWidth,
    targetTagWidth,
    true,
    true,
  );
}

/**
 * EDGE-008/012: keep sibling vertical legs separated at render time.
 *
 * Lane assignment runs against the analytic handle model, but render uses the
 * settled handle X (which can differ by tens–hundreds of px, worse after a
 * cable flips sides). When the stored midX lands outside the render clearance
 * band, routingMidXForRender clamps every out-of-band sibling onto the same
 * boundary and the legs stack. Re-anchor at that boundary and step each
 * sibling away from the violated edge by its stable rowOffset rank, kept
 * inside the band, so siblings stay ≥ SPLICE_LANE_SEP apart with no cross-edge
 * / registry state (deterministic, no render-order thrash).
 */
function separatedMidXForRender(
  storedMidX: number,
  sourceX: number,
  targetX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
  sourceTagWidth: number,
  targetTagWidth: number,
  rowOffset: number | undefined,
): number {
  const clamped = routingMidXForRender(
    storedMidX,
    sourceX,
    targetX,
    diagramCenterX,
    sideSpans,
    sourceTagWidth,
    targetTagWidth,
  );
  // In-band already → nothing to fix.
  if (Math.abs(clamped - storedMidX) <= SPLICE_PATH_EPS) return clamped;
  const rank = Math.max(0, Math.round((rowOffset ?? 0) / FIBER_ROW_PITCH));
  if (rank === 0) return clamped;
  // Step away from whichever boundary the clamp hit (stored beyond hi → step
  // down; stored below lo → step up), then keep the result inside the band.
  const dir = storedMidX > clamped ? -1 : 1;
  const staggered = clamped + dir * rank * SPLICE_LANE_SEP;
  const { lo, hi } = spliceMidXInsetBounds(
    sourceX,
    targetX,
    diagramCenterX,
    sideSpans,
    MIN_SPLICE_HORIZONTAL_INSET,
    sourceTagWidth,
    targetTagWidth,
    true,
    true,
  );
  return Math.max(lo, Math.min(hi, staggered));
}

function renderLaneGeometry(
  lane: SpliceRoutingLane | undefined,
  midX: number,
  sourceX: number,
  diagramCenterX: number,
  fullButtSplice: boolean,
): {
  midX: number;
  jogX?: number;
  sourceHorizY?: number;
  targetHorizY?: number;
  sourceBendX?: number;
  targetBendX?: number;
} {
  if (fullButtSplice || !lane) return { midX };
  return {
    midX,
    jogX: reconcileBundleJogXForRender(
      midX,
      lane.jogX,
      sourceX,
      diagramCenterX,
    ),
    sourceHorizY: lane.sourceHorizY,
    targetHorizY: lane.targetHorizY,
    sourceBendX: lane.sourceBendX,
    targetBendX: lane.targetBendX,
  };
}

export function useRoutingLaneIndex(
  edgeId: string,
  sourceNodeId: string,
  targetNodeId: string,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  fallbackLane: number,
  enabled: boolean,
  laneCountHint: number,
  rowOffset?: number,
  sideCircuitSpan?: SideCircuitLabelSpan,
  tubeBundleKey?: string,
  storedLane?: SpliceRoutingLane,
  sourceTagWidth = 0,
  targetTagWidth = 0,
  diagramCenterX?: number,
  fullButtSplice = false,
): {
  routingLane: number;
  activeLaneCount: number;
  maxRowOffset: number;
  midX: number;
  jogX?: number;
  sourceHorizY?: number;
  targetHorizY?: number;
  sourceBendX?: number;
  targetBendX?: number;
} {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const dragCableNodeId = activeDragCableNodeId;
  const isDragAffected =
    dragCableNodeId !== null &&
    (sourceNodeId === dragCableNodeId || targetNodeId === dragCableNodeId);
  const useLiveRegistry = enabled && isDragAffected && dragRoutingSnapshot === null;

  useLayoutEffect(() => {
    if (!isDragAffected || !enabled) return;
    const sub = () => bump();
    dragRoutingListeners.add(sub);
    return () => {
      dragRoutingListeners.delete(sub);
    };
  }, [edgeId, bump, isDragAffected, enabled]);

  useLayoutEffect(() => {
    if (!useLiveRegistry) return;
    const sub = () => bump();
    registry.subscribers.add(sub);
    flushNotify();
    return () => {
      registry.subscribers.delete(sub);
      removeEntry(edgeId);
    };
  }, [edgeId, bump, useLiveRegistry]);

  useEffect(() => {
    if (useLiveRegistry) return;
    removeEntry(edgeId);
  }, [edgeId, useLiveRegistry]);

  const sideSpans = sideCircuitSpan ?? defaultSideCircuitLabelSpan();
  const maxRowOffset = Math.max(0, rowOffset ?? 0);
  const resolvedCenterX =
    diagramCenterX ?? (sourceX + targetX) / 2;

  if (!enabled) {
    const midX = routingMidXForRender(
      resolveSpliceMidX(sourceX, sourceY, targetX, targetY, {
        rowOffset,
        maxRowOffset,
        routingLane: fallbackLane,
        laneCount: Math.max(1, laneCountHint),
        diagramCenterX: resolvedCenterX,
        sideCircuitSpan: sideSpans,
      }),
      sourceX,
      targetX,
      resolvedCenterX,
      sideSpans,
      sourceTagWidth,
      targetTagWidth,
    );
    return {
      routingLane: fallbackLane,
      activeLaneCount: Math.max(1, laneCountHint),
      maxRowOffset,
      midX,
    };
  }

  if (!isDragAffected && storedLane) {
    const midX = fullButtSplice
      ? resolveButtSpliceMidX(
          sourceX,
          targetX,
          resolvedCenterX,
          sideSpans,
          fallbackLane,
          laneCountHint,
        )
      : separatedMidXForRender(
          storedLane.midX,
          sourceX,
          targetX,
          resolvedCenterX,
          sideSpans,
          sourceTagWidth,
          targetTagWidth,
          rowOffset,
        );
    return {
      routingLane: fallbackLane,
      activeLaneCount: Math.max(1, laneCountHint),
      maxRowOffset,
      ...renderLaneGeometry(
        storedLane,
        midX,
        sourceX,
        resolvedCenterX,
        fullButtSplice,
      ),
    };
  }

  if (isDragAffected && enabled) {
    const dragLane = getDragRoutingLane(edgeId) ?? storedLane;
    if (dragLane) {
      const midX = fullButtSplice
        ? resolveButtSpliceMidX(
            sourceX,
            targetX,
            resolvedCenterX,
            sideSpans,
            fallbackLane,
            laneCountHint,
          )
        : separatedMidXForRender(
            dragLane.midX,
            sourceX,
            targetX,
            resolvedCenterX,
            sideSpans,
            sourceTagWidth,
            targetTagWidth,
            rowOffset,
          );

      return {
        routingLane: fallbackLane,
        activeLaneCount: Math.max(1, laneCountHint),
        maxRowOffset,
        ...renderLaneGeometry(
          dragLane,
          midX,
          sourceX,
          resolvedCenterX,
          fullButtSplice,
        ),
      };
    }
  }

  if (!useLiveRegistry) {
    const midX = routingMidXForRender(
      resolveSpliceMidX(sourceX, sourceY, targetX, targetY, {
        rowOffset,
        maxRowOffset,
        routingLane: fallbackLane,
        laneCount: Math.max(1, laneCountHint),
        diagramCenterX: resolvedCenterX,
        sideCircuitSpan: sideSpans,
      }),
      sourceX,
      targetX,
      resolvedCenterX,
      sideSpans,
      sourceTagWidth,
      targetTagWidth,
    );
    return {
      routingLane: fallbackLane,
      activeLaneCount: Math.max(1, laneCountHint),
      maxRowOffset,
      midX,
    };
  }

  const template = pickSpliceRouteTemplate(sourceX, sourceY, targetX, targetY);
  const laneStagger = templateUsesMidXLanes(template);

  publishEntry({
    id: edgeId,
    sourceNodeId,
    targetNodeId,
    sourceX,
    sourceY,
    targetX,
    targetY,
    fallbackLane,
    rowOffset,
    tubeBundleKey,
  });

  const entries = [...registry.entries.values()];
  const activeLaneCount = Math.max(laneCountHint, entries.length, 1);
  const scopedMaxRowOffset = Math.max(
    0,
    ...entries.map((e) => e.rowOffset ?? 0),
  );
  const routingLane = laneStagger
    ? routingLaneFromEntries(entries, edgeId)
    : fallbackLane;
  const entry = entries.find((e) => e.id === edgeId);
  const scopedCenterX =
    entries.length > 0
      ? globalDiagramCenterX(
          entries.map((entry) => ({
            id: entry.id,
            sourceX: entry.sourceX,
            sourceY: entry.sourceY,
            targetX: entry.targetX,
            targetY: entry.targetY,
            rowOffset: entry.rowOffset ?? entry.fallbackLane,
          })),
        )
      : resolvedCenterX;

  const midXLaneCandidates: MidXLaneCandidate[] = entries
    .filter(
      (entry) =>
        templateUsesMidXLanes(
          pickSpliceRouteTemplate(
            entry.sourceX,
            entry.sourceY,
            entry.targetX,
            entry.targetY,
          ),
        ),
    )
    .map((entry) => ({
      id: entry.id,
      sourceX: entry.sourceX,
      sourceY: entry.sourceY,
      targetX: entry.targetX,
      targetY: entry.targetY,
      rowOffset: entry.rowOffset ?? entry.fallbackLane,
      tubeBundleKey: entry.tubeBundleKey,
    }));
  const packedRouting = assignSpliceRoutingLanes(midXLaneCandidates, sideSpans);
  const routing = packedRouting.get(edgeId);
  const midX = routingMidXForRender(
    routing?.midX ??
      resolveSpliceMidX(sourceX, sourceY, targetX, targetY, {
        rowOffset: entry?.rowOffset ?? rowOffset,
        maxRowOffset: scopedMaxRowOffset,
        routingLane,
        laneCount: activeLaneCount,
        diagramCenterX: scopedCenterX,
        sideCircuitSpan: sideSpans,
      }),
    sourceX,
    targetX,
    resolvedCenterX,
    sideSpans,
    sourceTagWidth,
    targetTagWidth,
  );

  return {
    routingLane,
    activeLaneCount,
    maxRowOffset: scopedMaxRowOffset,
    ...renderLaneGeometry(
      routing,
      midX,
      sourceX,
      resolvedCenterX,
      fullButtSplice,
    ),
  };
}

/** Parse `tube-${legId}|${tubeColor}-out/in` handle ids (striped tubes supported). */
export function parseTubeHandleId(
  handleId: string | null | undefined,
): { legId: CableLegId; tubeColor: TubeColorCode } | null {
  if (!handleId) return null;
  const match = handleId.match(/^tube-(.+)-(out|in)$/);
  if (!match) return null;
  const body = match[1]!;
  const pipe = body.lastIndexOf("|");
  if (pipe <= 0) return null;
  return {
    legId: body.slice(0, pipe) as CableLegId,
    tubeColor: body.slice(pipe + 1) as TubeColorCode,
  };
}

function parseTubeEndpointKey(
  key: string,
): { legId: CableLegId; tubeColor: TubeColorCode } | null {
  const pipe = key.lastIndexOf("|");
  if (pipe <= 0) return null;
  return {
    legId: key.slice(0, pipe) as CableLegId,
    tubeColor: key.slice(pipe + 1) as TubeColorCode,
  };
}

/** Parse tube endpoints from `butt-tube-${keyA}::${keyB}` edge ids. */
export function parseButtTubeEndpointsFromEdgeId(
  edgeId: string,
): {
  endpointA: { legId: CableLegId; tubeColor: TubeColorCode };
  endpointB: { legId: CableLegId; tubeColor: TubeColorCode };
} | null {
  const match = edgeId.match(/^butt-tube-(.+)::(.+)$/);
  if (!match) return null;
  const endpointA = parseTubeEndpointKey(match[1]!);
  const endpointB = parseTubeEndpointKey(match[2]!);
  if (!endpointA || !endpointB) return null;
  return { endpointA, endpointB };
}

/** React Flow handle center for a collapsed full-butt-splice buffer tube. */
export function tubeHandlePosition(
  vc: VisualCable,
  tubeColor: TubeColorCode,
  nodePosition: { x: number; y: number },
  scale = 1,
  alignedStemX?: number,
): { x: number; y: number } {
  const geo = computeCableBreakout(
    vc.tubes,
    vc.side,
    FIBER_ROW_PITCH,
    CABLE_LAYOUT.headerH,
    CABLE_LAYOUT.tubeLabelH,
    scale,
    alignedStemX,
  );
  const tube = geo.tubes.find((t) => t.tubeColor === tubeColor);
  const outset = SPLICE_HANDLE_OVERHANG;
  if (!tube) {
    return {
      x:
        vc.side === "left"
          ? nodePosition.x + geo.stemX + outset
          : nodePosition.x + geo.viewWidth - geo.stemX - outset,
      y: nodePosition.y + CABLE_LAYOUT.headerH,
    };
  }
  return {
    x:
      vc.side === "left"
        ? nodePosition.x + geo.stemX + outset
        : nodePosition.x + geo.viewWidth - geo.stemX - outset,
    y: nodePosition.y + tube.end.y,
  };
}

/** React Flow handle center for layout validation (handle → handle routing). */
export function fiberHandlePosition(
  vc: VisualCable,
  connectionId: string,
  nodePosition: { x: number; y: number },
  scale = 1,
  alignedStemX?: number,
  circuitName?: string,
): { x: number; y: number } {
  const geo = computeCableBreakout(
    vc.tubes,
    vc.side,
    FIBER_ROW_PITCH,
    CABLE_LAYOUT.headerH,
    CABLE_LAYOUT.tubeLabelH,
    scale,
    alignedStemX,
  );
  const fiber = vc.tubes
    .flatMap((t) => t.fibers)
    .find((f) => f.connectionId === connectionId);
  const tagCircuit = circuitName ?? fiber?.circuitName;
  const outset = fiber
    ? spliceHandleOutsetFromStem(tagCircuit)
    : SPLICE_HANDLE_OVERHANG;
  return {
    x:
      vc.side === "left"
        ? nodePosition.x + geo.stemX + outset
        : nodePosition.x + geo.viewWidth - geo.stemX - outset,
    y: nodePosition.y + fiberRowOffsetInCable(vc, connectionId),
  };
}

/** @internal test helper */
export function resetSpliceRouteRegistryForTests(): void {
  activeDragCableNodeId = null;
  registry.entries.clear();
  registry.signature = "";
  registry.subscribers.clear();
  if (registry.raf) {
    cancelAnimationFrame(registry.raf);
    registry.raf = 0;
  }
}

/** @internal EDGE-011 — exported for unit tests. */
export const spliceLaneYTrackHelpers = {
  assignSideHorizLaneYs,
  assignGapBendLaneXs,
};
