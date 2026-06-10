import {
  SPLICE_LANE_SEP,
  SPLICE_ROUTING_END_MARGIN,
  MIN_SPLICE_HORIZONTAL_INSET,
  MIN_HORIZONTAL_INSET_FLOOR,
  FIBER_CIRCUIT_MAX_WIDTH,
  SPLICE_HANDLE_OVERHANG,
  fiberCodeColumnWidth,
  CABLE_LAYOUT,
  FIBER_ROW_PITCH,
  fiberRowOffsetInCable,
} from "@/features/diagram/cableLayoutMetrics";
import {
  fixedHandleOutsetFromStem,
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
  rowOffset?: number;
  tubeBundleKey?: string;
};

export type SpliceRoutingLaneData = {
  routingMidX: number;
  routingJogX?: number;
  routingSourceHorizY?: number;
  routingTargetHorizY?: number;
  routingSourceBendX?: number;
  routingTargetBendX?: number;
  diagramCenterX?: number;
};

export type SpliceRoutingLane = {
  midX: number;
  jogX?: number;
  sourceHorizY?: number;
  targetHorizY?: number;
  sourceBendX?: number;
  targetBendX?: number;
};

export type SplicePathResult = {
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
  bendCount: number;
  template: SpliceRouteTemplate;
};

export type SpliceRouteTemplate =
  | "straight"
  | "same_side"
  | "hv_demarcated";
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


/** True when handle X is shared ? same-side splices need an inward center detour. */
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
  const codeCol = fiberCodeColumnWidth();
  const labelRun = codeCol + FIBER_CIRCUIT_MAX_WIDTH;
  return { left: labelRun, right: labelRun };
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

