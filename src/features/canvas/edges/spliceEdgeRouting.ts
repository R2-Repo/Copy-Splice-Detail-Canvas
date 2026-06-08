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

export function assignSpliceRoutingLanesFromHandleEntries(
  entries: SpliceHandleEntry[],
  _diagramCenterX?: number,
): Map<string, SpliceRoutingLane> {
  if (entries.length === 0) return new Map();

  const sideSpans =
    entries.find((entry) => entry.sideCircuitSpan)?.sideCircuitSpan ??
    defaultSideCircuitLabelSpan();
  const candidates: MidXLaneCandidate[] = entries.map((entry) => ({
    id: entry.id,
    sourceX: entry.sourceX,
    sourceY: entry.sourceY,
    targetX: entry.targetX,
    targetY: entry.targetY,
    rowOffset: entry.rowOffset ?? entry.fallbackLane,
    tubeBundleKey: entry.tubeBundleKey,
    fullButtSplice: entry.fullButtSplice,
    sourceTagWidth: entry.sourceTagWidth,
    targetTagWidth: entry.targetTagWidth,
  }));

  return assignSpliceRoutingLanes(candidates, sideSpans);
}

/** Re-rank row offsets from live handle Y, then pack lanes (drag / live handles). */
export function assignSpliceRoutingLanesFromLiveHandles(
  entries: SpliceHandleEntry[],
  diagramCenterX?: number,
): {
  lanes: Map<string, SpliceRoutingLane>;
  rowOffsets: Map<string, number>;
} {
  const bundled = entries.filter((entry) => entry.tubeBundleKey?.trim());
  const rowOffsets = recomputeRowOffsetsFromHandleYs(
    entries.filter((entry) => !entry.tubeBundleKey?.trim()),
  );
  for (const entry of bundled) {
    rowOffsets.set(
      entry.id,
      entry.rowOffset ?? entry.fallbackLane * FIBER_ROW_PITCH,
    );
  }
  const withRows = entries.map((entry) => ({
    ...entry,
    rowOffset: rowOffsets.get(entry.id) ?? entry.rowOffset ?? entry.fallbackLane,
  }));

  // #region agent log
  {
    const nonPitchRows = withRows
      .filter((entry) => {
        const row = entry.rowOffset ?? 0;
        const pitchUnits = row / FIBER_ROW_PITCH;
        return Math.abs(pitchUnits - Math.round(pitchUnits)) > SPLICE_PATH_EPS;
      })
      .map((entry) => ({ id: entry.id, rowOffset: entry.rowOffset ?? 0 }));
    fetch("http://127.0.0.1:7727/ingest/3e400e45-f78e-432b-aa58-25cbace8ef56", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "ca41b3",
      },
      body: JSON.stringify({
        sessionId: "ca41b3",
        runId: "user-repro",
        hypothesisId: "H3-live-row-offset-rank-drift",
        location: "spliceEdgeRouting.ts:assignSpliceRoutingLanesFromLiveHandles",
        message: "Live-handle rowOffset recompute summary",
        data: {
          entriesCount: entries.length,
          withRowsCount: withRows.length,
          bundledCount: bundled.length,
          nonPitchRowCount: nonPitchRows.length,
          nonPitchRows: nonPitchRows.slice(0, 8),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  return {
    lanes: assignSpliceRoutingLanesFromHandleEntries(withRows, diagramCenterX),
    rowOffsets,
  };
}

/** Rank 0 = highest (smallest row offset / sourceY) on the left cable. */
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
  // #region agent log
  if (
    sourceBendX !== undefined &&
    Number.isFinite(sourceBendX) &&
    Math.abs(sourceClearX - rawSourceClearX) > SPLICE_PATH_EPS
  ) {
    fetch("http://127.0.0.1:7727/ingest/3e400e45-f78e-432b-aa58-25cbace8ef56", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "ca41b3",
      },
      body: JSON.stringify({
        sessionId: "ca41b3",
        runId: "user-repro",
        hypothesisId: "H5-source-bend-clamp-collapses-lanes",
        location: "spliceEdgeRouting.ts:sourceHorizWaypoints",
        message: "Source bend X clamped to midX boundary",
        data: {
          sourceX,
          midX,
          sourceBendX,
          rawSourceClearX,
          sourceClearX,
          inward,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion
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
  const leftPoints = parseOrthogonalPathPoints(leftPath);
  const leftHasDiagonal = leftPoints.some((point, index) => {
    if (index === 0) return false;
    const prev = leftPoints[index - 1]!;
    return (
      Math.abs(point.x - prev.x) > SPLICE_PATH_EPS &&
      Math.abs(point.y - prev.y) > SPLICE_PATH_EPS
    );
  });
  const includesMidWaypoint = horizXs.some(
    (x) => Math.abs(x - midX) <= SPLICE_PATH_EPS,
  );

  // #region agent log
  if (
    _sideHoriz !== undefined &&
    ((Number.isFinite(_sideHoriz.sourceHorizY) &&
      Math.abs((_sideHoriz.sourceHorizY ?? sourceY) - sourceY) >
        SPLICE_PATH_EPS) ||
      (Number.isFinite(_sideHoriz.targetHorizY) &&
        Math.abs((_sideHoriz.targetHorizY ?? targetY) - targetY) >
          SPLICE_PATH_EPS))
  ) {
    fetch("http://127.0.0.1:7727/ingest/3e400e45-f78e-432b-aa58-25cbace8ef56", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "ca41b3",
      },
      body: JSON.stringify({
        sessionId: "ca41b3",
        runId: "user-repro",
        hypothesisId: "H7-side-horiz-offsets-not-applied",
        location: "spliceEdgeRouting.ts:buildDemarcatedSplicePaths",
        message: "Path received side horizontal offsets but draws on handle Y",
        data: {
          sourceY,
          targetY,
          sourceHorizY: _sideHoriz.sourceHorizY,
          targetHorizY: _sideHoriz.targetHorizY,
          sourceBendX: _sideHoriz.sourceBendX,
          targetBendX: _sideHoriz.targetBendX,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  // #region agent log
  if (
    Math.abs(sourceY - targetY) > SPLICE_PATH_EPS &&
    (leftHasDiagonal || !includesMidWaypoint)
  ) {
    fetch("http://127.0.0.1:7727/ingest/3e400e45-f78e-432b-aa58-25cbace8ef56", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "ca41b3",
      },
      body: JSON.stringify({
        sessionId: "ca41b3",
        runId: "user-repro",
        hypothesisId: "H1-mid-waypoint-drop-creates-diagonal",
        location: "spliceEdgeRouting.ts:buildDemarcatedSplicePaths",
        message: "Demarcated path produced diagonal or skipped mid waypoint",
        data: {
          sourceX,
          sourceY,
          targetX,
          targetY,
          midX,
          jogX,
          spliceY,
          includesMidWaypoint,
          leftHasDiagonal,
          horizXs,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

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

export type MidXLaneCandidate = {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  rowOffset: number;
  /** Same source buffer tube + target cable — lanes stay contiguous. */
  tubeBundleKey?: string;
  /** Collapsed full-butt-splice tube — no Y-track deconflict (≤2 bends). */
  fullButtSplice?: boolean;
  sourceTagWidth?: number;
  targetTagWidth?: number;
};

function clampMidXForCandidate(
  midX: number,
  candidate: MidXLaneCandidate,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
): number {
  return clampMidXForMinHorizontalInset(
    midX,
    candidate.sourceX,
    candidate.targetX,
    diagramCenterX,
    sideSpans,
    MIN_SPLICE_HORIZONTAL_INSET,
    candidate.sourceTagWidth ?? 0,
    candidate.targetTagWidth ?? 0,
    true,
    true,
  );
}

/** Ring-cut visual instances (`~1`, `~2`) share one route bundle. */
export function normalizeVisualCableIdForRouting(visualCableId: string): string {
  return visualCableId.replace(/~\d+$/, "");
}

/** Route bundle = one source buffer tube → one target cable. */
export function spliceTubeBundleKey(
  sourceVisualCableId: string,
  sourceTubeColor: string,
  targetVisualCableId: string,
): string {
  return `${normalizeVisualCableIdForRouting(sourceVisualCableId)}|${sourceTubeColor}|${normalizeVisualCableIdForRouting(targetVisualCableId)}`;
}

function bundleKeyForCandidate(candidate: MidXLaneCandidate): string {
  return candidate.tubeBundleKey ?? candidate.id;
}

function groupCandidatesByTubeBundle(
  candidates: MidXLaneCandidate[],
): MidXLaneCandidate[][] {
  const byBundle = new Map<string, MidXLaneCandidate[]>();
  for (const candidate of candidates) {
    const key = bundleKeyForCandidate(candidate);
    const list = byBundle.get(key) ?? [];
    list.push(candidate);
    byBundle.set(key, list);
  }

  const bundles = [...byBundle.values()];
  bundles.sort((a, b) => {
    const minA = Math.min(...a.map((member) => member.rowOffset));
    const minB = Math.min(...b.map((member) => member.rowOffset));
    return (
      minA - minB ||
      a[0]!.sourceY - b[0]!.sourceY ||
      bundleKeyForCandidate(a[0]!).localeCompare(bundleKeyForCandidate(b[0]!))
    );
  });
  for (const bundle of bundles) {
    bundle.sort(
      (a, b) =>
        a.rowOffset - b.rowOffset ||
        a.sourceY - b.sourceY ||
        a.id.localeCompare(b.id),
    );
  }
  return bundles;
}

function flattenTubeBundleOrder(
  candidates: MidXLaneCandidate[],
): MidXLaneCandidate[] {
  return groupCandidatesByTubeBundle(candidates).flat();
}

function sortCandidatesByRowOrder(
  candidates: MidXLaneCandidate[],
): MidXLaneCandidate[] {
  return [...candidates].sort(
    (a, b) =>
      a.rowOffset - b.rowOffset ||
      a.sourceY - b.sourceY ||
      a.targetY - b.targetY ||
      a.id.localeCompare(b.id),
  );
}

/** One bend-direction class per tube bundle — top fiber pair decides for the group. */
export function bundleMidOrderInverts(members: MidXLaneCandidate[]): boolean {
  const anchor = sortCandidatesByRowOrder(members)[0];
  if (!anchor) return false;
  return spliceMidOrderInverts(
    anchor.sourceX,
    anchor.sourceY,
    anchor.targetX,
    anchor.targetY,
  );
}

/** True when every member shares the same spliceMidOrderInverts result. */
function bundleMidOrderInvertsUniform(members: MidXLaneCandidate[]): boolean {
  const sorted = sortCandidatesByRowOrder(members);
  if (sorted.length === 0) return false;
  const anchor = sorted[0]!;
  const anchorInverts = spliceMidOrderInverts(
    anchor.sourceX,
    anchor.sourceY,
    anchor.targetX,
    anchor.targetY,
  );
  return sorted.every((member) =>
    spliceMidOrderInverts(
      member.sourceX,
      member.sourceY,
      member.targetX,
      member.targetY,
    ) === anchorInverts,
  );
}

function isCoherentTubeBundle(members: MidXLaneCandidate[]): boolean {
  return members.length > 1 && members.every((m) => m.tubeBundleKey);
}

function packAnchorStart(
  candidates: MidXLaneCandidate[],
  laneCount: number,
  sep: number,
  packLo: number,
  packHi: number,
  globalMaxRowOffset?: number,
): number {
  const localMax = candidates.reduce((m, c) => Math.max(m, c.rowOffset), 0);
  const maxRowOffsetForIdeal = Math.max(globalMaxRowOffset ?? 0, localMax);
  const idealMidXs = candidates.map((c) =>
    idealSpliceMidXFromRowOffset(c, maxRowOffsetForIdeal),
  );
  const sortedIdeals = [...idealMidXs].sort((a, b) => a - b);
  let medianIdeal: number;
  if (sortedIdeals.length === 0) {
    medianIdeal = (packLo + packHi) / 2;
  } else if (sortedIdeals.length % 2 === 0) {
    const mid = sortedIdeals.length / 2;
    medianIdeal = (sortedIdeals[mid - 1]! + sortedIdeals[mid]!) / 2;
  } else {
    medianIdeal = sortedIdeals[Math.floor(sortedIdeals.length / 2)]!;
  }
  const totalSpan = (laneCount - 1) * sep;
  const startUnclamped = medianIdeal - totalSpan / 2;
  const packSpan = Math.max(0, packHi - packLo);
  const startMin = packLo;
  const startMax = packLo + Math.max(0, packSpan - totalSpan);
  return Math.min(Math.max(startUnclamped, startMin), startMax);
}

function tubeBundleSpansZones(members: MidXLaneCandidate[]): boolean {
  const zones = new Set(
    members.map((member) => spliceRoutingZoneKey(member.sourceX, member.targetX)),
  );
  return zones.size > 1;
}

/** Left/right cable columns for a tube bundle — row-aligned handles can differ per fiber. */
function bundleRoutingColumnBounds(members: MidXLaneCandidate[]): {
  sourceX: number;
  targetX: number;
} {
  return {
    sourceX: Math.min(...members.map((member) => member.sourceX)),
    targetX: Math.max(...members.map((member) => member.targetX)),
  };
}

/** Row-offset order preserved — one vertical elbow column per tube bundle. */
function packCoherentTubeBundleMidXLanes(
  members: MidXLaneCandidate[],
  minSep: number,
  centerX: number,
  sideSpans: SideCircuitLabelSpan,
  globalMaxRowOffset?: number,
  packLo?: number,
  packHi?: number,
): Map<string, number> {
  const result = new Map<string, number>();
  const sorted = sortCandidatesByRowOrder(members);
  if (sorted.length === 0) return result;

  const { sourceX, targetX } = bundleRoutingColumnBounds(sorted);
  const bounds = spliceRoutingBounds(sourceX, targetX);
  const insetBounds = spliceMidXInsetBounds(
    sourceX,
    targetX,
    centerX,
    sideSpans,
  );
  const lo = packLo ?? Math.max(bounds.lo, insetBounds.lo);
  const hi =
    packHi ??
    Math.min(
      bounds.hi,
      insetBounds.hi <= insetBounds.lo ? bounds.hi : insetBounds.hi,
    );
  const effectiveLo = lo <= hi ? lo : bounds.lo;
  const effectiveHi = lo <= hi ? hi : bounds.hi;

  if (sorted.length === 1) {
    const only = sorted[0]!;
    const maxRowOffset = Math.max(0, only.rowOffset);
    const raw = idealSpliceMidXFromRowOffset(only, maxRowOffset);
    result.set(
      only.id,
      clampMidXForMinHorizontalInset(
        raw,
        only.sourceX,
        only.targetX,
        centerX,
        sideSpans,
      ),
    );
    return result;
  }

  const sep = minSep;
  const rawStart = packAnchorStart(
    sorted,
    sorted.length,
    sep,
    effectiveLo,
    effectiveHi,
    globalMaxRowOffset,
  );
  const start = clampMidXForMinHorizontalInset(
    rawStart,
    sourceX,
    targetX,
    centerX,
    sideSpans,
  );

  const inverts =
    bundleMidOrderInvertsUniform(sorted) && bundleMidOrderInverts(sorted);
  for (let i = 0; i < sorted.length; i++) {
    const laneIndex = inverts ? sorted.length - 1 - i : i;
    result.set(sorted[i]!.id, start + laneIndex * sep);
  }
  return result;
}

function packMultipleCoherentTubeBundlesMidXLanes(
  bundles: MidXLaneCandidate[][],
  minSep: number,
  centerX: number,
  sideSpans: SideCircuitLabelSpan,
  packLo: number,
  packHi: number,
): Map<string, number> {
  const result = new Map<string, number>();
  const orderedBundles = [...bundles].sort((a, b) => {
    const minA = Math.min(...a.map((m) => m.rowOffset));
    const minB = Math.min(...b.map((m) => m.rowOffset));
    return minA - minB;
  });

  const blockSpans = orderedBundles.map((bundle) =>
    Math.max(0, bundle.length - 1) * minSep,
  );
  const gapCount = Math.max(0, orderedBundles.length - 1);
  const totalSpan =
    blockSpans.reduce((sum, span) => sum + span, 0) + gapCount * minSep;
  const packSpan = Math.max(0, packHi - packLo);
  let blockStart = packLo + Math.max(0, (packSpan - totalSpan) / 2);

  for (let bi = 0; bi < orderedBundles.length; bi++) {
    const sorted = sortCandidatesByRowOrder(orderedBundles[bi]!);
    const { sourceX, targetX } = bundleRoutingColumnBounds(sorted);
    const start = clampMidXForMinHorizontalInset(
      blockStart,
      sourceX,
      targetX,
      centerX,
      sideSpans,
    );
    const inverts =
      bundleMidOrderInvertsUniform(sorted) && bundleMidOrderInverts(sorted);
    for (let i = 0; i < sorted.length; i++) {
      const laneIndex = inverts ? sorted.length - 1 - i : i;
      result.set(sorted[i]!.id, start + laneIndex * minSep);
    }
    blockStart = start + blockSpans[bi]! + minSep;
  }

  return result;
}

function sameSideLoopBundleSkipsJogX(members: MidXLaneCandidate[]): boolean {
  if (!isCoherentTubeBundle(members)) return false;
  const sorted = sortCandidatesByRowOrder(members);
  if (!isSameColumnSplice(sorted[0]!.sourceX, sorted[0]!.targetX)) return false;
  if (!bundleMidOrderInvertsUniform(sorted)) return false;
  return bundleMidOrderInverts(sorted);
}

function bundleJogXForMembers(
  members: Array<{ midX: number; sourceX: number }>,
  diagramCenterX: number,
): number | undefined {
  if (members.length <= 1) return undefined;
  const sourceX = members[0]!.sourceX;
  const inwardIsIncreasingX =
    inwardSignForColumn(sourceX, diagramCenterX) > 0;
  const midXs = members.map((member) => member.midX);
  // Trunk = least-inward midX (closest to source). Strands fan from trunk
  // OUTWARD toward their own midX, in the same direction as the source-side H.
  // The fan-out collapses visually with the main H into one clean elbow.
  // Inverting this (trunk = most-inward) creates a "loop-back" where strands
  // overshoot their target X then double back.
  return inwardIsIncreasingX ? Math.min(...midXs) : Math.max(...midXs);
}

/** Group edges that share the same cable-column routing span. */
export function spliceRoutingZoneKey(
  sourceX: number,
  targetX: number,
): string {
  return `${Math.round(sourceX)}::${Math.round(targetX)}`;
}

export function idealSpliceMidXFromRowOffset(
  candidate: MidXLaneCandidate,
  maxRowOffset: number,
): number {
  return spliceMidXFromRowOffset(
    candidate.sourceX,
    candidate.targetX,
    candidate.rowOffset,
    maxRowOffset,
    candidate.sourceY,
    candidate.targetY,
  );
}

/**
 * Assign distinct midX lanes with at least `minSep` center-to-center spacing.
 * Preserves buffer-tube row-offset order within each splice direction group,
 * then spreads mixed-direction crossover bundles across the full center span.
 */
function globalDiagramCenterX(candidates: MidXLaneCandidate[]): number {
  if (candidates.length === 0) return 0;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    minX = Math.min(minX, candidate.sourceX, candidate.targetX);
    maxX = Math.max(maxX, candidate.sourceX, candidate.targetX);
  }
  return (minX + maxX) / 2;
}

function packSameSideMidXLanes(
  candidates: MidXLaneCandidate[],
  minSep: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
): Map<string, number> {
  const result = new Map<string, number>();
  if (candidates.length === 0) return result;

  const sourceX = candidates[0]!.sourceX;
  const targetX = candidates[0]!.targetX;
  const columnX = (sourceX + targetX) / 2;
  const inward = inwardSignForColumn(columnX, diagramCenterX);
  const sep = minSep;

  if (candidates.length === 1) {
    const only = candidates[0]!;
    const raw = inwardAnchorFromColumn(columnX, diagramCenterX, sideSpans);
    result.set(
      only.id,
      clampMidXForMinHorizontalInset(
        raw,
        only.sourceX,
        only.targetX,
        diagramCenterX,
        sideSpans,
      ),
    );
    return result;
  }

  const bundles = groupCandidatesByTubeBundle(candidates);
  if (bundles.length === 1 && isCoherentTubeBundle(bundles[0]!)) {
    const sorted = sortCandidatesByRowOrder(bundles[0]!);
    if (bundleMidOrderInvertsUniform(sorted)) {
      const downwardLoop = bundleMidOrderInverts(sorted);
      const baseRun =
        circuitLabelSpanForSide(
          canvasSideForHandle(columnX, diagramCenterX),
          sideSpans,
        ) + MIN_SPLICE_HORIZONTAL_INSET;
      const base = columnX + inward * baseRun;
      for (let i = 0; i < sorted.length; i++) {
        const laneIndex = downwardLoop ? i : sorted.length - 1 - i;
        const raw = base + inward * laneIndex * sep;
        const candidate = sorted[i]!;
        result.set(
          candidate.id,
          clampMidXForMinHorizontalInset(
            raw,
            candidate.sourceX,
            candidate.targetX,
            diagramCenterX,
            sideSpans,
          ),
        );
      }
      return result;
    }
  }

  const downward: MidXLaneCandidate[] = [];
  const upward: MidXLaneCandidate[] = [];

  for (const candidate of candidates) {
    if (
      spliceMidOrderInverts(
        candidate.sourceX,
        candidate.sourceY,
        candidate.targetX,
        candidate.targetY,
      )
    ) {
      downward.push(candidate);
    } else {
      upward.push(candidate);
    }
  }

  downward.sort((a, b) => a.rowOffset - b.rowOffset);
  upward.sort((a, b) => a.rowOffset - b.rowOffset);
  const downwardOrdered = flattenTubeBundleOrder(downward);
  const upwardOrdered = flattenTubeBundleOrder(upward);

  const baseRun =
    circuitLabelSpanForSide(
      canvasSideForHandle(columnX, diagramCenterX),
      sideSpans,
    ) + MIN_SPLICE_HORIZONTAL_INSET;
  const base = columnX + inward * baseRun;

  for (let i = 0; i < upwardOrdered.length; i++) {
    const raw = base + inward * i * sep;
    result.set(
      upwardOrdered[i]!.id,
      clampMidXForMinHorizontalInset(
        raw,
        upwardOrdered[i]!.sourceX,
        upwardOrdered[i]!.targetX,
        diagramCenterX,
        sideSpans,
      ),
    );
  }
  for (let i = 0; i < downwardOrdered.length; i++) {
    const slot = upwardOrdered.length + downwardOrdered.length - 1 - i;
    const raw = base + inward * slot * sep;
    result.set(
      downwardOrdered[i]!.id,
      clampMidXForMinHorizontalInset(
        raw,
        downwardOrdered[i]!.sourceX,
        downwardOrdered[i]!.targetX,
        diagramCenterX,
        sideSpans,
      ),
    );
  }

  return result;
}

export function packMidXLanes(
  candidates: MidXLaneCandidate[],
  minSep = SPLICE_LANE_SEP,
  diagramCenterX?: number,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  /**
   * Optional global max row offset across the diagram. Cross-side packing
   * uses it to anchor each zone's bundle at its row-offset-proportional
   * position along the routing span, so zones with low row offsets sit
   * near source and zones with high row offsets sit near target. Defaults
   * to the per-zone max (back-compat for direct callers/tests).
   */
  globalMaxRowOffset?: number,
): Map<string, number> {
  const result = new Map<string, number>();
  if (candidates.length === 0) return result;

  const sourceX = candidates[0]!.sourceX;
  const targetX = candidates[0]!.targetX;
  const { lo, hi } = spliceRoutingBounds(sourceX, targetX);
  const sameSide = isSameColumnSplice(sourceX, targetX);
  const centerX = diagramCenterX ?? globalDiagramCenterX(candidates);

  if (sameSide) {
    return packSameSideMidXLanes(candidates, minSep, centerX, sideSpans);
  }

  if (candidates.length === 1) {
    const only = candidates[0]!;
    const maxRowOffset = Math.max(0, only.rowOffset);
    const raw = idealSpliceMidXFromRowOffset(only, maxRowOffset);
    result.set(
      only.id,
      clampMidXForMinHorizontalInset(
        raw,
        only.sourceX,
        only.targetX,
        centerX,
        sideSpans,
      ),
    );
    return result;
  }

  const insetBounds = spliceMidXInsetBounds(
    sourceX,
    targetX,
    centerX,
    sideSpans,
  );
  const insetLo = Math.max(lo, insetBounds.lo);
  const insetHi = Math.min(hi, insetBounds.hi);
  const packLo = insetLo <= insetHi ? insetLo : lo;
  const packHi = insetLo <= insetHi ? insetHi : hi;

  const bundles = groupCandidatesByTubeBundle(candidates);
  const coherentBundles = bundles.filter((bundle) => isCoherentTubeBundle(bundle));
  if (
    coherentBundles.length === 1 &&
    coherentBundles[0]!.length === candidates.length
  ) {
    return packCoherentTubeBundleMidXLanes(
      candidates,
      minSep,
      centerX,
      sideSpans,
      globalMaxRowOffset,
      packLo,
      packHi,
    );
  }
  if (coherentBundles.length >= 2) {
    return packMultipleCoherentTubeBundlesMidXLanes(
      coherentBundles,
      minSep,
      centerX,
      sideSpans,
      packLo,
      packHi,
    );
  }

  const downward: MidXLaneCandidate[] = [];
  const upward: MidXLaneCandidate[] = [];

  for (const candidate of candidates) {
    if (
      spliceMidOrderInverts(
        candidate.sourceX,
        candidate.sourceY,
        candidate.targetX,
        candidate.targetY,
      )
    ) {
      downward.push(candidate);
    } else {
      upward.push(candidate);
    }
  }

  downward.sort((a, b) => a.rowOffset - b.rowOffset);
  upward.sort((a, b) => a.rowOffset - b.rowOffset);
  const downwardOrdered = flattenTubeBundleOrder(downward);
  const upwardOrdered = flattenTubeBundleOrder(upward);

  const laneCount = downwardOrdered.length + upwardOrdered.length;
  const packSpan = Math.max(0, packHi - packLo);

  // Tight 24px bundle — keeps grouped strands visually together.
  const sep = minSep;
  const totalSpan = (laneCount - 1) * sep;

  // Anchor at the median ROW-OFFSET-PROPORTIONAL ideal midX. Each strand's
  // ideal sits at sourceX + (targetX - sourceX) * (rowOffset / globalMax),
  // so bundles with low row offsets (top tubes/cables) anchor near source
  // and bundles with high row offsets (bottom tubes/cables) anchor near
  // target. The full center span gets used; bundles spread across the
  // canvas instead of all crowding the band midpoint.
  const localMax = candidates.reduce(
    (m, c) => Math.max(m, c.rowOffset),
    0,
  );
  const maxRowOffsetForIdeal = Math.max(globalMaxRowOffset ?? 0, localMax);
  const idealMidXs = candidates.map((c) =>
    idealSpliceMidXFromRowOffset(c, maxRowOffsetForIdeal),
  );
  const sortedIdeals = [...idealMidXs].sort((a, b) => a - b);
  let medianIdeal: number;
  if (sortedIdeals.length === 0) {
    medianIdeal = (packLo + packHi) / 2;
  } else if (sortedIdeals.length % 2 === 0) {
    const mid = sortedIdeals.length / 2;
    medianIdeal = (sortedIdeals[mid - 1]! + sortedIdeals[mid]!) / 2;
  } else {
    medianIdeal = sortedIdeals[Math.floor(sortedIdeals.length / 2)]!;
  }
  const startUnclamped = medianIdeal - totalSpan / 2;
  const startMin = packLo;
  const startMax = packLo + Math.max(0, packSpan - totalSpan);
  const start = Math.min(Math.max(startUnclamped, startMin), startMax);

  for (let i = 0; i < upwardOrdered.length; i++) {
    const raw = start + i * sep;
    result.set(
      upwardOrdered[i]!.id,
      clampMidXForMinHorizontalInset(
        raw,
        upwardOrdered[i]!.sourceX,
        upwardOrdered[i]!.targetX,
        centerX,
        sideSpans,
      ),
    );
  }
  for (let i = 0; i < downwardOrdered.length; i++) {
    const slot = upwardOrdered.length + downwardOrdered.length - 1 - i;
    const raw = start + slot * sep;
    result.set(
      downwardOrdered[i]!.id,
      clampMidXForMinHorizontalInset(
        raw,
        downwardOrdered[i]!.sourceX,
        downwardOrdered[i]!.targetX,
        centerX,
        sideSpans,
      ),
    );
  }

  return result;
}

function enforceDistinctMidXLanesForMembers(
  result: Map<string, number>,
  members: MidXLaneCandidate[],
  minSep: number,
): void {
  const sorted = sortCandidatesByRowOrder(members);
  if (sorted.length === 0) return;
  const firstMid = result.get(sorted[0]!.id)!;
  const secondMid =
    sorted.length > 1 ? result.get(sorted[1]!.id)! : firstMid;
  const descending = secondMid < firstMid - SPLICE_PATH_EPS;

  if (descending) {
    let prevMid = firstMid;
    for (let i = 1; i < sorted.length; i++) {
      const id = sorted[i]!.id;
      let mid = result.get(id)!;
      if (prevMid - mid < minSep - SPLICE_PATH_EPS) {
        mid = prevMid - minSep;
        result.set(id, mid);
      }
      prevMid = mid;
    }
    return;
  }

  let prevMid = firstMid;
  for (let i = 1; i < sorted.length; i++) {
    const id = sorted[i]!.id;
    let mid = result.get(id)!;
    if (mid - prevMid < minSep - SPLICE_PATH_EPS) {
      mid = prevMid + minSep;
      result.set(id, mid);
    }
    prevMid = mid;
  }
}

function enforceDistinctMidXLanes(
  result: Map<string, number>,
  candidates: MidXLaneCandidate[],
  minSep: number,
): void {
  const byZone = new Map<string, MidXLaneCandidate[]>();
  for (const candidate of candidates) {
    const key = spliceRoutingZoneKey(candidate.sourceX, candidate.targetX);
    const list = byZone.get(key) ?? [];
    list.push(candidate);
    byZone.set(key, list);
  }

  for (const group of byZone.values()) {
    const bundles = groupCandidatesByTubeBundle(group);
    const bundledIds = new Set<string>();

    for (const bundle of bundles) {
      if (bundle.length > 1 && isCoherentTubeBundle(bundle)) {
        enforceDistinctMidXLanesForMembers(result, bundle, minSep);
        for (const member of bundle) {
          bundledIds.add(member.id);
        }
      }
    }

    const remainder = group.filter((c) => !bundledIds.has(c.id));
    if (remainder.length > 0) {
      enforceDistinctMidXLanesForMembers(result, remainder, minSep);
    }
  }
}

/** Packed midX per cable-column zone — enforces MIN_FIBER_LINE_GAP in center lanes. */
export function assignSpliceMidXLanes(
  candidates: MidXLaneCandidate[],
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
): Map<string, number> {
  const diagramCenterX = globalDiagramCenterX(candidates);

  // Global max row offset across all candidates — threaded into per-zone
  // packing so each zone's bundle anchors at its row-offset-proportional
  // position along the routing span (zones with low row offsets sit near
  // source; high row offsets sit near target).
  const globalMaxRowOffset = candidates.reduce(
    (m, c) => Math.max(m, c.rowOffset),
    0,
  );

  const result = new Map<string, number>();
  const prepackedIds = new Set<string>();

  // Dominant-pair row alignment can place fibers from one buffer tube on
  // different handle X columns. Pack those bundles once globally so midX
  // order stays contiguous in color/row-offset order.
  const splitZoneBundles = groupCandidatesByTubeBundle(
    candidates.filter((candidate) => candidate.tubeBundleKey),
  ).filter(
    (bundle) => isCoherentTubeBundle(bundle) && tubeBundleSpansZones(bundle),
  );

  for (const bundle of splitZoneBundles) {
    const packed = packCoherentTubeBundleMidXLanes(
      bundle,
      SPLICE_LANE_SEP,
      diagramCenterX,
      sideSpans,
      globalMaxRowOffset,
    );
    for (const [id, midX] of packed) {
      result.set(id, midX);
      prepackedIds.add(id);
    }
  }

  const byZone = new Map<string, MidXLaneCandidate[]>();
  for (const candidate of candidates) {
    if (prepackedIds.has(candidate.id)) continue;
    const key = spliceRoutingZoneKey(candidate.sourceX, candidate.targetX);
    const list = byZone.get(key) ?? [];
    list.push(candidate);
    byZone.set(key, list);
  }

  for (const group of byZone.values()) {
    const packed = packMidXLanes(
      group,
      SPLICE_LANE_SEP,
      diagramCenterX,
      sideSpans,
      globalMaxRowOffset,
    );
    enforceDistinctMidXLanes(packed, group, SPLICE_LANE_SEP);
    for (const [id, midX] of packed) {
      result.set(id, midX);
    }
  }

  for (const bundle of groupCandidatesByTubeBundle(
    candidates.filter((candidate) => candidate.tubeBundleKey),
  )) {
    if (isCoherentTubeBundle(bundle)) {
      enforceDistinctMidXLanesForMembers(result, bundle, SPLICE_LANE_SEP);
    }
  }

  return result;
}

function verticalSpanOverlaps(
  y0A: number,
  y1A: number,
  y0B: number,
  y1B: number,
): boolean {
  const loA = Math.min(y0A, y1A);
  const hiA = Math.max(y0A, y1A);
  const loB = Math.min(y0B, y1B);
  const hiB = Math.max(y0B, y1B);
  return loA <= hiB + SPLICE_PATH_EPS && loB <= hiA + SPLICE_PATH_EPS;
}

/**
 * EDGE-012: offset midX when vertical legs would stack on the same X track.
 *
 * Global pass — vertical legs from different routing zones can land at the
 * same X with overlapping Y spans on busy multi-cable diagrams. A single
 * occupied ledger across all candidates prevents cross-zone vertical stack-up.
 */
function vertLanePackBounds(
  sourceX: number,
  targetX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
): { lo: number; hi: number } {
  const routing = spliceRoutingBounds(sourceX, targetX);
  if (routing.span > SPLICE_PATH_EPS) {
    return { lo: routing.lo, hi: routing.hi };
  }
  return spliceMidXInsetBounds(
    sourceX,
    targetX,
    diagramCenterX,
    sideSpans,
  );
}

function assignVertLanesForTubeBundle(
  members: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
  occupied: Array<{ x: number; y0: number; y1: number }>,
): void {
  const sorted = sortCandidatesByRowOrder(members);
  const columnX = (sorted[0]!.sourceX + sorted[0]!.targetX) / 2;
  const inward =
    inwardSignForColumn(columnX, diagramCenterX) > 0 ? 1 : -1;
  const { lo: packLo, hi: packHi } = vertLanePackBounds(
    sorted[0]!.sourceX,
    sorted[0]!.targetX,
    diagramCenterX,
    sideSpans,
  );

  let bundleLaneIndex = 0;
  for (;;) {
    let allClear = true;
    const placements: Array<{
      candidate: MidXLaneCandidate;
      lane: SpliceRoutingLane;
      finalX: number;
      y0: number;
      y1: number;
    }> = [];

    for (const candidate of sorted) {
      const lane = lanes.get(candidate.id)!;
      const xCandidate = lane.midX + inward * bundleLaneIndex * SPLICE_LANE_SEP;
      if (
        xCandidate < packLo - SPLICE_PATH_EPS ||
        xCandidate > packHi + SPLICE_PATH_EPS
      ) {
        allClear = false;
        break;
      }
      const srcHY = lane.sourceHorizY ?? candidate.sourceY;
      const tgtHY = lane.targetHorizY ?? candidate.targetY;
      const spliceY = (candidate.sourceY + candidate.targetY) / 2;
      const y0 = Math.min(srcHY, spliceY, tgtHY);
      const y1 = Math.max(srcHY, spliceY, tgtHY);
      const conflict = occupied.some(
        (existing) =>
          Math.abs(existing.x - xCandidate) <= SPLICE_PATH_EPS &&
          verticalSpanOverlaps(y0, y1, existing.y0, existing.y1),
      );
      if (conflict) {
        allClear = false;
        break;
      }
      placements.push({
        candidate,
        lane,
        finalX: xCandidate,
        y0,
        y1,
      });
    }

    if (allClear) {
      for (const placement of placements) {
        occupied.push({
          x: placement.finalX,
          y0: placement.y0,
          y1: placement.y1,
        });
        if (
          Math.abs(placement.finalX - placement.lane.midX) > SPLICE_PATH_EPS
        ) {
          lanes.set(placement.candidate.id, {
            ...placement.lane,
            midX: placement.finalX,
          });
        }
      }
      return;
    }

    if (bundleLaneIndex > 64) {
      for (let i = 0; i < sorted.length; i++) {
        const candidate = sorted[i]!;
        const lane = lanes.get(candidate.id)!;
        const forcedX = inward > 0
          ? packLo + i * SPLICE_LANE_SEP
          : packHi - i * SPLICE_LANE_SEP;
        const clamped = Math.max(packLo, Math.min(packHi, forcedX));
        const srcHY = lane.sourceHorizY ?? candidate.sourceY;
        const tgtHY = lane.targetHorizY ?? candidate.targetY;
        const spliceY = (candidate.sourceY + candidate.targetY) / 2;
        occupied.push({
          x: clamped,
          y0: Math.min(srcHY, spliceY, tgtHY),
          y1: Math.max(srcHY, spliceY, tgtHY),
        });
        if (Math.abs(clamped - lane.midX) > SPLICE_PATH_EPS) {
          lanes.set(candidate.id, { ...lane, midX: clamped });
        }
      }
      return;
    }

    bundleLaneIndex += 1;
  }
}

/**
 * EDGE-011: assign distinct gap bend X per strand so OS-column vertical legs
 * never stack when Y-offset tracks turn toward center midX.
 */
function assignGapBendLaneXs(
  candidates: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
): void {
  const byZone = new Map<string, MidXLaneCandidate[]>();
  for (const candidate of candidates) {
    if (!lanes.has(candidate.id)) continue;
    const key = spliceRoutingZoneKey(candidate.sourceX, candidate.targetX);
    const list = byZone.get(key) ?? [];
    list.push(candidate);
    byZone.set(key, list);
  }

  const gapOccupied: Array<{ x: number; y0: number; y1: number }> = [];

  for (const group of byZone.values()) {
    const sorted = sortCandidatesByRowOrder(group);
    for (let zoneIndex = 0; zoneIndex < sorted.length; zoneIndex++) {
      const candidate = sorted[zoneIndex]!;
      if (candidate.fullButtSplice) continue;
      const lane = lanes.get(candidate.id)!;
      const srcHY = lane.sourceHorizY ?? candidate.sourceY;
      const tgtHY = lane.targetHorizY ?? candidate.targetY;
      const sourceOffsetY =
        Math.abs(srcHY - candidate.sourceY) > SPLICE_PATH_EPS;
      const targetOffsetY =
        Math.abs(tgtHY - candidate.targetY) > SPLICE_PATH_EPS;
      const nextLane: SpliceRoutingLane = { ...lane };

      if (sourceOffsetY) {
        let placedX: number | undefined;
        for (let attempt = 0; attempt <= 64; attempt++) {
          const bendX = laneClearXBeforeVertical(
            candidate.sourceX,
            lane.midX,
            candidate.sourceY,
            srcHY,
            diagramCenterX,
            sideSpans,
            0,
            MIN_SPLICE_HORIZONTAL_INSET,
            zoneIndex + attempt,
          );
          const y0 = Math.min(candidate.sourceY, srcHY);
          const y1 = Math.max(candidate.sourceY, srcHY);
          const conflict = gapOccupied.some(
            (existing) =>
              Math.abs(existing.x - bendX) <= SPLICE_PATH_EPS &&
              verticalSpanOverlaps(y0, y1, existing.y0, existing.y1),
          );
          if (!conflict) {
            placedX = bendX;
            gapOccupied.push({ x: bendX, y0, y1 });
            break;
          }
        }
        nextLane.sourceBendX =
          placedX ??
          laneClearXBeforeVertical(
            candidate.sourceX,
            lane.midX,
            candidate.sourceY,
            srcHY,
            diagramCenterX,
            sideSpans,
            0,
            MIN_SPLICE_HORIZONTAL_INSET,
            zoneIndex,
          );
      }

      if (targetOffsetY) {
        let placedX: number | undefined;
        for (let attempt = 0; attempt <= 64; attempt++) {
          const bendX = laneClearXBeforeVertical(
            candidate.targetX,
            lane.midX,
            candidate.targetY,
            tgtHY,
            diagramCenterX,
            sideSpans,
            0,
            MIN_SPLICE_HORIZONTAL_INSET,
            zoneIndex + attempt,
          );
          const y0 = Math.min(candidate.targetY, tgtHY);
          const y1 = Math.max(candidate.targetY, tgtHY);
          const conflict = gapOccupied.some(
            (existing) =>
              Math.abs(existing.x - bendX) <= SPLICE_PATH_EPS &&
              verticalSpanOverlaps(y0, y1, existing.y0, existing.y1),
          );
          if (!conflict) {
            placedX = bendX;
            gapOccupied.push({ x: bendX, y0, y1 });
            break;
          }
        }
        nextLane.targetBendX =
          placedX ??
          laneClearXBeforeVertical(
            candidate.targetX,
            lane.midX,
            candidate.targetY,
            tgtHY,
            diagramCenterX,
            sideSpans,
            0,
            MIN_SPLICE_HORIZONTAL_INSET,
            zoneIndex,
          );
      }

      if (
        nextLane.sourceBendX !== lane.sourceBendX ||
        nextLane.targetBendX !== lane.targetBendX
      ) {
        lanes.set(candidate.id, nextLane);
      }
    }
  }
}

function assignSideVertLaneXs(
  candidates: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  sideSpans: SideCircuitLabelSpan,
): void {
  const eligible = candidates.filter((c) => lanes.has(c.id));
  const diagramCenterX = globalDiagramCenterX(candidates);
  const occupied: Array<{ x: number; y0: number; y1: number }> = [];
  const processed = new Set<string>();

  const bundleGroups = groupCandidatesByTubeBundle(
    eligible.filter((c) => c.tubeBundleKey),
  ).filter((bundle) => bundle.length > 1);

  for (const bundle of bundleGroups.sort((a, b) => {
    const minA = Math.min(...a.map((m) => m.rowOffset));
    const minB = Math.min(...b.map((m) => m.rowOffset));
    return minA - minB;
  })) {
    assignVertLanesForTubeBundle(
      bundle,
      lanes,
      diagramCenterX,
      sideSpans,
      occupied,
    );
    for (const member of bundle) {
      processed.add(member.id);
    }
  }

  const singles = sortCandidatesByRowOrder(
    eligible.filter((c) => !processed.has(c.id)),
  );

  for (const candidate of singles) {
    if (candidate.fullButtSplice) continue;
    const lane = lanes.get(candidate.id)!;
    const srcHY = lane.sourceHorizY ?? candidate.sourceY;
    const tgtHY = lane.targetHorizY ?? candidate.targetY;
    const spliceY = (candidate.sourceY + candidate.targetY) / 2;
    const y0 = Math.min(srcHY, spliceY, tgtHY);
    const y1 = Math.max(srcHY, spliceY, tgtHY);
    const inward =
      inwardSignForColumn(
        (candidate.sourceX + candidate.targetX) / 2,
        diagramCenterX,
      ) > 0
        ? 1
        : -1;

    const { lo: packLo, hi: packHi } = vertLanePackBounds(
      candidate.sourceX,
      candidate.targetX,
      diagramCenterX,
      sideSpans,
    );

    let laneIndex = 0;
    let placedX: number | null = null;
    for (;;) {
      const xCandidate = lane.midX + inward * laneIndex * SPLICE_LANE_SEP;
      if (
        xCandidate < packLo - SPLICE_PATH_EPS ||
        xCandidate > packHi + SPLICE_PATH_EPS
      ) {
        break;
      }
      const conflict = occupied.some(
        (existing) =>
          Math.abs(existing.x - xCandidate) <= SPLICE_PATH_EPS &&
          verticalSpanOverlaps(y0, y1, existing.y0, existing.y1),
      );
      if (!conflict) {
        placedX = xCandidate;
        break;
      }
      laneIndex += 1;
    }

    let finalX = placedX;
    if (finalX === null) {
      for (let forced = laneIndex; forced <= 64; forced++) {
        const xCandidate = inward > 0
          ? packLo + forced * SPLICE_LANE_SEP
          : packHi - forced * SPLICE_LANE_SEP;
        if (
          xCandidate < packLo - SPLICE_PATH_EPS ||
          xCandidate > packHi + SPLICE_PATH_EPS
        ) {
          break;
        }
        const conflict = occupied.some(
          (existing) =>
            Math.abs(existing.x - xCandidate) <= SPLICE_PATH_EPS &&
            verticalSpanOverlaps(y0, y1, existing.y0, existing.y1),
        );
        if (!conflict) {
          finalX = xCandidate;
          break;
        }
      }
    }
    finalX ??= lane.midX;
    occupied.push({ x: finalX, y0, y1 });
    if (Math.abs(finalX - lane.midX) > SPLICE_PATH_EPS) {
      lanes.set(candidate.id, { ...lane, midX: finalX });
    }
  }
}

/** Re-derive rowOffset ranks from live handle Y after cable drag. */
export function recomputeRowOffsetsFromHandleYs(
  entries: Array<{
    id: string;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    tubeBundleKey?: string;
  }>,
): Map<string, number> {
  const byGroup = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = entry.tubeBundleKey?.trim()
      ? `bundle::${entry.tubeBundleKey}`
      : spliceRoutingZoneKey(entry.sourceX, entry.targetX);
    const list = byGroup.get(key) ?? [];
    list.push(entry);
    byGroup.set(key, list);
  }

  const result = new Map<string, number>();
  for (const group of byGroup.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        Math.min(a.sourceY, a.targetY) - Math.min(b.sourceY, b.targetY) ||
        a.sourceY - b.sourceY ||
        a.targetY - b.targetY ||
        a.id.localeCompare(b.id),
    );
    sorted.forEach((entry, index) => {
      result.set(entry.id, index * FIBER_ROW_PITCH);
    });
  }
  return result;
}

/** Packed midX plus optional shared bundle jog trunk per tube bundle. */
export function assignSpliceRoutingLanes(
  candidates: MidXLaneCandidate[],
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
): Map<string, SpliceRoutingLane> {
  const diagramCenterX = globalDiagramCenterX(candidates);
  const midXMap = assignSpliceMidXLanes(candidates, sideSpans);
  for (const candidate of candidates) {
    const raw = midXMap.get(candidate.id);
    if (raw === undefined) continue;
    midXMap.set(
      candidate.id,
      clampMidXForCandidate(raw, candidate, diagramCenterX, sideSpans),
    );
  }
  const result = new Map<string, SpliceRoutingLane>();
  const candidateById = new Map(candidates.map((c) => [c.id, c]));

  for (const candidate of candidates) {
    const midX = midXMap.get(candidate.id);
    if (midX === undefined) continue;
    result.set(candidate.id, { midX });
  }

  assignSideVertLaneXs(candidates, result, sideSpans);

  const byBundle = new Map<
    string,
    Array<{ id: string; midX: number; sourceX: number }>
  >();

  for (const candidate of candidates) {
    const lane = result.get(candidate.id);
    if (!lane || !Number.isFinite(lane.midX)) continue;
    const key = candidate.tubeBundleKey?.trim()
      ? bundleKeyForCandidate(candidate)
      : `${spliceRoutingZoneKey(candidate.sourceX, candidate.targetX)}::${candidate.id}`;
    const list = byBundle.get(key) ?? [];
    list.push({ id: candidate.id, midX: lane.midX, sourceX: candidate.sourceX });
    byBundle.set(key, list);
  }

  for (const members of byBundle.values()) {
    if (members.length <= 1) continue;
    const fullMembers = members
      .map((member) => candidateById.get(member.id))
      .filter((member): member is MidXLaneCandidate => member !== undefined);
    const jogX = sameSideLoopBundleSkipsJogX(fullMembers)
      ? undefined
      : bundleJogXForMembers(members, diagramCenterX);
    for (const member of members) {
      const lane = result.get(member.id);
      if (!lane) continue;
      const laneJogX =
        jogX !== undefined &&
        Number.isFinite(jogX) &&
        Math.abs(lane.midX - jogX) > SPLICE_PATH_EPS
          ? jogX
          : undefined;
      result.set(member.id, { ...lane, jogX: laneJogX });
    }
  }

  for (const candidate of candidates) {
    if (result.has(candidate.id)) continue;
    const midX = midXMap.get(candidate.id);
    if (midX !== undefined) result.set(candidate.id, { midX });
  }

  const buttByZone = new Map<string, MidXLaneCandidate[]>();
  for (const candidate of candidates) {
    if (!candidate.fullButtSplice) continue;
    const key = spliceRoutingZoneKey(candidate.sourceX, candidate.targetX);
    const list = buttByZone.get(key) ?? [];
    list.push(candidate);
    buttByZone.set(key, list);
  }
  for (const group of buttByZone.values()) {
    const sorted = sortCandidatesByRowOrder(group);
    for (let laneIndex = 0; laneIndex < sorted.length; laneIndex++) {
      const candidate = sorted[laneIndex]!;
      if (!result.has(candidate.id)) continue;
      result.set(candidate.id, {
        midX: resolveButtSpliceMidX(
          candidate.sourceX,
          candidate.targetX,
          diagramCenterX,
          sideSpans,
          laneIndex,
          sorted.length,
        ),
      });
    }
  }

  const horizOffsets = assignSideHorizLaneYs(
    candidates,
    result,
    sideSpans,
    diagramCenterX,
  );
  for (const [id, offsets] of horizOffsets) {
    const lane = result.get(id);
    if (!lane) continue;
    result.set(id, { ...lane, ...offsets });
  }

  assignGapBendLaneXs(candidates, result, sideSpans, diagramCenterX);

  return result;
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

function sourceGapHorizSegments(
  sourceX: number,
  sourceY: number,
  midX: number,
  jogX: number | undefined,
  sourceHorizY: number,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
  sourceTagWidth = 0,
): Array<{ kind: "h"; y: number; x0: number; x1: number }> {
  const trunkX = jogX ?? midX;
  const usesBundleJog =
    jogX !== undefined && Math.abs(trunkX - midX) > SPLICE_PATH_EPS;
  const sourceOffsetY = Math.abs(sourceHorizY - sourceY) > SPLICE_PATH_EPS;
  const segments: Array<{ kind: "h"; y: number; x0: number; x1: number }> = [];

  if (sourceOffsetY) {
    const bendX = laneClearXBeforeVertical(
      sourceX,
      midX,
      sourceY,
      sourceHorizY,
      diagramCenterX,
      sideSpans,
      sourceTagWidth,
    );
    if (usesBundleJog) {
      if (Math.abs(trunkX - bendX) > SPLICE_PATH_EPS) {
        segments.push({
          kind: "h" as const,
          y: sourceHorizY,
          x0: bendX,
          x1: trunkX,
        });
      }
      if (Math.abs(midX - trunkX) > SPLICE_PATH_EPS) {
        segments.push({
          kind: "h" as const,
          y: sourceHorizY,
          x0: trunkX,
          x1: midX,
        });
      }
    } else if (Math.abs(midX - bendX) > SPLICE_PATH_EPS) {
      segments.push({
        kind: "h" as const,
        y: sourceHorizY,
        x0: bendX,
        x1: midX,
      });
    }
    return segments;
  }

  if (Math.abs(midX - sourceX) > SPLICE_PATH_EPS) {
    segments.push({
      kind: "h" as const,
      y: sourceY,
      x0: sourceX,
      x1: midX,
    });
  }
  if (usesBundleJog) {
    if (Math.abs(trunkX - midX) > SPLICE_PATH_EPS) {
      segments.push({
        kind: "h" as const,
        y: sourceY,
        x0: trunkX,
        x1: midX,
      });
    }
  }
  return segments;
}

function targetGapHorizSegments(
  targetX: number,
  targetY: number,
  midX: number,
  targetHorizY: number,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
  targetTagWidth = 0,
): Array<{ kind: "h"; y: number; x0: number; x1: number }> {
  const targetClearX = targetClearXBeforeVertical(
    targetX,
    midX,
    diagramCenterX,
    sideSpans,
    targetTagWidth,
  );
  const targetOffsetY = Math.abs(targetHorizY - targetY) > SPLICE_PATH_EPS;
  if (targetOffsetY) {
    return [{ kind: "h" as const, y: targetHorizY, x0: midX, x1: targetClearX }];
  }
  return [{ kind: "h" as const, y: targetHorizY, x0: midX, x1: targetX }];
}

function sideHorizLaneSign(anchorY: number, diagramCenterY: number): 1 | -1 {
  return anchorY <= diagramCenterY ? 1 : -1;
}

function horizontalSegmentsForLane(
  candidate: MidXLaneCandidate,
  lane: SpliceRoutingLane,
  sourceHorizY: number,
  targetHorizY: number,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
): Array<{ kind: "h"; y: number; x0: number; x1: number }> {
  return [
    ...sourceGapHorizSegments(
      candidate.sourceX,
      candidate.sourceY,
      lane.midX,
      lane.jogX,
      sourceHorizY,
      sideSpans,
      diagramCenterX,
    ),
    ...targetGapHorizSegments(
      candidate.targetX,
      candidate.targetY,
      lane.midX,
      targetHorizY,
      sideSpans,
      diagramCenterX,
    ),
  ];
}

function horizSegmentsOverlapOccupied(
  segments: Array<{ kind: "h"; y: number; x0: number; x1: number }>,
  occupied: Array<{ kind: "h"; y: number; x0: number; x1: number }>,
): boolean {
  return occupied.some((existing) =>
    segments.some((seg) => parallelSpliceSegmentsOverlap(seg, existing)),
  );
}

function horizOffsetsForBundleLane(
  members: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  diagramCenterY: number,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
  sourceLane: number,
  targetLane: number,
): {
  fits: boolean;
  segments: Array<{ kind: "h"; y: number; x0: number; x1: number }>;
  offsetsById: Map<
    string,
    Pick<SpliceRoutingLane, "sourceHorizY" | "targetHorizY">
  >;
} {
  const segments: Array<{ kind: "h"; y: number; x0: number; x1: number }> =
    [];
  const offsetsById = new Map<
    string,
    Pick<SpliceRoutingLane, "sourceHorizY" | "targetHorizY">
  >();

  for (const candidate of members) {
    const lane = lanes.get(candidate.id);
    if (!lane) return { fits: false, segments, offsetsById };
    const sourceSign = sideHorizLaneSign(candidate.sourceY, diagramCenterY);
    const targetSign = sideHorizLaneSign(candidate.targetY, diagramCenterY);
    const sourceHorizY =
      candidate.sourceY + sourceSign * sourceLane * SPLICE_LANE_SEP;
    const targetHorizY =
      candidate.targetY + targetSign * targetLane * SPLICE_LANE_SEP;
    segments.push(
      ...horizontalSegmentsForLane(
        candidate,
        lane,
        sourceHorizY,
        targetHorizY,
        sideSpans,
        diagramCenterX,
      ),
    );
    const offsets: Pick<SpliceRoutingLane, "sourceHorizY" | "targetHorizY"> =
      {};
    if (Math.abs(sourceHorizY - candidate.sourceY) > SPLICE_PATH_EPS) {
      offsets.sourceHorizY = sourceHorizY;
    }
    if (Math.abs(targetHorizY - candidate.targetY) > SPLICE_PATH_EPS) {
      offsets.targetHorizY = targetHorizY;
    }
    if (
      offsets.sourceHorizY !== undefined ||
      offsets.targetHorizY !== undefined
    ) {
      offsetsById.set(candidate.id, offsets);
    }
  }

  return { fits: true, segments, offsetsById };
}

function assignHorizLanesForTubeBundle(
  members: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  diagramCenterY: number,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
  occupied: Array<{ kind: "h"; y: number; x0: number; x1: number }>,
  result: Map<string, Pick<SpliceRoutingLane, "sourceHorizY" | "targetHorizY">>,
): void {
  const sorted = sortCandidatesByRowOrder(members);
  let sourceLane = 0;
  let targetLane = 0;
  let attempts = 0;

  for (;;) {
    if (attempts++ > 64) {
      const fallback = horizOffsetsForBundleLane(
        sorted,
        lanes,
        diagramCenterY,
        sideSpans,
        diagramCenterX,
        0,
        0,
      );
      occupied.push(...fallback.segments);
      for (const [id, offsets] of fallback.offsetsById) {
        result.set(id, offsets);
      }
      return;
    }
    const attempt = horizOffsetsForBundleLane(
      sorted,
      lanes,
      diagramCenterY,
      sideSpans,
      diagramCenterX,
      sourceLane,
      targetLane,
    );
    if (
      attempt.fits &&
      !horizSegmentsOverlapOccupied(attempt.segments, occupied)
    ) {
      occupied.push(...attempt.segments);
      for (const [id, offsets] of attempt.offsetsById) {
        result.set(id, offsets);
      }
      return;
    }

    sourceLane += 1;
    targetLane += 1;
  }
}

/**
 * EDGE-011: stack horizontal tracks at SPLICE_LANE_SEP increments so source-
 * side and target-side H segments never share the same Y at overlapping X.
 *
 * Global pass — horizontals from different routing zones can collide on the
 * same Y over overlapping X ranges in busy multi-cable diagrams. A single
 * occupied ledger across all candidates prevents cross-zone horizontal
 * stack-up.
 */
function assignSideHorizLaneYs(
  candidates: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  diagramCenterX?: number,
): Map<string, Pick<SpliceRoutingLane, "sourceHorizY" | "targetHorizY">> {
  const result = new Map<
    string,
    Pick<SpliceRoutingLane, "sourceHorizY" | "targetHorizY">
  >();
  if (candidates.length === 0) return result;

  const resolvedCenterX =
    diagramCenterX ?? globalDiagramCenterX(candidates);

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    minY = Math.min(minY, candidate.sourceY, candidate.targetY);
    maxY = Math.max(maxY, candidate.sourceY, candidate.targetY);
  }
  const diagramCenterY = (minY + maxY) / 2;

  const eligible = candidates.filter((c) => lanes.has(c.id));
  const occupied: Array<{ kind: "h"; y: number; x0: number; x1: number }> =
    [];
  const processed = new Set<string>();

  const bundleGroups = groupCandidatesByTubeBundle(
    eligible.filter((c) => c.tubeBundleKey),
  ).filter((bundle) => bundle.length > 1);

  for (const bundle of bundleGroups.sort((a, b) => {
    const minA = Math.min(...a.map((m) => m.rowOffset));
    const minB = Math.min(...b.map((m) => m.rowOffset));
    return minA - minB;
  })) {
    if (sameSideLoopBundleSkipsJogX(bundle)) {
      for (const member of bundle) {
        processed.add(member.id);
      }
      continue;
    }
    assignHorizLanesForTubeBundle(
      bundle,
      lanes,
      diagramCenterY,
      sideSpans,
      resolvedCenterX,
      occupied,
      result,
    );
    for (const member of bundle) {
      processed.add(member.id);
    }
  }

  const singles = sortCandidatesByRowOrder(
    eligible.filter((c) => !processed.has(c.id)),
  );

  for (const candidate of singles) {
    if (candidate.fullButtSplice) continue;
    const lane = lanes.get(candidate.id)!;
    const sourceSign = sideHorizLaneSign(candidate.sourceY, diagramCenterY);
    const targetSign = sideHorizLaneSign(candidate.targetY, diagramCenterY);
    let sourceLane = 0;
    let targetLane = 0;
    let attempts = 0;

    for (;;) {
      if (attempts++ > 64) break;
      const sourceHorizY =
        candidate.sourceY + sourceSign * sourceLane * SPLICE_LANE_SEP;
      const targetHorizY =
        candidate.targetY + targetSign * targetLane * SPLICE_LANE_SEP;
      const segments = horizontalSegmentsForLane(
        candidate,
        lane,
        sourceHorizY,
        targetHorizY,
        sideSpans,
        resolvedCenterX,
      );
      if (!horizSegmentsOverlapOccupied(segments, occupied)) {
        occupied.push(...segments);
        const offsets: Pick<
          SpliceRoutingLane,
          "sourceHorizY" | "targetHorizY"
        > = {};
        if (Math.abs(sourceHorizY - candidate.sourceY) > SPLICE_PATH_EPS) {
          offsets.sourceHorizY = sourceHorizY;
        }
        if (Math.abs(targetHorizY - candidate.targetY) > SPLICE_PATH_EPS) {
          offsets.targetHorizY = targetHorizY;
        }
        if (
          offsets.sourceHorizY !== undefined ||
          offsets.targetHorizY !== undefined
        ) {
          result.set(candidate.id, offsets);
        }
        break;
      }

      const sourceSegs = sourceGapHorizSegments(
        candidate.sourceX,
        candidate.sourceY,
        lane.midX,
        lane.jogX,
        sourceHorizY,
        sideSpans,
        resolvedCenterX,
      );
      const targetSegs = targetGapHorizSegments(
        candidate.targetX,
        candidate.targetY,
        lane.midX,
        targetHorizY,
        sideSpans,
        resolvedCenterX,
      );
      const sourceConflict = horizSegmentsOverlapOccupied(sourceSegs, occupied);
      const targetConflict = horizSegmentsOverlapOccupied(targetSegs, occupied);
      if (sourceConflict) sourceLane += 1;
      if (targetConflict) targetLane += 1;
      if (!sourceConflict && !targetConflict) {
        sourceLane += 1;
        targetLane += 1;
      }
    }

    if (attempts > 64) {
      occupied.push(
        ...horizontalSegmentsForLane(
          candidate,
          lane,
          candidate.sourceY,
          candidate.targetY,
          sideSpans,
          resolvedCenterX,
        ),
      );
    }
  }

  return result;
}

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

      // #region agent log
      if (
        !fullButtSplice &&
        Math.abs((dragLane.midX ?? midX) - midX) > SPLICE_PATH_EPS
      ) {
        fetch("http://127.0.0.1:7727/ingest/3e400e45-f78e-432b-aa58-25cbace8ef56", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "ca41b3",
          },
          body: JSON.stringify({
            sessionId: "ca41b3",
            runId: "user-repro",
            hypothesisId: "H4-drag-midX-clamp-causes-angle",
            location: "spliceEdgeRouting.ts:useRoutingLaneIndex.drag",
            message: "Drag lane midX clamped at render",
            data: {
              edgeId,
              sourceX,
              sourceY,
              targetX,
              targetY,
              storedMidX: dragLane.midX,
              renderMidX: midX,
              rowOffset: rowOffset ?? null,
              fallbackLane,
              laneCountHint,
              diagramCenterX: resolvedCenterX,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      // #endregion

      // #region agent log
      if (
        !fullButtSplice &&
        Math.abs((dragLane.midX ?? midX) - midX) > SPLICE_PATH_EPS &&
        rowOffset === undefined
      ) {
        fetch("http://127.0.0.1:7727/ingest/3e400e45-f78e-432b-aa58-25cbace8ef56", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "ca41b3",
          },
          body: JSON.stringify({
            sessionId: "ca41b3",
            runId: "user-repro",
            hypothesisId: "H6-drag-clamp-without-row-offset",
            location: "spliceEdgeRouting.ts:useRoutingLaneIndex.drag",
            message: "Clamped drag lane has undefined rowOffset",
            data: {
              edgeId,
              storedMidX: dragLane.midX,
              renderMidX: midX,
              fallbackLane,
              laneCountHint,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      // #endregion

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