/** Full stem?outer-edge label column (swatch + code + max circuit tag). */
export function labelColumnRunForSide(
  side: "left" | "right",
  sideSpans: SideCircuitLabelSpan,
): number {
  return Math.max(
    circuitLabelSpanForSide(side, sideSpans),
    fiberCodeColumnWidth() + FIBER_CIRCUIT_MAX_WIDTH,
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
  const codeCol = fiberCodeColumnWidth();
  const columnRun = handleAtLabelOuterEdge
    ? labelColumnRunForSide(side, sideSpans)
    : circuitLabelSpanForSide(side, sideSpans);
  if (side === "left") {
    const columnClear = handleAtLabelOuterEdge
      ? handleX - codeCol - tagWidth + columnRun + jog
      : handleX + columnRun + jog;
    return Math.max(handleX + jog, columnClear);
  }
  const columnClear = handleAtLabelOuterEdge
    ? handleX + codeCol + tagWidth - columnRun - jog
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

  // EDGE-009 hard floor ? never place the vertical leg over the OS/fan column.
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
  // Same-column stems: routing margin band is empty ? keep OS clearance.
  return x;
}

/** @deprecated alias ? use enforceMinHorizontalInset */
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

/** Pick route shape from handle coordinates (handle ? handle span). */
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

/** Count 90? direction changes across one or more orthogonal path strings. */
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

/** DOT-003: minimum path distance from fusion dot to the nearest leg corner. */
export const FUSION_DOT_MIN_CORNER_CLEARANCE = 48;

/** Strict EDGE-004: ?2 bends total ? Y-track offsets must not inflate the budget. */
export function maxSpliceBendsForLane(
  _sourceY: number,
  _targetY: number,
  _lane: SpliceRoutingLane,
): number {
  return MAX_SPLICE_BENDS;
}

/**
 * Build handle?handle splice paths with ?2 orthogonal bends.
 * Prefers straight (0) before same-side or cross-side H?V?H (2 each).
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
  options?: FusionDotOptions,
): SplicePathResult {
  const template = pickSpliceRouteTemplate(sourceX, sourceY, targetX, targetY);

  if (template === "straight") {
    const midX = (sourceX + targetX) / 2;
    const { spliceX, spliceY } = resolveFusionDotPosition(
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
      options,
    );
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
    options,
  );
  return {
    ...demarcated,
    bendCount: countOrthogonalBends(demarcated.leftPath, demarcated.rightPath),
    template,
  };
}

/** Explicit H?V?H splice path; each edge owns its vertical at `midX`. */
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
 * Per-lane clear X for Y-track bends ? staggers inward by global gap lane index
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

function horizWaypointsFromStart(
  waypoints: number[],
  startX: number,
  inward: 1 | -1,
): number[] {
  const result: number[] = [];
  let lastX = startX;
  for (const x of waypoints) {
    const delta = x - lastX;
    if (inward > 0 && delta <= SPLICE_PATH_EPS) continue;
    if (inward < 0 && delta >= -SPLICE_PATH_EPS) continue;
    result.push(x);
    lastX = x;
  }
  return result;
}

function appendSourceHorizWaypointsUpTo(
  parts: string[],
  waypoints: number[],
  y: number,
  startX: number,
  stopX: number,
  inward: 1 | -1,
): number {
  let lastX = startX;
  for (const x of waypoints) {
    const pastStop =
      inward > 0
        ? x > stopX + SPLICE_PATH_EPS
        : x < stopX - SPLICE_PATH_EPS;
    if (pastStop) {
      return appendHorizontalPoint(parts, stopX, y, lastX);
    }
    const delta = x - lastX;
    if (inward > 0 && delta <= SPLICE_PATH_EPS) continue;
    if (inward < 0 && delta >= -SPLICE_PATH_EPS) continue;
    lastX = appendHorizontalPoint(parts, x, y, lastX);
  }
  if (Math.abs(stopX - lastX) > SPLICE_PATH_EPS) {
    lastX = appendHorizontalPoint(parts, stopX, y, lastX);
  }
  return lastX;
}

export type FusionDotOptions = {
  tubeDotColumnX?: number;
};

/** DOT-001: fusion dot on the source-side horizontal row before center vertical fan-out. */
export function resolveFusionDotPosition(
  sourceX: number,
  sourceY: number,
  targetX: number,
  _targetY: number,
  midX: number,
  jogX?: number,
  sideHoriz?: Pick<
    SpliceRoutingLane,
    "sourceHorizY" | "targetHorizY" | "sourceBendX" | "targetBendX"
  >,
  _sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  diagramCenterX = (sourceX + targetX) / 2,
  _sourceTagWidth = 0,
  options?: FusionDotOptions,
): { spliceX: number; spliceY: number } {
  const sourceHorizY = sideHoriz?.sourceHorizY ?? sourceY;
  if (options?.tubeDotColumnX !== undefined) {
    return { spliceX: options.tubeDotColumnX, spliceY: sourceHorizY };
  }

  const trunkX = reconcileBundleJogXForRender(
    midX,
    jogX,
    sourceX,
    diagramCenterX,
  );
  const dotX = trunkX ?? midX;
  return { spliceX: dotX, spliceY: sourceHorizY };
}

export function fusionDotLiesOnHorizontal(
  spliceX: number,
  spliceY: number,
  segments: OrthogonalSegment[],
): boolean {
  for (const seg of segments) {
    if (seg.kind !== "h") continue;
    if (Math.abs(seg.y - spliceY) > SPLICE_PATH_EPS) continue;
    const lo = Math.min(seg.x0, seg.x1);
    const hi = Math.max(seg.x0, seg.x1);
    if (spliceX >= lo - SPLICE_PATH_EPS && spliceX <= hi + SPLICE_PATH_EPS) {
      return true;
    }
  }
  return false;
}

type TubeDotReconcileMember = {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourceTubeDotGroupKey?: string;
  fullButtSplice?: boolean;
  sideCircuitSpan?: SideCircuitLabelSpan;
  sourceTagWidth?: number;
};

/** DOT-002: one shared dot column X per source buffer tube group. */
export function reconcileBufferTubeDotColumns(
  entries: TubeDotReconcileMember[],
  lanes: Map<string, SpliceRoutingLane>,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
): Map<string, number> {
  const byGroup = new Map<
    string,
    Array<{ id: string; entry: TubeDotReconcileMember; lane: SpliceRoutingLane }>
  >();

  for (const entry of entries) {
    if (entry.fullButtSplice || !entry.sourceTubeDotGroupKey) continue;
    const lane = lanes.get(entry.id);
    if (!lane) continue;
    const list = byGroup.get(entry.sourceTubeDotGroupKey) ?? [];
    list.push({ id: entry.id, entry, lane });
    byGroup.set(entry.sourceTubeDotGroupKey, list);
  }

  const result = new Map<string, number>();

  for (const members of byGroup.values()) {
    if (members.length < 2) continue;

    const preferred = members.map(({ entry, lane }) =>
      resolveFusionDotPosition(
        entry.sourceX,
        entry.sourceY,
        entry.targetX,
        entry.targetY,
        lane.midX,
        lane.jogX,
        {
          sourceHorizY: lane.sourceHorizY,
          targetHorizY: lane.targetHorizY,
          sourceBendX: lane.sourceBendX,
          targetBendX: lane.targetBendX,
        },
        entry.sideCircuitSpan ?? sideSpans,
        diagramCenterX,
        entry.sourceTagWidth ?? 0,
      ).spliceX,
    );

    const trunks = members
      .map(({ entry, lane }) =>
        reconcileBundleJogXForRender(
          lane.midX,
          lane.jogX,
          entry.sourceX,
          diagramCenterX,
        ),
      )
      .filter((x): x is number => x !== undefined);

    let unified: number;
    if (
      trunks.length === members.length &&
      trunks.every((x) => Math.abs(x - trunks[0]!) <= SPLICE_PATH_EPS)
    ) {
      unified = trunks[0]!;
    } else {
      const anchor = members[0]!.entry;
      const inward = inwardSignForColumn(anchor.sourceX, diagramCenterX);
      // Least-inward X shared by every member's source horizontal span.
      unified =
        inward > 0 ? Math.min(...preferred) : Math.max(...preferred);
    }

    for (const { id } of members) {
      result.set(id, unified);
    }
  }

  return result;
}

function appendVerticalPoint(
  parts: string[],
  x: number,
  y: number,
  lastY: number,
): number {
  if (Math.abs(y - lastY) <= SPLICE_PATH_EPS) return lastY;
  parts.push(`L ${x},${y}`);
  return y;
}

/**
 * Left leg stops at the fusion dot; right leg starts there (different strand colors).
 *
 * EDGE-004: at most two 90? bends handle-to-handle ? route on handle rows only;
 * optional bundle jog uses same-Y horizontals before one center vertical.
 */
export function buildDemarcatedSplicePaths(
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
  options?: FusionDotOptions,
): {
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
} {
  const sourceHorizY = sideHoriz?.sourceHorizY ?? sourceY;
  const targetHorizY = sideHoriz?.targetHorizY ?? targetY;
  const sourceUsesOffset =
    Math.abs(sourceHorizY - sourceY) > SPLICE_PATH_EPS;
  const targetUsesOffset =
    Math.abs(targetHorizY - targetY) > SPLICE_PATH_EPS;
  const routeVertY = (sourceY + targetY) / 2;
  const inward =
    inwardSignForColumn(sourceX, diagramCenterX) > 0 ? (1 as const) : (-1 as const);

  const horizXs = sourceHorizWaypoints(
    sourceX,
    midX,
    jogX,
    diagramCenterX,
    sideSpans,
    sourceTagWidth,
    sideHoriz?.sourceBendX,
  );

  const { spliceX: fusionX, spliceY: fusionY } = resolveFusionDotPosition(
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
    options,
  );

  const hostY = sourceUsesOffset ? sourceHorizY : sourceY;
  const leftParts = [`M ${sourceX},${sourceY}`];
  if (sourceUsesOffset) {
    const bendX =
      horizXs[0] ??
      inwardClearXBeforeVertical(
        sourceX,
        midX,
        diagramCenterX,
        sideSpans,
        sourceTagWidth,
      );
    let lastX = sourceX;
    lastX = appendHorizontalPoint(leftParts, bendX, sourceY, lastX);
    let lastY = sourceY;
    lastY = appendVerticalPoint(leftParts, bendX, sourceHorizY, lastY);
    appendSourceHorizWaypointsUpTo(
      leftParts,
      horizXs,
      sourceHorizY,
      bendX,
      fusionX,
      inward,
    );
  } else {
    appendSourceHorizWaypointsUpTo(
      leftParts,
      horizXs,
      sourceY,
      sourceX,
      fusionX,
      inward,
    );
  }

  const rightParts = [`M ${fusionX},${fusionY}`];
  let lastX = fusionX;
  const remainingHoriz = horizWaypointsFromStart(horizXs, fusionX, inward);
  lastX = appendSourceHorizWaypoints(rightParts, remainingHoriz, hostY, lastX);
  if (Math.abs(midX - lastX) > SPLICE_PATH_EPS) {
    lastX = appendHorizontalPoint(rightParts, midX, hostY, lastX);
  }
  let lastY = hostY;
  lastY = appendVerticalPoint(rightParts, midX, routeVertY, lastY);

  if (targetUsesOffset) {
    const targetBendX =
      sideHoriz?.targetBendX !== undefined &&
      Number.isFinite(sideHoriz.targetBendX)
        ? sideHoriz.targetBendX
        : targetClearXBeforeVertical(
            targetX,
            midX,
            diagramCenterX,
            sideSpans,
            targetTagWidth,
          );
    lastY = appendVerticalPoint(rightParts, midX, targetHorizY, lastY);
    lastX = midX;
    lastX = appendHorizontalPoint(rightParts, targetBendX, targetHorizY, lastX);
    lastY = appendVerticalPoint(rightParts, targetBendX, targetY, lastY);
    appendHorizontalPoint(rightParts, targetX, targetY, lastX);
  } else {
    lastY = appendVerticalPoint(rightParts, midX, targetY, lastY);
    appendHorizontalPoint(rightParts, targetX, targetY, midX);
  }

  const leftPath = leftParts.join(" ");
  const rightPath = rightParts.join(" ");
  return {
    leftPath,
    rightPath,
    spliceX: fusionX,
    spliceY: fusionY,
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
 * Vertical lane X for collapsed tubes ? always in the center routing band,
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
 * Collapsed full-butt-splice tube path ? ?2 bends, bend only when row Y differs.
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
  sideHoriz?: Pick<
    SpliceRoutingLane,
    "sourceHorizY" | "targetHorizY" | "sourceBendX" | "targetBendX"
  >,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  diagramCenterX = (sourceX + targetX) / 2,
  sourceTagWidth = 0,
  targetTagWidth = 0,
): OrthogonalSegment[] {
  const spliceY = (sourceY + targetY) / 2;
  const sourceHorizY = sideHoriz?.sourceHorizY ?? sourceY;
  const targetHorizY = sideHoriz?.targetHorizY ?? targetY;
  const sourceUsesOffset =
    Math.abs(sourceHorizY - sourceY) > SPLICE_PATH_EPS;
  const targetUsesOffset =
    Math.abs(targetHorizY - targetY) > SPLICE_PATH_EPS;

  const horizXs = sourceHorizWaypoints(
    sourceX,
    midX,
    jogX,
    diagramCenterX,
    sideSpans,
    sourceTagWidth,
    sideHoriz?.sourceBendX,
  );
  const segments: OrthogonalSegment[] = [];

  if (sourceUsesOffset) {
    const bendX = horizXs[0] ?? inwardClearXBeforeVertical(
      sourceX,
      midX,
      diagramCenterX,
      sideSpans,
      sourceTagWidth,
    );
    if (Math.abs(bendX - sourceX) > SPLICE_PATH_EPS) {
      segments.push({ kind: "h", y: sourceY, x0: sourceX, x1: bendX });
    }
    segments.push({
      kind: "v",
      x: bendX,
      y0: Math.min(sourceY, sourceHorizY),
      y1: Math.max(sourceY, sourceHorizY),
    });
    let x0 = bendX;
    for (const x1 of horizXs) {
      if (Math.abs(x1 - x0) > SPLICE_PATH_EPS) {
        segments.push({ kind: "h", y: sourceHorizY, x0, x1 });
        x0 = x1;
      }
    }
    if (Math.abs(midX - x0) > SPLICE_PATH_EPS) {
      segments.push({ kind: "h", y: sourceHorizY, x0, x1: midX });
    }
    segments.push({
      kind: "v",
      x: midX,
      y0: Math.min(sourceHorizY, spliceY),
      y1: Math.max(sourceHorizY, spliceY),
    });
  } else {
    let x0 = sourceX;
    for (const x1 of horizXs) {
      if (Math.abs(x1 - x0) > SPLICE_PATH_EPS) {
        segments.push({ kind: "h", y: sourceY, x0, x1 });
        x0 = x1;
      }
    }
    segments.push({ kind: "v", x: midX, y0: sourceY, y1: spliceY });
  }

  if (targetUsesOffset) {
    const targetBendX =
      sideHoriz?.targetBendX !== undefined &&
      Number.isFinite(sideHoriz.targetBendX)
        ? sideHoriz.targetBendX
        : targetClearXBeforeVertical(
            targetX,
            midX,
            diagramCenterX,
            sideSpans,
            targetTagWidth,
          );
    segments.push({
      kind: "v",
      x: midX,
      y0: Math.min(spliceY, targetHorizY),
      y1: Math.max(spliceY, targetHorizY),
    });
    segments.push({
      kind: "h",
      y: targetHorizY,
      x0: midX,
      x1: targetBendX,
    });
    segments.push({
      kind: "v",
      x: targetBendX,
      y0: Math.min(targetHorizY, targetY),
      y1: Math.max(targetHorizY, targetY),
    });
    segments.push({ kind: "h", y: targetY, x0: targetBendX, x1: targetX });
  } else {
    segments.push({ kind: "v", x: midX, y0: spliceY, y1: targetY });
    segments.push({ kind: "h", y: targetY, x0: midX, x1: targetX });
  }

  return segments;
}

/** Horizontal gap segments that match buildDemarcatedSplicePaths (EDGE-011 ledger). */
export function spliceRouteHorizontalSegments(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  midX: number,
  jogX: number | undefined,
  tentativeHoriz: { sourceHorizY: number; targetHorizY: number },
  laneBends: Pick<SpliceRoutingLane, "sourceBendX" | "targetBendX"> = {},
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
  diagramCenterX = (sourceX + targetX) / 2,
  sourceTagWidth = 0,
  targetTagWidth = 0,
): Array<{ kind: "h"; y: number; x0: number; x1: number }> {
  return spliceRouteSegments(
    sourceX,
    sourceY,
    targetX,
    targetY,
    midX,
    jogX,
    {
      sourceHorizY: tentativeHoriz.sourceHorizY,
      targetHorizY: tentativeHoriz.targetHorizY,
      sourceBendX: laneBends.sourceBendX,
      targetBendX: laneBends.targetBendX,
    },
    sideSpans,
    diagramCenterX,
    sourceTagWidth,
    targetTagWidth,
  ).filter(
    (segment): segment is { kind: "h"; y: number; x0: number; x1: number } =>
      segment.kind === "h",
  );
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

/** Same-Y handle horizontals when center lanes are already ?24px apart (nested lead-ins). */
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

/** Center vertical leg crossing another strand's handle-row lead-in (inherent to ?2-bend routes). */
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

/** True when two H?V?H splice paths share a crossing segment intersection. */
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

/** Local Y for a collapsed tube handle (tube.end already includes visualShiftY). */
export function collapsedTubeHandleLocalY(
  _vc: VisualCable,
  _tubeColor: TubeColorCode,
  tubeEndY: number,
): number {
  return tubeEndY;
}

/** Local X for a collapsed tube handle (stem face + splice overhang). */
export function collapsedTubeHandleLocalX(
  side: VisualCable["side"],
  stemX: number,
): number {
  return side === "left"
    ? stemX + SPLICE_HANDLE_OVERHANG
    : stemX - SPLICE_HANDLE_OVERHANG;
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
  if (!tube) {
    return {
      x:
        nodePosition.x +
        collapsedTubeHandleLocalX(vc.side, geo.stemX),
      y: nodePosition.y + CABLE_LAYOUT.headerH,
    };
  }
  const localY = collapsedTubeHandleLocalY(vc, tubeColor, tube.end.y);
  const localX = collapsedTubeHandleLocalX(vc.side, geo.stemX);
  return {
    x: nodePosition.x + localX,
    y: nodePosition.y + localY,
  };
}

/** React Flow handle center for layout validation (handle ? handle routing). */
export function fiberHandlePosition(
  vc: VisualCable,
  connectionId: string,
  nodePosition: { x: number; y: number },
  scale = 1,
  alignedStemX?: number,
  _circuitName?: string,
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
  const outset = fiber ? fixedHandleOutsetFromStem() : SPLICE_HANDLE_OVERHANG;
  const stemOrigin =
    vc.side === "left" ? geo.stemX : geo.viewWidth - geo.stemX;
  const handleCenterX = stemOrigin + outset;
  const handleLocalX =
    vc.side === "left" ? handleCenterX : geo.viewWidth - handleCenterX;
  return {
    x: nodePosition.x + handleLocalX,
    y: nodePosition.y + fiberRowOffsetInCable(vc, connectionId),
  };
}

/** Keep stored midX inside the render inset band when it still clears labels. */
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
