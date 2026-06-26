import {
  FIBER_ROW_PITCH,
  MIN_SPLICE_HORIZONTAL_INSET,
  SPLICE_LANE_SEP,
} from "@/features/diagram/cableLayoutMetrics";
import type { SideCircuitLabelSpan } from "@/features/diagram/cableLabels";
import {
  canvasSideForHandle,
  circuitLabelSpanForSide,
  clampMidXForMinHorizontalInset,
  defaultSideCircuitLabelSpan,
  horizontalInsetOkFromHandle,
  inwardSignForColumn,
  isNestedHandleRowHorizOverlap,
  isSharedSpliceRowLeadInOverlap,
  isSameColumnSplice,
  laneClearXBeforeVertical,
  maxSpliceBendsForLane,
  buildSplicePath,
  parallelSpliceSegmentsOverlap,
  resolveButtSpliceMidX,
  spliceMidOrderInverts,
  spliceMidXFromRowOffset,
  spliceMidXInsetBounds,
  spliceRouteHorizontalSegments,
  spliceRouteSegments,
  spliceRoutingBounds,
  SPLICE_PATH_EPS,
  type SpliceRoutingLane,
} from "@/features/canvas/edges/splicePathGeometry";
import type { SpliceHandleEntry } from "@/features/canvas/edges/spliceHandleEntries";
import {
  connectionIdFromHandleEntryId,
  layoutRuleHandleEndpointsForConnection,
} from "@/features/canvas/edges/spliceHandleEntries";
import type { ConnectionGraph } from "@/types/splice";
import type { VisualCable } from "@/features/diagram/visualCables";

export type { SpliceHandleEntry, SpliceRoutingLane };

/** Layout-rule handle positions for EDGE-011 overlap geometry during grid reconcile. */
export type LayoutEndpointSync = {
  graph: ConnectionGraph;
  visualCables: VisualCable[];
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: unknown;
  }>;
};

/** Max source/target horiz lane steps before forced offset (EDGE-011). */
const MAX_SIDE_HORIZ_LANE_ATTEMPTS = 256;
/** Max 24px Y bumps per deconflict pair. */
const MAX_GAP_HORIZ_DECONFLICT_STEPS = 32;

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

export function assignSpliceRoutingLanesFromHandleEntries(
  entries: SpliceHandleEntry[],
  diagramCenterX?: number,
): Map<string, SpliceRoutingLane> {
  if (entries.length === 0) return new Map();
  const centerX =
    diagramCenterX ??
    globalDiagramCenterX(handleEntriesToCandidates(entries));
  return assignCenterLanes(entries, centerX);
}

/** Re-rank row offsets from live handle Y (non-bundle entries only). */
export function handleEntriesWithLiveRowOffsets<
  T extends {
    id: string;
    fallbackLane: number;
    rowOffset?: number;
    tubeBundleKey?: string;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
  },
>(entries: T[]): T[] {
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
  return entries.map((entry) => ({
    ...entry,
    rowOffset: rowOffsets.get(entry.id) ?? entry.rowOffset ?? entry.fallbackLane,
  }));
}

/** Re-rank row offsets from live handle Y, then pack lanes (drag / live handles). */
export function assignSpliceRoutingLanesFromLiveHandles(
  entries: SpliceHandleEntry[],
  diagramCenterX?: number,
): {
  lanes: Map<string, SpliceRoutingLane>;
  rowOffsets: Map<string, number>;
} {
  const withRows = handleEntriesWithLiveRowOffsets(entries);
  const rowOffsets = new Map(
    withRows.map((entry) => [
      entry.id,
      entry.rowOffset ?? entry.fallbackLane * FIBER_ROW_PITCH,
    ]),
  );

  return {
    lanes: assignSpliceRoutingLanesFromHandleEntries(withRows, diagramCenterX),
    rowOffsets,
  };
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

/** Dot stack group = all splices from fibers in one source buffer tube (DOT-002). */
export function sourceTubeDotGroupKey(
  sourceVisualCableId: string,
  sourceTubeColor: string,
): string {
  return `${normalizeVisualCableIdForRouting(sourceVisualCableId)}|${sourceTubeColor}`;
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

/** Same source handle column — row-offset nest must not split on per-target Y. */
function sharesSourceRoutingColumn(members: MidXLaneCandidate[]): boolean {
  if (members.length <= 1) return false;
  const xs = members.map((member) => member.sourceX);
  return Math.max(...xs) - Math.min(...xs) <= SPLICE_PATH_EPS;
}

/** Same target handle column — row-offset nest must not split on per-source Y. */
function sharesTargetRoutingColumn(members: MidXLaneCandidate[]): boolean {
  if (members.length <= 1) return false;
  const xs = members.map((member) => member.targetX);
  return Math.max(...xs) - Math.min(...xs) <= SPLICE_PATH_EPS;
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

  const inverts = bundleMidOrderInverts(sorted);
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
    const inverts = bundleMidOrderInverts(sorted);
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

/** Same-side loop bundles use dedicated slot order (EDGE-010) — skip EDGE-005 enforce. */
export function sameSideLoopBundleUsesSpecialMidXOrder(
  members: MidXLaneCandidate[],
): boolean {
  if (!isCoherentTubeBundle(members)) return false;
  const sorted = sortCandidatesByRowOrder(members);
  if (!isSameColumnSplice(sorted[0]!.sourceX, sorted[0]!.targetX)) return false;
  return bundleMidOrderInvertsUniform(sorted);
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
export function globalDiagramCenterX(candidates: MidXLaneCandidate[]): number {
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

  if (
    sharesSourceRoutingColumn(candidates) ||
    sharesTargetRoutingColumn(candidates)
  ) {
    return packCoherentTubeBundleMidXLanes(
      sortCandidatesByRowOrder(candidates),
      minSep,
      centerX,
      sideSpans,
      globalMaxRowOffset,
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
  const clampedStart = clampMidXForMinHorizontalInset(
    start,
    sourceX,
    targetX,
    centerX,
    sideSpans,
  );

  for (let i = 0; i < upwardOrdered.length; i++) {
    result.set(upwardOrdered[i]!.id, clampedStart + i * sep);
  }
  for (let i = 0; i < downwardOrdered.length; i++) {
    const slot = upwardOrdered.length + downwardOrdered.length - 1 - i;
    result.set(downwardOrdered[i]!.id, clampedStart + slot * sep);
  }

  enforceDistinctMidXLanes(result, candidates, minSep);

  return result;
}

/** EDGE-005 monotonicity for one tube bundle (skips same-side loop bundles). */
function enforceEdge005MidXMonotonicityInBundle(
  lanes: Map<string, SpliceRoutingLane>,
  bundle: MidXLaneCandidate[],
  minSep = SPLICE_LANE_SEP,
): void {
  const sorted = sortCandidatesByRowOrder(bundle);
  if (sorted.length <= 1) return;
  if (sameSideLoopBundleUsesSpecialMidXOrder(sorted)) {
    return;
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const prevInverts = spliceMidOrderInverts(
      prev.sourceX,
      prev.sourceY,
      prev.targetX,
      prev.targetY,
    );
    const currInverts = spliceMidOrderInverts(
      curr.sourceX,
      curr.sourceY,
      curr.targetX,
      curr.targetY,
    );
    if (prevInverts !== currInverts) continue;

    const prevLane = lanes.get(prev.id);
    const currLane = lanes.get(curr.id);
    if (!prevLane || !currLane) continue;

    if (prevInverts) {
      if (currLane.midX > prevLane.midX - minSep + SPLICE_PATH_EPS) {
        currLane.midX = prevLane.midX - minSep;
      }
    } else if (currLane.midX < prevLane.midX + minSep - SPLICE_PATH_EPS) {
      currLane.midX = prevLane.midX + minSep;
    }
  }
}

function enforceEdge005MidXMonotonicityInNumericMap(
  midXMap: Map<string, number>,
  bundle: MidXLaneCandidate[],
  minSep = SPLICE_LANE_SEP,
): void {
  const sorted = sortCandidatesByRowOrder(bundle);
  if (sorted.length <= 1) return;
  if (sameSideLoopBundleUsesSpecialMidXOrder(sorted)) {
    return;
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const prevInverts = spliceMidOrderInverts(
      prev.sourceX,
      prev.sourceY,
      prev.targetX,
      prev.targetY,
    );
    const currInverts = spliceMidOrderInverts(
      curr.sourceX,
      curr.sourceY,
      curr.targetX,
      curr.targetY,
    );
    if (prevInverts !== currInverts) continue;

    const prevMidX = midXMap.get(prev.id);
    const currMidX = midXMap.get(curr.id);
    if (prevMidX === undefined || currMidX === undefined) continue;

    if (prevInverts) {
      if (currMidX > prevMidX - minSep + SPLICE_PATH_EPS) {
        midXMap.set(curr.id, prevMidX - minSep);
      }
    } else if (currMidX < prevMidX + minSep - SPLICE_PATH_EPS) {
      midXMap.set(curr.id, prevMidX + minSep);
    }
  }
}

function enforceEdge005MidXMonotonicityInBundles(
  lanes: Map<string, SpliceRoutingLane>,
  candidates: MidXLaneCandidate[],
): void {
  for (const bundle of groupCandidatesByTubeBundle(
    candidates.filter((candidate) => candidate.tubeBundleKey),
  )) {
    if (bundle.length <= 1) continue;
    enforceEdge005MidXMonotonicityInBundle(lanes, bundle);
  }
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

function shiftCoherentBundleMidXLanes(
  bundle: MidXLaneCandidate[],
  midXMap: Map<string, number>,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
): void {
  if (!isCoherentTubeBundle(bundle)) return;
  let shift = 0;
  for (const member of bundle) {
    const raw = midXMap.get(member.id);
    if (raw === undefined) continue;
    const clamped = clampMidXForCandidate(
      raw,
      member,
      diagramCenterX,
      sideSpans,
    );
    const delta = clamped - raw;
    if (Math.abs(delta) > Math.abs(shift)) shift = delta;
  }
  if (Math.abs(shift) <= SPLICE_PATH_EPS) return;
  for (const member of bundle) {
    const raw = midXMap.get(member.id);
    if (raw !== undefined) midXMap.set(member.id, raw + shift);
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
      enforceEdge005MidXMonotonicityInNumericMap(result, bundle, SPLICE_LANE_SEP);
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
export function assignGapBendLaneXs(
  candidates: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  sideSpans: SideCircuitLabelSpan,
  _diagramCenterX: number,
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
      const centerX = columnCenterXForCandidate(candidate);
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
            centerX,
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
            centerX,
            sideSpans,
            0,
            MIN_SPLICE_HORIZONTAL_INSET,
            zoneIndex,
          );
        if (nextLane.sourceBendX !== undefined) {
          const towardMid = candidate.sourceX < lane.midX ? 1 : -1;
          const notAtMid = lane.midX - towardMid * MIN_SPLICE_HORIZONTAL_INSET;
          nextLane.sourceBendX =
            towardMid > 0
              ? Math.min(nextLane.sourceBendX, notAtMid)
              : Math.max(nextLane.sourceBendX, notAtMid);
        }
      }

      if (targetOffsetY) {
        let placedX: number | undefined;
        for (let attempt = 0; attempt <= 64; attempt++) {
          const bendX = laneClearXBeforeVertical(
            candidate.targetX,
            lane.midX,
            candidate.targetY,
            tgtHY,
            centerX,
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
            centerX,
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
  const coherentBundles = groupCandidatesByTubeBundle(
    candidates.filter((candidate) => candidate.tubeBundleKey),
  ).filter((bundle) => isCoherentTubeBundle(bundle));
  const coherentBundleIds = new Set<string>();
  for (const bundle of coherentBundles) {
    for (const member of bundle) coherentBundleIds.add(member.id);
  }
  for (const candidate of candidates) {
    const raw = midXMap.get(candidate.id);
    if (raw === undefined) continue;
    if (coherentBundleIds.has(candidate.id)) continue;
    midXMap.set(
      candidate.id,
      clampMidXForCandidate(raw, candidate, diagramCenterX, sideSpans),
    );
  }
  for (const bundle of coherentBundles) {
    shiftCoherentBundleMidXLanes(bundle, midXMap, diagramCenterX, sideSpans);
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

  assignSideHorizLanesWithGapBends(
    candidates,
    result,
    sideSpans,
    diagramCenterX,
  );

  enforceEdge005MidXMonotonicityInBundles(result, candidates);

  return result;
}

function stripSideHorizYOffsets(lanes: Map<string, SpliceRoutingLane>): void {
  for (const [id, lane] of lanes) {
    const { sourceHorizY, targetHorizY, sourceBendX, targetBendX, ...rest } =
      lane;
    lanes.set(id, rest);
  }
}

function columnCenterXForCandidate(candidate: MidXLaneCandidate): number {
  return (candidate.sourceX + candidate.targetX) / 2;
}

type CandidateEndpoints = Pick<
  MidXLaneCandidate,
  "sourceX" | "sourceY" | "targetX" | "targetY"
>;

function endpointsForCandidate(
  candidate: MidXLaneCandidate,
  layoutSync?: LayoutEndpointSync,
): CandidateEndpoints {
  if (layoutSync) {
    const connectionId = connectionIdFromHandleEntryId(candidate.id);
    const endpoints = layoutRuleHandleEndpointsForConnection(
      layoutSync.graph,
      layoutSync.visualCables,
      layoutSync.nodes,
      connectionId,
    );
    if (endpoints) return endpoints;
  }
  return candidate;
}

function routingZoneKeyForCandidate(
  candidate: MidXLaneCandidate,
  layoutSync?: LayoutEndpointSync,
): string {
  const ep = endpointsForCandidate(candidate, layoutSync);
  return spliceRoutingZoneKey(ep.sourceX, ep.targetX);
}

function laneBendsWithinBudget(
  candidate: MidXLaneCandidate,
  lane: SpliceRoutingLane,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
  layoutSync?: LayoutEndpointSync,
): boolean {
  const ep = endpointsForCandidate(candidate, layoutSync);
  const { bendCount } = buildSplicePath(
    ep.sourceX,
    ep.sourceY,
    ep.targetX,
    ep.targetY,
    lane.midX,
    lane.jogX,
    {
      sourceHorizY: lane.sourceHorizY,
      targetHorizY: lane.targetHorizY,
      sourceBendX: lane.sourceBendX,
      targetBendX: lane.targetBendX,
    },
    sideSpans,
    diagramCenterX,
    candidate.sourceTagWidth ?? 0,
    candidate.targetTagWidth ?? 0,
  );
  return (
    bendCount <= maxSpliceBendsForLane(ep.sourceY, ep.targetY, lane)
  );
}

function gapHorizSegmentsOverlap(
  a: MidXLaneCandidate,
  laneA: SpliceRoutingLane,
  b: MidXLaneCandidate,
  laneB: SpliceRoutingLane,
  sideSpans: SideCircuitLabelSpan,
  _diagramCenterX: number,
  layoutSync?: LayoutEndpointSync,
): boolean {
  const epA = endpointsForCandidate(a, layoutSync);
  const epB = endpointsForCandidate(b, layoutSync);
  const srcHYA = laneA.sourceHorizY ?? epA.sourceY;
  const tgtHYA = laneA.targetHorizY ?? epA.targetY;
  const srcHYB = laneB.sourceHorizY ?? epB.sourceY;
  const tgtHYB = laneB.targetHorizY ?? epB.targetY;
  const segsA = spliceRouteSegments(
    epA.sourceX,
    epA.sourceY,
    epA.targetX,
    epA.targetY,
    laneA.midX,
    laneA.jogX,
    {
      sourceHorizY: srcHYA,
      targetHorizY: tgtHYA,
      sourceBendX: laneA.sourceBendX,
      targetBendX: laneA.targetBendX,
    },
    sideSpans,
  ).filter(
    (segment): segment is { kind: "h"; y: number; x0: number; x1: number } =>
      segment.kind === "h",
  );
  const segsB = spliceRouteSegments(
    epB.sourceX,
    epB.sourceY,
    epB.targetX,
    epB.targetY,
    laneB.midX,
    laneB.jogX,
    {
      sourceHorizY: srcHYB,
      targetHorizY: tgtHYB,
      sourceBendX: laneB.sourceBendX,
      targetBendX: laneB.targetBendX,
    },
    sideSpans,
  ).filter(
    (segment): segment is { kind: "h"; y: number; x0: number; x1: number } =>
      segment.kind === "h",
  );
  for (const segA of segsA) {
    for (const segB of segsB) {
      if (
        isSharedSpliceRowLeadInOverlap(
          epA.sourceY,
          epB.sourceY,
          epA.targetY,
          epB.targetY,
          segA,
          segB,
        )
      ) {
        continue;
      }
      if (
        isNestedHandleRowHorizOverlap(
          segA,
          segB,
          laneA.midX,
          laneB.midX,
        )
      ) {
        continue;
      }
      if (parallelSpliceSegmentsOverlap(segA, segB)) {
        return true;
      }
    }
  }
  return false;
}

function laneHasNoGapHorizConflict(
  candidate: MidXLaneCandidate,
  lane: SpliceRoutingLane,
  others: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
  layoutSync?: LayoutEndpointSync,
): boolean {
  for (const other of others) {
    if (other.id === candidate.id) continue;
    const otherLane = lanes.get(other.id);
    if (!otherLane) continue;
    if (
      candidate.tubeBundleKey &&
      candidate.tubeBundleKey === other.tubeBundleKey
    ) {
      continue;
    }
    if (
      routingZoneKeyForCandidate(candidate, layoutSync) !==
      routingZoneKeyForCandidate(other, layoutSync)
    ) {
      continue;
    }
    if (
      gapHorizSegmentsOverlap(
        candidate,
        lane,
        other,
        otherLane,
        sideSpans,
        diagramCenterX,
        layoutSync,
      )
    ) {
      return false;
    }
  }
  return true;
}

function gapBendXsForHorizOffsets(
  candidate: MidXLaneCandidate,
  lane: SpliceRoutingLane,
  sideSpans: SideCircuitLabelSpan,
  _diagramCenterX: number,
  zoneIndex = 0,
  layoutSync?: LayoutEndpointSync,
): SpliceRoutingLane {
  const ep = endpointsForCandidate(candidate, layoutSync);
  const centerX = columnCenterXForCandidate(candidate);
  const srcHY = lane.sourceHorizY ?? ep.sourceY;
  const tgtHY = lane.targetHorizY ?? ep.targetY;
  const sourceOffsetY =
    Math.abs(srcHY - ep.sourceY) > SPLICE_PATH_EPS;
  const targetOffsetY =
    Math.abs(tgtHY - ep.targetY) > SPLICE_PATH_EPS;
  const next: SpliceRoutingLane = { ...lane };
  if (sourceOffsetY) {
    next.sourceBendX = laneClearXBeforeVertical(
      ep.sourceX,
      lane.midX,
      ep.sourceY,
      srcHY,
      centerX,
      sideSpans,
      0,
      MIN_SPLICE_HORIZONTAL_INSET,
      zoneIndex,
    );
  } else {
    delete next.sourceBendX;
  }
  if (targetOffsetY) {
    next.targetBendX = laneClearXBeforeVertical(
      ep.targetX,
      lane.midX,
      ep.targetY,
      tgtHY,
      centerX,
      sideSpans,
      0,
      MIN_SPLICE_HORIZONTAL_INSET,
      zoneIndex,
    );
  } else {
    delete next.targetBendX;
  }
  return next;
}

/** targetHorizY trial — clear only target gap-bend X (keep source bend when source is offset). */
function plainTargetHorizYTrialLane(
  lane: SpliceRoutingLane,
  targetHorizY: number,
): SpliceRoutingLane {
  const trial: SpliceRoutingLane = { ...lane, targetHorizY };
  delete trial.targetBendX;
  return trial;
}

/** sourceHorizY trial — clear only source gap-bend X (keep target bend when target is offset). */
function plainSourceHorizYTrialLane(
  lane: SpliceRoutingLane,
  sourceHorizY: number,
): SpliceRoutingLane {
  const trial: SpliceRoutingLane = { ...lane, sourceHorizY };
  delete trial.sourceBendX;
  return trial;
}

function commitPlainHorizYTrialIfClear(
  plainCandidate: MidXLaneCandidate,
  _plainLane: SpliceRoutingLane,
  trialY: SpliceRoutingLane,
  jogCandidate: MidXLaneCandidate,
  _jogLane: SpliceRoutingLane,
  eligible: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
  layoutSync?: LayoutEndpointSync,
  relaxGlobalConflict = false,
): boolean {
  const jogLaneNow = lanes.get(jogCandidate.id)!;
  if (
    gapHorizSegmentsOverlap(
      jogCandidate,
      jogLaneNow,
      plainCandidate,
      trialY,
      sideSpans,
      diagramCenterX,
      layoutSync,
    )
  ) {
    return false;
  }
  const globalClear = (lane: SpliceRoutingLane) =>
    relaxGlobalConflict ||
    laneHasNoGapHorizConflict(
      plainCandidate,
      lane,
      eligible,
      lanes,
      sideSpans,
      diagramCenterX,
      layoutSync,
    );
  if (
    laneBendsWithinBudget(
      plainCandidate,
      trialY,
      sideSpans,
      diagramCenterX,
      layoutSync,
    ) &&
    globalClear(trialY)
  ) {
    lanes.set(plainCandidate.id, trialY);
    return true;
  }
  const withBend = gapBendXsForHorizOffsets(
    plainCandidate,
    trialY,
    sideSpans,
    diagramCenterX,
    0,
    layoutSync,
  );
  if (
    laneBendsWithinBudget(
      plainCandidate,
      withBend,
      sideSpans,
      diagramCenterX,
      layoutSync,
    ) &&
    globalClear(withBend)
  ) {
    lanes.set(plainCandidate.id, withBend);
    return true;
  }
  return false;
}

function tryCommitJogHorizOffsetForPlainPartner(
  jogCandidate: MidXLaneCandidate,
  plainCandidate: MidXLaneCandidate,
  jogEp: { sourceY: number; targetY: number },
  diagramCenterY: number,
  lanes: Map<string, SpliceRoutingLane>,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
  layoutSync?: LayoutEndpointSync,
): boolean {
  const currentPlain = lanes.get(plainCandidate.id)!;
  for (const kind of ["source", "target"] as const) {
    const epY = kind === "source" ? jogEp.sourceY : jogEp.targetY;
    const sign0 = sideHorizLaneSign(epY, diagramCenterY);
    for (const sign of [sign0, (sign0 === 1 ? -1 : 1) as 1 | -1]) {
      for (let step = 1; step <= MAX_GAP_HORIZ_DECONFLICT_STEPS; step++) {
        const currentJog = lanes.get(jogCandidate.id)!;
        const jogBase =
          kind === "source"
            ? (currentJog.sourceHorizY ?? epY)
            : (currentJog.targetHorizY ?? epY);
        const trialJog: SpliceRoutingLane = {
          ...currentJog,
          ...(kind === "source"
            ? { sourceHorizY: jogBase + sign * step * SPLICE_LANE_SEP }
            : { targetHorizY: jogBase + sign * step * SPLICE_LANE_SEP }),
        };
        if (
          gapHorizSegmentsOverlap(
            jogCandidate,
            trialJog,
            plainCandidate,
            currentPlain,
            sideSpans,
            diagramCenterX,
            layoutSync,
          )
        ) {
          continue;
        }
        if (
          laneBendsWithinBudget(
            jogCandidate,
            trialJog,
            sideSpans,
            diagramCenterX,
            layoutSync,
          )
        ) {
          lanes.set(jogCandidate.id, trialJog);
          return true;
        }
        const withBend = gapBendXsForHorizOffsets(
          jogCandidate,
          trialJog,
          sideSpans,
          diagramCenterX,
          0,
          layoutSync,
        );
        if (
          !gapHorizSegmentsOverlap(
            jogCandidate,
            withBend,
            plainCandidate,
            currentPlain,
            sideSpans,
            diagramCenterX,
            layoutSync,
          ) &&
          laneBendsWithinBudget(
            jogCandidate,
            withBend,
            sideSpans,
            diagramCenterX,
            layoutSync,
          )
        ) {
          lanes.set(jogCandidate.id, withBend);
          return true;
        }
      }
    }
  }
  return false;
}

/** Pair-local jog/plain gap-H fix after horiz merge (no global laneHasNoGapHorizConflict). */
function resolveJogPlainGapHorizOverlaps(
  candidates: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
  layoutSync?: LayoutEndpointSync,
): void {
  const eligible = sortCandidatesByRowOrder(
    candidates.filter((c) => lanes.has(c.id) && !c.fullButtSplice),
  );
  if (eligible.length < 2) return;

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const candidate of eligible) {
    const ep = endpointsForCandidate(candidate, layoutSync);
    minY = Math.min(minY, ep.sourceY, ep.targetY);
    maxY = Math.max(maxY, ep.sourceY, ep.targetY);
  }
  const diagramCenterY = (minY + maxY) / 2;

  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i]!;
      const b = eligible[j]!;
      const laneA = lanes.get(a.id)!;
      const laneB = lanes.get(b.id)!;
      if (a.tubeBundleKey && a.tubeBundleKey === b.tubeBundleKey) continue;
      if (
        routingZoneKeyForCandidate(a, layoutSync) !==
        routingZoneKeyForCandidate(b, layoutSync)
      ) {
        continue;
      }
      const aJog = laneA.jogX !== undefined;
      const bJog = laneB.jogX !== undefined;
      if (aJog === bJog) continue;

      const plain = aJog
        ? { candidate: b, jog: { candidate: a } }
        : { candidate: a, jog: { candidate: b } };
      const plainLane = lanes.get(plain.candidate.id)!;
      const jogLane = lanes.get(plain.jog.candidate.id)!;
      if (
        !gapHorizSegmentsOverlap(
          plain.jog.candidate,
          jogLane,
          plain.candidate,
          plainLane,
          sideSpans,
          diagramCenterX,
          layoutSync,
        )
      ) {
        continue;
      }

      const ep = endpointsForCandidate(plain.candidate, layoutSync);
      const jogEp = endpointsForCandidate(plain.jog.candidate, layoutSync);
      const plainHasHoriz =
        plainLane.sourceHorizY !== undefined ||
        plainLane.targetHorizY !== undefined;

      if (
        plainHasHoriz &&
        tryCommitJogHorizOffsetForPlainPartner(
          plain.jog.candidate,
          plain.candidate,
          jogEp,
          diagramCenterY,
          lanes,
          sideSpans,
          diagramCenterX,
          layoutSync,
        )
      ) {
        continue;
      }

      for (const kind of ["source", "target"] as const) {
        const epY = kind === "source" ? ep.sourceY : ep.targetY;
        const sign0 = sideHorizLaneSign(epY, diagramCenterY);
        for (const sign of [sign0, (sign0 === 1 ? -1 : 1) as 1 | -1]) {
          for (let step = 1; step <= MAX_GAP_HORIZ_DECONFLICT_STEPS; step++) {
            const currentPlain = lanes.get(plain.candidate.id)!;
            const currentJog = lanes.get(plain.jog.candidate.id)!;
            const horizBase =
              kind === "source"
                ? (currentPlain.sourceHorizY ?? epY)
                : (currentPlain.targetHorizY ?? epY);
            const trialPlain: SpliceRoutingLane =
              kind === "source"
                ? plainSourceHorizYTrialLane(
                    currentPlain,
                    horizBase + sign * step * SPLICE_LANE_SEP,
                  )
                : plainTargetHorizYTrialLane(
                    currentPlain,
                    horizBase + sign * step * SPLICE_LANE_SEP,
                  );
            if (
              gapHorizSegmentsOverlap(
                plain.jog.candidate,
                currentJog,
                plain.candidate,
                trialPlain,
                sideSpans,
                diagramCenterX,
                layoutSync,
              )
            ) {
              continue;
            }
            if (
              laneBendsWithinBudget(
                plain.candidate,
                trialPlain,
                sideSpans,
                diagramCenterX,
                layoutSync,
              )
            ) {
              lanes.set(plain.candidate.id, trialPlain);
              break;
            }
            const withBend = gapBendXsForHorizOffsets(
              plain.candidate,
              trialPlain,
              sideSpans,
              diagramCenterX,
              0,
              layoutSync,
            );
            if (
              !gapHorizSegmentsOverlap(
                plain.jog.candidate,
                currentJog,
                plain.candidate,
                withBend,
                sideSpans,
                diagramCenterX,
                layoutSync,
              ) &&
              laneBendsWithinBudget(
                plain.candidate,
                withBend,
                sideSpans,
                diagramCenterX,
                layoutSync,
              )
            ) {
              lanes.set(plain.candidate.id, withBend);
              break;
            }
          }
        }
      }

      if (
        gapHorizSegmentsOverlap(
          plain.jog.candidate,
          lanes.get(plain.jog.candidate.id)!,
          plain.candidate,
          lanes.get(plain.candidate.id)!,
          sideSpans,
          diagramCenterX,
          layoutSync,
        )
      ) {
        tryCommitJogHorizOffsetForPlainPartner(
          plain.jog.candidate,
          plain.candidate,
          jogEp,
          diagramCenterY,
          lanes,
          sideSpans,
          diagramCenterX,
          layoutSync,
        );
      }
    }
  }
}

function capGapBendBeforePartnerLeadIn(
  handleX: number,
  midX: number,
  partnerBendX: number,
): number {
  if (handleX < midX) {
    return partnerBendX - MIN_SPLICE_HORIZONTAL_INSET;
  }
  if (handleX > midX) {
    return partnerBendX + MIN_SPLICE_HORIZONTAL_INSET;
  }
  return partnerBendX;
}

function clampGapBendBelowCap(
  bendX: number,
  cap: number,
  handleX: number,
  midX: number,
): number {
  if (handleX < midX) {
    return Math.min(bendX, cap);
  }
  if (handleX > midX) {
    return Math.max(bendX, cap);
  }
  return bendX;
}

/** Cap gap-bend X when row lead-ins share Y (jog/plain and jog/jog). */
function resolveJogPlainSharedRowGapBendXs(
  candidates: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
  layoutSync?: LayoutEndpointSync,
): void {
  const eligible = sortCandidatesByRowOrder(
    candidates.filter((c) => lanes.has(c.id) && !c.fullButtSplice),
  );
  if (eligible.length < 2) return;

  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i]!;
      const b = eligible[j]!;
      const laneA = lanes.get(a.id)!;
      const laneB = lanes.get(b.id)!;
      if (a.tubeBundleKey && a.tubeBundleKey === b.tubeBundleKey) continue;
      if (
        routingZoneKeyForCandidate(a, layoutSync) !==
        routingZoneKeyForCandidate(b, layoutSync)
      ) {
        continue;
      }
      if (
        !gapHorizSegmentsOverlap(
          a,
          laneA,
          b,
          laneB,
          sideSpans,
          diagramCenterX,
          layoutSync,
        )
      ) {
        continue;
      }
      const aJog = laneA.jogX !== undefined;
      const bJog = laneB.jogX !== undefined;
      if (!aJog && !bJog) continue;

      if (aJog !== bJog) {
        const plain = aJog
          ? { candidate: b, lane: laneB }
          : { candidate: a, lane: laneA };
        const jog = aJog
          ? { candidate: a, lane: laneA }
          : { candidate: b, lane: laneB };
        capSourceLeadInBeforePartnerTargetLeadIn(
          plain,
          jog,
          lanes,
          layoutSync,
        );
        capTargetLeadInBeforePartnerSourceLeadIn(
          plain,
          jog,
          lanes,
          layoutSync,
        );
        continue;
      }

      capSourceLeadInBeforePartnerTargetLeadIn(
        { candidate: a, lane: laneA },
        { candidate: b, lane: laneB },
        lanes,
        layoutSync,
      );
      capSourceLeadInBeforePartnerTargetLeadIn(
        { candidate: b, lane: laneB },
        { candidate: a, lane: laneA },
        lanes,
        layoutSync,
      );
    }
  }
}

function capSourceLeadInBeforePartnerTargetLeadIn(
  sourceSide: { candidate: MidXLaneCandidate; lane: SpliceRoutingLane },
  targetSide: { candidate: MidXLaneCandidate; lane: SpliceRoutingLane },
  lanes: Map<string, SpliceRoutingLane>,
  layoutSync?: LayoutEndpointSync,
): void {
  const sourceEp = endpointsForCandidate(sourceSide.candidate, layoutSync);
  const targetEp = endpointsForCandidate(targetSide.candidate, layoutSync);
  const sourceLane = lanes.get(sourceSide.candidate.id)!;
  const targetLane = lanes.get(targetSide.candidate.id)!;
  if (
    Math.abs(sourceEp.sourceY - targetEp.targetY) > SPLICE_PATH_EPS ||
    sourceLane.sourceHorizY === undefined ||
    targetLane.targetBendX === undefined ||
    sourceLane.sourceBendX === undefined
  ) {
    return;
  }
  const cap = capGapBendBeforePartnerLeadIn(
    sourceEp.sourceX,
    sourceLane.midX,
    targetLane.targetBendX,
  );
  const capped = clampGapBendBelowCap(
    sourceLane.sourceBendX,
    cap,
    sourceEp.sourceX,
    sourceLane.midX,
  );
  if (Math.abs(capped - sourceLane.sourceBendX) > SPLICE_PATH_EPS) {
    lanes.set(sourceSide.candidate.id, { ...sourceLane, sourceBendX: capped });
  }
}

function capTargetLeadInBeforePartnerSourceLeadIn(
  targetSide: { candidate: MidXLaneCandidate; lane: SpliceRoutingLane },
  sourceSide: { candidate: MidXLaneCandidate; lane: SpliceRoutingLane },
  lanes: Map<string, SpliceRoutingLane>,
  layoutSync?: LayoutEndpointSync,
): void {
  const targetEp = endpointsForCandidate(targetSide.candidate, layoutSync);
  const sourceEp = endpointsForCandidate(sourceSide.candidate, layoutSync);
  const targetLane = lanes.get(targetSide.candidate.id)!;
  const sourceLane = lanes.get(sourceSide.candidate.id)!;
  if (
    Math.abs(targetEp.targetY - sourceEp.sourceY) > SPLICE_PATH_EPS ||
    targetLane.targetHorizY === undefined ||
    sourceLane.sourceBendX === undefined ||
    targetLane.targetBendX === undefined
  ) {
    return;
  }
  const cap = capGapBendBeforePartnerLeadIn(
    targetEp.targetX,
    targetLane.midX,
    sourceLane.sourceBendX,
  );
  const capped = clampGapBendBelowCap(
    targetLane.targetBendX,
    cap,
    targetEp.targetX,
    targetLane.midX,
  );
  if (Math.abs(capped - targetLane.targetBendX) > SPLICE_PATH_EPS) {
    lanes.set(targetSide.candidate.id, { ...targetLane, targetBendX: capped });
  }
}

type GapHorizDeconflictKind = "source" | "target" | "both";

function gapHorizDeconflictKindsForLane(
  lane: SpliceRoutingLane,
  partnerLane?: SpliceRoutingLane,
): GapHorizDeconflictKind[] {
  if (lane.jogX !== undefined) {
    return ["target", "source", "both"];
  }
  if (partnerLane?.jogX !== undefined) {
    return ["target", "source", "both"];
  }
  return ["source", "target", "both"];
}

function gapHorizDeconflictAdjustOrder(
  a: MidXLaneCandidate,
  b: MidXLaneCandidate,
  laneA: SpliceRoutingLane,
  laneB: SpliceRoutingLane,
): Array<{
  candidate: MidXLaneCandidate;
  lane: SpliceRoutingLane;
}> {
  const aHasJog = laneA.jogX !== undefined;
  const bHasJog = laneB.jogX !== undefined;
  if (!aHasJog && bHasJog) {
    return [
      { candidate: a, lane: laneA },
      { candidate: b, lane: laneB },
    ];
  }
  if (aHasJog && !bHasJog) {
    return [
      { candidate: b, lane: laneB },
      { candidate: a, lane: laneA },
    ];
  }
  return [
    { candidate: b, lane: laneB },
    { candidate: a, lane: laneA },
  ];
}

function buildGapHorizDeconflictTrial(
  candidate: MidXLaneCandidate,
  lane: SpliceRoutingLane,
  kind: GapHorizDeconflictKind,
  step: number,
  diagramCenterY: number,
  invert = false,
  layoutSync?: LayoutEndpointSync,
): SpliceRoutingLane {
  const ep = endpointsForCandidate(candidate, layoutSync);
  let sourceSign = sideHorizLaneSign(ep.sourceY, diagramCenterY);
  let targetSign = sideHorizLaneSign(ep.targetY, diagramCenterY);
  if (invert) {
    sourceSign = sourceSign === 1 ? -1 : 1;
    targetSign = targetSign === 1 ? -1 : 1;
  }
  const trial: SpliceRoutingLane = { ...lane };
  if (kind === "source" || kind === "both") {
    const sourceBase = lane.sourceHorizY ?? ep.sourceY;
    trial.sourceHorizY = sourceBase + sourceSign * step * SPLICE_LANE_SEP;
  }
  if (kind === "target" || kind === "both") {
    const targetBase = lane.targetHorizY ?? ep.targetY;
    trial.targetHorizY = targetBase + targetSign * step * SPLICE_LANE_SEP;
  }
  return trial;
}

/** Bump source/target horiz Y only for strands whose gap horizontals stack. */
function deconflictGapHorizontalLanes(
  candidates: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
  layoutSync?: LayoutEndpointSync,
): void {
  const eligible = sortCandidatesByRowOrder(
    candidates.filter((c) => lanes.has(c.id) && !c.fullButtSplice),
  );
  if (eligible.length < 2) return;

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const candidate of eligible) {
    const ep = endpointsForCandidate(candidate, layoutSync);
    minY = Math.min(minY, ep.sourceY, ep.targetY);
    maxY = Math.max(maxY, ep.sourceY, ep.targetY);
  }
  const diagramCenterY = (minY + maxY) / 2;

  for (let pass = 0; pass < 64; pass++) {
    let changed = false;
    for (let i = 0; i < eligible.length; i++) {
      for (let j = i + 1; j < eligible.length; j++) {
        const a = eligible[i]!;
        const b = eligible[j]!;
        const laneA = lanes.get(a.id)!;
        const laneB = lanes.get(b.id)!;
        if (
          a.tubeBundleKey &&
          a.tubeBundleKey === b.tubeBundleKey
        ) {
          continue;
        }
        if (
          routingZoneKeyForCandidate(a, layoutSync) !==
          routingZoneKeyForCandidate(b, layoutSync)
        ) {
          continue;
        }

        let resolved = false;
        const aJogEarly = laneA.jogX !== undefined;
        const bJogEarly = laneB.jogX !== undefined;
        if (aJogEarly !== bJogEarly) {
          const plainEarly = aJogEarly
            ? { candidate: b, lane: laneB }
            : { candidate: a, lane: laneA };
          const jogEarly = aJogEarly
            ? { candidate: a, lane: laneA }
            : { candidate: b, lane: laneB };
          const plainEpEarly = endpointsForCandidate(
            plainEarly.candidate,
            layoutSync,
          );
          const jogEpEarly = endpointsForCandidate(
            jogEarly.candidate,
            layoutSync,
          );
          if (
            Math.abs(jogEpEarly.sourceY - plainEpEarly.targetY) <=
            SPLICE_PATH_EPS
          ) {
            const sign = sideHorizLaneSign(
              plainEpEarly.targetY,
              diagramCenterY,
            );
            for (
              let step = 1;
              step <= MAX_GAP_HORIZ_DECONFLICT_STEPS && !resolved;
              step++
            ) {
              const trialY = plainTargetHorizYTrialLane(
                plainEarly.lane,
                plainEpEarly.targetY + sign * step * SPLICE_LANE_SEP,
              );
              if (
                gapHorizSegmentsOverlap(
                  jogEarly.candidate,
                  jogEarly.lane,
                  plainEarly.candidate,
                  trialY,
                  sideSpans,
                  diagramCenterX,
                  layoutSync,
                )
              ) {
                continue;
              }
              if (
                laneBendsWithinBudget(
                  plainEarly.candidate,
                  trialY,
                  sideSpans,
                  diagramCenterX,
                  layoutSync,
                )
              ) {
                lanes.set(plainEarly.candidate.id, trialY);
                changed = true;
                resolved = true;
                break;
              }
            }
          }
        }
        if (resolved) continue;

        if (
          !gapHorizSegmentsOverlap(
            a,
            laneA,
            b,
            laneB,
            sideSpans,
            diagramCenterX,
            layoutSync,
          )
        ) {
          continue;
        }

        resolved = false;
        for (const invert of [false, true] as const) {
          if (resolved) break;
          adjustLoop: for (const { candidate, lane } of gapHorizDeconflictAdjustOrder(
            a,
            b,
            laneA,
            laneB,
          )) {
            for (const kind of gapHorizDeconflictKindsForLane(
              lane,
              candidate.id === a.id ? laneB : laneA,
            )) {
              for (
                let step = 1;
                step <= MAX_GAP_HORIZ_DECONFLICT_STEPS && !resolved;
                step++
              ) {
                const trialY = buildGapHorizDeconflictTrial(
                  candidate,
                  lane,
                  kind,
                  step,
                  diagramCenterY,
                  invert,
                  layoutSync,
                );
                const nextLaneA =
                  candidate.id === a.id ? trialY : lanes.get(a.id)!;
                const nextLaneB =
                  candidate.id === b.id ? trialY : lanes.get(b.id)!;
                if (
                  gapHorizSegmentsOverlap(
                    a,
                    nextLaneA,
                    b,
                    nextLaneB,
                    sideSpans,
                    diagramCenterX,
                    layoutSync,
                  )
                ) {
                  continue;
                }
                const trial = gapBendXsForHorizOffsets(
                  candidate,
                  trialY,
                  sideSpans,
                  diagramCenterX,
                  0,
                  layoutSync,
                );
                if (laneBendsWithinBudget(candidate, trial, sideSpans, diagramCenterX, layoutSync)) {
                  lanes.set(candidate.id, trial);
                } else if (
                  laneBendsWithinBudget(candidate, trialY, sideSpans, diagramCenterX, layoutSync)
                ) {
                  lanes.set(candidate.id, trialY);
                } else {
                  continue;
                }
                changed = true;
                resolved = true;
                break adjustLoop;
              }
            }
          }
        }

        if (!resolved) {
          dualKinds: for (const kindA of ["source", "target"] as const) {
            for (const kindB of ["source", "target"] as const) {
              for (
                let stepA = 1;
                stepA <= MAX_GAP_HORIZ_DECONFLICT_STEPS && !resolved;
                stepA++
              ) {
                for (
                  let stepB = 1;
                  stepB <= MAX_GAP_HORIZ_DECONFLICT_STEPS && !resolved;
                  stepB++
                ) {
                    for (const signA of [-1, 1] as const) {
                    for (const signB of [-1, 1] as const) {
                      const epA = endpointsForCandidate(a, layoutSync);
                      const epB = endpointsForCandidate(b, layoutSync);
                      const trialA: SpliceRoutingLane = { ...laneA };
                      const trialB: SpliceRoutingLane = { ...laneB };
                      if (kindA === "source") {
                        trialA.sourceHorizY =
                          epA.sourceY + signA * stepA * SPLICE_LANE_SEP;
                      } else {
                        trialA.targetHorizY =
                          epA.targetY + signA * stepA * SPLICE_LANE_SEP;
                      }
                      if (kindB === "source") {
                        trialB.sourceHorizY =
                          epB.sourceY + signB * stepB * SPLICE_LANE_SEP;
                      } else {
                        trialB.targetHorizY =
                          epB.targetY + signB * stepB * SPLICE_LANE_SEP;
                      }
                      if (
                        gapHorizSegmentsOverlap(
                          a,
                          trialA,
                          b,
                          trialB,
                          sideSpans,
                          diagramCenterX,
                          layoutSync,
                        )
                      ) {
                        continue;
                      }
                      const committedA = gapBendXsForHorizOffsets(
                        a,
                        trialA,
                        sideSpans,
                        diagramCenterX,
                        0,
                        layoutSync,
                      );
                      const committedB = gapBendXsForHorizOffsets(
                        b,
                        trialB,
                        sideSpans,
                        diagramCenterX,
                        0,
                        layoutSync,
                      );
                      if (
                        !laneBendsWithinBudget(
                          a,
                          committedA,
                          sideSpans,
                          diagramCenterX,
                          layoutSync,
                        ) ||
                        !laneBendsWithinBudget(
                          b,
                          committedB,
                          sideSpans,
                          diagramCenterX,
                          layoutSync,
                        )
                      ) {
                        if (
                          laneBendsWithinBudget(
                            a,
                            trialA,
                            sideSpans,
                            diagramCenterX,
                            layoutSync,
                          ) &&
                          laneBendsWithinBudget(
                            b,
                            trialB,
                            sideSpans,
                            diagramCenterX,
                            layoutSync,
                          )
                        ) {
                          lanes.set(a.id, trialA);
                          lanes.set(b.id, trialB);
                          changed = true;
                          resolved = true;
                          break dualKinds;
                        }
                        continue;
                      }
                      lanes.set(a.id, committedA);
                      lanes.set(b.id, committedB);
                      changed = true;
                      resolved = true;
                      break dualKinds;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    if (!changed) break;
  }
}

/** jogX trunk at sourceY vs plain target leg — targetHorizY on the non-jogX strand. */
function sealJogXGapHorizOverlaps(
  candidates: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
  layoutSync?: LayoutEndpointSync,
): void {
  const eligible = sortCandidatesByRowOrder(
    candidates.filter((c) => lanes.has(c.id) && !c.fullButtSplice),
  );
  if (eligible.length < 2) return;

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const candidate of eligible) {
    const ep = endpointsForCandidate(candidate, layoutSync);
    minY = Math.min(minY, ep.sourceY, ep.targetY);
    maxY = Math.max(maxY, ep.sourceY, ep.targetY);
  }
  const diagramCenterY = (minY + maxY) / 2;

  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i]!;
      const b = eligible[j]!;
      const laneA = lanes.get(a.id)!;
      const laneB = lanes.get(b.id)!;
      if (a.tubeBundleKey && a.tubeBundleKey === b.tubeBundleKey) continue;
      if (
        routingZoneKeyForCandidate(a, layoutSync) !==
        routingZoneKeyForCandidate(b, layoutSync)
      ) {
        continue;
      }
      const aJog = laneA.jogX !== undefined;
      const bJog = laneB.jogX !== undefined;
      if (aJog === bJog) continue;

      const plain = aJog
        ? { candidate: b, lane: laneB, jog: { candidate: a, lane: laneA } }
        : { candidate: a, lane: laneA, jog: { candidate: b, lane: laneB } };
      const ep = endpointsForCandidate(plain.candidate, layoutSync);
      const jogEp = endpointsForCandidate(plain.jog.candidate, layoutSync);
      const currentPlainLane0 = lanes.get(plain.candidate.id)!;
      const plainAlreadyOffset =
        currentPlainLane0.sourceHorizY !== undefined ||
        currentPlainLane0.targetHorizY !== undefined;

      const stackedJogTrunk =
        Math.abs(jogEp.sourceY - ep.targetY) <= SPLICE_PATH_EPS;
      if (
        !stackedJogTrunk &&
        !gapHorizSegmentsOverlap(
          a,
          laneA,
          b,
          laneB,
          sideSpans,
          diagramCenterX,
          layoutSync,
        )
      ) {
        continue;
      }

      let sealed = false;
      if (
        plainAlreadyOffset &&
        tryCommitJogHorizOffsetForPlainPartner(
          plain.jog.candidate,
          plain.candidate,
          jogEp,
          diagramCenterY,
          lanes,
          sideSpans,
          diagramCenterX,
          layoutSync,
        )
      ) {
        continue;
      }

      const targetSign = sideHorizLaneSign(ep.targetY, diagramCenterY);
      for (const sign of [targetSign, (targetSign === 1 ? -1 : 1) as 1 | -1]) {
        for (
          let step = 1;
          step <= MAX_GAP_HORIZ_DECONFLICT_STEPS && !sealed;
          step++
        ) {
          const currentPlainLane = lanes.get(plain.candidate.id)!;
          const targetBase = currentPlainLane.targetHorizY ?? ep.targetY;
          const trialY = plainTargetHorizYTrialLane(
            currentPlainLane,
            targetBase + sign * step * SPLICE_LANE_SEP,
          );
          const jogLaneNow = lanes.get(plain.jog.candidate.id)!;
          if (
            !stackedJogTrunk &&
            gapHorizSegmentsOverlap(
              plain.jog.candidate,
              jogLaneNow,
              plain.candidate,
              trialY,
              sideSpans,
              diagramCenterX,
              layoutSync,
            )
          ) {
            continue;
          }
          if (
            commitPlainHorizYTrialIfClear(
              plain.candidate,
              currentPlainLane,
              trialY,
              plain.jog.candidate,
              jogLaneNow,
              eligible,
              lanes,
              sideSpans,
              diagramCenterX,
              layoutSync,
              plainAlreadyOffset,
            )
          ) {
            sealed = true;
            break;
          }
        }
      }

      if (!sealed) {
        const currentPlainLane = lanes.get(plain.candidate.id)!;
        const sourceSign = sideHorizLaneSign(ep.sourceY, diagramCenterY);
        for (const sign of [sourceSign, (sourceSign === 1 ? -1 : 1) as 1 | -1]) {
          for (
            let step = 1;
            step <= MAX_GAP_HORIZ_DECONFLICT_STEPS && !sealed;
            step++
          ) {
            const sourceBase = currentPlainLane.sourceHorizY ?? ep.sourceY;
            const trialY = plainSourceHorizYTrialLane(
              currentPlainLane,
              sourceBase + sign * step * SPLICE_LANE_SEP,
            );
            const jogLaneNow = lanes.get(plain.jog.candidate.id)!;
            if (
              commitPlainHorizYTrialIfClear(
                plain.candidate,
                currentPlainLane,
                trialY,
                plain.jog.candidate,
                jogLaneNow,
                eligible,
                lanes,
                sideSpans,
                diagramCenterX,
                layoutSync,
                plainAlreadyOffset,
              )
            ) {
              sealed = true;
              break;
            }
          }
        }
      }

      if (!sealed) {
        const currentPlainLane = lanes.get(plain.candidate.id)!;
        const jogLaneNow = lanes.get(plain.jog.candidate.id)!;
        if (
          gapHorizSegmentsOverlap(
            plain.jog.candidate,
            jogLaneNow,
            plain.candidate,
            currentPlainLane,
            sideSpans,
            diagramCenterX,
            layoutSync,
          )
        ) {
          tryCommitJogHorizOffsetForPlainPartner(
            plain.jog.candidate,
            plain.candidate,
            jogEp,
            diagramCenterY,
            lanes,
            sideSpans,
            diagramCenterX,
            layoutSync,
          );
        }
      }
    }
  }
}

/** Gap-bend X; Y offsets applied only when gap horizontals would stack (EDGE-011). */
function assignSideHorizLanesWithGapBends(
  candidates: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
): void {
  stripSideHorizYOffsets(lanes);
  assignGapBendLaneXs(candidates, lanes, sideSpans, diagramCenterX);
  deconflictGapHorizontalLanes(
    candidates,
    lanes,
    sideSpans,
    diagramCenterX,
  );
  const horizOffsets = assignSideHorizLaneYs(
    candidates,
    lanes,
    sideSpans,
  );
  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  for (const [id, offsets] of horizOffsets) {
    const candidate = candidateById.get(id);
    const lane = lanes.get(id);
    if (!candidate || !lane) continue;
    const trial = { ...lane, ...offsets };
    if (laneBendsWithinBudget(candidate, trial, sideSpans, diagramCenterX)) {
      lanes.set(id, trial);
    }
  }
}

/**
 * Re-run gap horizontal deconflict after midX snap (grid assign).
 * Preserves midX and jogX; refreshes Y-track offsets for final lanes.
 */
function syncMidXLaneCandidatesToLayoutEndpoints(
  candidates: MidXLaneCandidate[],
  sync: LayoutEndpointSync,
): void {
  for (const candidate of candidates) {
    const connectionId = connectionIdFromHandleEntryId(candidate.id);
    const endpoints = layoutRuleHandleEndpointsForConnection(
      sync.graph,
      sync.visualCables,
      sync.nodes,
      connectionId,
    );
    if (!endpoints) continue;
    candidate.sourceX = endpoints.sourceX;
    candidate.sourceY = endpoints.sourceY;
    candidate.targetX = endpoints.targetX;
    candidate.targetY = endpoints.targetY;
  }
}

/** Align handle-entry coords with layoutRules spliceHandleEndpoints before path attach. */
export function syncHandleEntriesToLayoutEndpoints(
  entries: SpliceHandleEntry[],
  sync: LayoutEndpointSync,
): void {
  for (const entry of entries) {
    const connectionId = connectionIdFromHandleEntryId(entry.id);
    const endpoints = layoutRuleHandleEndpointsForConnection(
      sync.graph,
      sync.visualCables,
      sync.nodes,
      connectionId,
    );
    if (!endpoints) continue;
    entry.sourceX = endpoints.sourceX;
    entry.sourceY = endpoints.sourceY;
    entry.targetX = endpoints.targetX;
    entry.targetY = endpoints.targetY;
  }
}

export function reconcileGapHorizontalLanesAfterRouting(
  candidates: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  _sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
  layoutSync?: LayoutEndpointSync,
): void {
  if (layoutSync) {
    syncMidXLaneCandidatesToLayoutEndpoints(candidates, layoutSync);
  }
  for (const [id, lane] of lanes) {
    const cleared: SpliceRoutingLane = { ...lane };
    delete cleared.sourceHorizY;
    delete cleared.targetHorizY;
    delete cleared.sourceBendX;
    delete cleared.targetBendX;
    lanes.set(id, cleared);
  }
  const edge011Spans = _sideSpans;
  assignGapBendLaneXs(candidates, lanes, edge011Spans, diagramCenterX);
  deconflictGapHorizontalLanes(
    candidates,
    lanes,
    edge011Spans,
    diagramCenterX,
    layoutSync,
  );
  assignGapBendLaneXs(candidates, lanes, edge011Spans, diagramCenterX);
  const horizOffsets = assignSideHorizLaneYs(
    candidates,
    lanes,
    edge011Spans,
  );
  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  for (const [id, offsets] of horizOffsets) {
    const candidate = candidateById.get(id);
    const lane = lanes.get(id);
    if (!candidate || !lane) continue;
    const trial = gapBendXsForHorizOffsets(
      candidate,
      { ...lane, ...offsets },
      edge011Spans,
      diagramCenterX,
      0,
      layoutSync,
    );
    if (laneBendsWithinBudget(candidate, trial, edge011Spans, diagramCenterX, layoutSync)) {
      lanes.set(id, trial);
    } else {
      const yOnly = { ...lane, ...offsets };
      if (laneBendsWithinBudget(candidate, yOnly, edge011Spans, diagramCenterX, layoutSync)) {
        lanes.set(id, yOnly);
      }
    }
  }
  sealJogXGapHorizOverlaps(
    candidates,
    lanes,
    edge011Spans,
    diagramCenterX,
    layoutSync,
  );
  for (let pass = 0; pass < MAX_GAP_HORIZ_DECONFLICT_STEPS; pass++) {
    const before = JSON.stringify([...lanes.entries()]);
    sweepJogPlainTargetHorizYStacks(
      candidates,
      lanes,
      edge011Spans,
      diagramCenterX,
      layoutSync,
    );
    sealJogXGapHorizOverlaps(
      candidates,
      lanes,
      edge011Spans,
      diagramCenterX,
      layoutSync,
    );
    if (JSON.stringify([...lanes.entries()]) === before) break;
  }
  deconflictGapHorizontalLanes(
    candidates,
    lanes,
    edge011Spans,
    diagramCenterX,
    layoutSync,
  );
  resolveJogPlainGapHorizOverlaps(
    candidates,
    lanes,
    edge011Spans,
    diagramCenterX,
    layoutSync,
  );
  assignGapBendLaneXs(candidates, lanes, edge011Spans, diagramCenterX);
  resolveJogPlainSharedRowGapBendXs(
    candidates,
    lanes,
    edge011Spans,
    diagramCenterX,
    layoutSync,
  );
}

/** Post-merge jog trunk vs plain target stack — targetHorizY on plain (layout-rule endpoints). */
function sweepJogPlainTargetHorizYStacks(
  candidates: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX: number,
  layoutSync?: LayoutEndpointSync,
): void {
  const eligible = sortCandidatesByRowOrder(
    candidates.filter((c) => lanes.has(c.id) && !c.fullButtSplice),
  );
  if (eligible.length < 2) return;

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const candidate of eligible) {
    const ep = endpointsForCandidate(candidate, layoutSync);
    minY = Math.min(minY, ep.sourceY, ep.targetY);
    maxY = Math.max(maxY, ep.sourceY, ep.targetY);
  }
  const diagramCenterY = (minY + maxY) / 2;

  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i]!;
      const b = eligible[j]!;
      const laneA = lanes.get(a.id)!;
      const laneB = lanes.get(b.id)!;
      if (a.tubeBundleKey && a.tubeBundleKey === b.tubeBundleKey) continue;
      if (
        routingZoneKeyForCandidate(a, layoutSync) !==
        routingZoneKeyForCandidate(b, layoutSync)
      ) {
        continue;
      }
      const aJog = laneA.jogX !== undefined;
      const bJog = laneB.jogX !== undefined;
      if (aJog === bJog) continue;

      const plain = aJog
        ? { candidate: b, lane: laneB, jog: { candidate: a, lane: laneA } }
        : { candidate: a, lane: laneA, jog: { candidate: b, lane: laneB } };
      const ep = endpointsForCandidate(plain.candidate, layoutSync);
      const jogEp = endpointsForCandidate(plain.jog.candidate, layoutSync);
      const currentPlainLane0 = lanes.get(plain.candidate.id)!;
      const plainAlreadyOffset =
        currentPlainLane0.sourceHorizY !== undefined ||
        currentPlainLane0.targetHorizY !== undefined;

      const needsFix =
        Math.abs(jogEp.sourceY - ep.targetY) <= SPLICE_PATH_EPS ||
        gapHorizSegmentsOverlap(
          plain.jog.candidate,
          lanes.get(plain.jog.candidate.id)!,
          plain.candidate,
          currentPlainLane0,
          sideSpans,
          diagramCenterX,
          layoutSync,
        );
      if (!needsFix) continue;

      if (
        plainAlreadyOffset &&
        tryCommitJogHorizOffsetForPlainPartner(
          plain.jog.candidate,
          plain.candidate,
          jogEp,
          diagramCenterY,
          lanes,
          sideSpans,
          diagramCenterX,
          layoutSync,
        )
      ) {
        continue;
      }

      const targetSign = sideHorizLaneSign(ep.targetY, diagramCenterY);
      for (const sign of [targetSign, (targetSign === 1 ? -1 : 1) as 1 | -1]) {
        for (let step = 1; step <= MAX_GAP_HORIZ_DECONFLICT_STEPS; step++) {
          const currentPlainLane = lanes.get(plain.candidate.id)!;
          const targetBase = currentPlainLane.targetHorizY ?? ep.targetY;
          const trialY = plainTargetHorizYTrialLane(
            currentPlainLane,
            targetBase + sign * step * SPLICE_LANE_SEP,
          );
          const jogLaneNow = lanes.get(plain.jog.candidate.id)!;
          if (
            commitPlainHorizYTrialIfClear(
              plain.candidate,
              currentPlainLane,
              trialY,
              plain.jog.candidate,
              jogLaneNow,
              eligible,
              lanes,
              sideSpans,
              diagramCenterX,
              layoutSync,
              plainAlreadyOffset,
            )
          ) {
            break;
          }
        }
      }

      let currentPlainLane = lanes.get(plain.candidate.id)!;
      const jogLaneNow0 = lanes.get(plain.jog.candidate.id)!;
      if (
        gapHorizSegmentsOverlap(
          plain.jog.candidate,
          jogLaneNow0,
          plain.candidate,
          currentPlainLane,
          sideSpans,
          diagramCenterX,
          layoutSync,
        )
      ) {
        const sourceSign = sideHorizLaneSign(ep.sourceY, diagramCenterY);
        for (const sign of [sourceSign, (sourceSign === 1 ? -1 : 1) as 1 | -1]) {
          for (let step = 1; step <= MAX_GAP_HORIZ_DECONFLICT_STEPS; step++) {
            const sourceBase = currentPlainLane.sourceHorizY ?? ep.sourceY;
            const trialY = plainSourceHorizYTrialLane(
              currentPlainLane,
              sourceBase + sign * step * SPLICE_LANE_SEP,
            );
            const jogLaneNow = lanes.get(plain.jog.candidate.id)!;
            if (
              commitPlainHorizYTrialIfClear(
                plain.candidate,
                currentPlainLane,
                trialY,
                plain.jog.candidate,
                jogLaneNow,
                eligible,
                lanes,
                sideSpans,
                diagramCenterX,
                layoutSync,
                plainAlreadyOffset,
              )
            ) {
              currentPlainLane = trialY;
              break;
            }
          }
        }
      }

      currentPlainLane = lanes.get(plain.candidate.id)!;
      const jogLaneNow = lanes.get(plain.jog.candidate.id)!;
      if (
        gapHorizSegmentsOverlap(
          plain.jog.candidate,
          jogLaneNow,
          plain.candidate,
          currentPlainLane,
          sideSpans,
          diagramCenterX,
          layoutSync,
        )
      ) {
        tryCommitJogHorizOffsetForPlainPartner(
          plain.jog.candidate,
          plain.candidate,
          jogEp,
          diagramCenterY,
          lanes,
          sideSpans,
          diagramCenterX,
          layoutSync,
        );
      }
    }
  }
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
): Array<{ kind: "h"; y: number; x0: number; x1: number }> {
  return spliceRouteHorizontalSegments(
    candidate.sourceX,
    candidate.sourceY,
    candidate.targetX,
    candidate.targetY,
    lane.midX,
    lane.jogX,
    { sourceHorizY, targetHorizY },
    lane,
    sideSpans,
    columnCenterXForCandidate(candidate),
  );
}

function horizTrackSegmentsOverlap(
  a: { kind: "h"; y: number; x0: number; x1: number },
  b: { kind: "h"; y: number; x0: number; x1: number },
): boolean {
  if (Math.abs(a.y - b.y) > SPLICE_PATH_EPS) return false;
  const loA = Math.min(a.x0, a.x1);
  const hiA = Math.max(a.x0, a.x1);
  const loB = Math.min(b.x0, b.x1);
  const hiB = Math.max(b.x0, b.x1);
  return Math.min(hiA, hiB) - Math.max(loA, loB) > SPLICE_PATH_EPS;
}

function horizSegmentsOverlapOccupied(
  segments: Array<{ kind: "h"; y: number; x0: number; x1: number }>,
  occupied: Array<{ kind: "h"; y: number; x0: number; x1: number }>,
): boolean {
  return occupied.some((existing) =>
    segments.some((seg) => horizTrackSegmentsOverlap(seg, existing)),
  );
}

function horizOffsetsForBundleLane(
  members: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  diagramCenterY: number,
  sideSpans: SideCircuitLabelSpan,
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
  occupied: Array<{ kind: "h"; y: number; x0: number; x1: number }>,
  result: Map<string, Pick<SpliceRoutingLane, "sourceHorizY" | "targetHorizY">>,
): void {
  const sorted = sortCandidatesByRowOrder(members);
  let sourceLane = 0;
  let targetLane = 0;
  let attempts = 0;

  for (;;) {
    if (attempts++ > MAX_SIDE_HORIZ_LANE_ATTEMPTS) {
      return;
    }
    const attempt = horizOffsetsForBundleLane(
      sorted,
      lanes,
      diagramCenterY,
      sideSpans,
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
export function assignSideHorizLaneYs(
  candidates: MidXLaneCandidate[],
  lanes: Map<string, SpliceRoutingLane>,
  sideSpans: SideCircuitLabelSpan = defaultSideCircuitLabelSpan(),
): Map<string, Pick<SpliceRoutingLane, "sourceHorizY" | "targetHorizY">> {
  const result = new Map<
    string,
    Pick<SpliceRoutingLane, "sourceHorizY" | "targetHorizY">
  >();
  if (candidates.length === 0) return result;

  const diagramCenterX = globalDiagramCenterX(candidates);

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

  for (const candidate of sortCandidatesByRowOrder(eligible)) {
    if (candidate.fullButtSplice) continue;
    const lane = lanes.get(candidate.id)!;
    const srcHY = lane.sourceHorizY ?? candidate.sourceY;
    const tgtHY = lane.targetHorizY ?? candidate.targetY;
    const hasOffset =
      Math.abs(srcHY - candidate.sourceY) > SPLICE_PATH_EPS ||
      Math.abs(tgtHY - candidate.targetY) > SPLICE_PATH_EPS;
    if (!hasOffset) continue;
    occupied.push(
      ...horizontalSegmentsForLane(
        candidate,
        lane,
        srcHY,
        tgtHY,
        sideSpans,
      ),
    );
    processed.add(candidate.id);
  }

  const bundleGroups = groupCandidatesByTubeBundle(
    eligible.filter((c) => c.tubeBundleKey),
  ).filter((bundle) => bundle.length > 1);

  for (const bundle of bundleGroups.sort((a, b) => {
    const minA = Math.min(...a.map((m) => m.rowOffset));
    const minB = Math.min(...b.map((m) => m.rowOffset));
    return minA - minB;
  })) {
    if (sameSideLoopBundleSkipsJogX(bundle)) {
      continue;
    }
    assignHorizLanesForTubeBundle(
      bundle,
      lanes,
      diagramCenterY,
      sideSpans,
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

    let lastSourceHorizY = candidate.sourceY;
    let lastTargetHorizY = candidate.targetY;

    for (;;) {
      if (attempts++ > MAX_SIDE_HORIZ_LANE_ATTEMPTS) {
        const forced: Pick<
          SpliceRoutingLane,
          "sourceHorizY" | "targetHorizY"
        > = {};
        if (Math.abs(lastSourceHorizY - candidate.sourceY) > SPLICE_PATH_EPS) {
          forced.sourceHorizY = lastSourceHorizY;
        }
        if (Math.abs(lastTargetHorizY - candidate.targetY) > SPLICE_PATH_EPS) {
          forced.targetHorizY = lastTargetHorizY;
        }
        const forcedTrial = gapBendXsForHorizOffsets(
          candidate,
          { ...lane, ...forced },
          sideSpans,
          diagramCenterX,
        );
        if (
          (forced.sourceHorizY !== undefined ||
            forced.targetHorizY !== undefined) &&
          laneBendsWithinBudget(
            candidate,
            forcedTrial,
            sideSpans,
            diagramCenterX,
          )
        ) {
          result.set(candidate.id, forced);
          occupied.push(
            ...horizontalSegmentsForLane(
              candidate,
              forcedTrial,
              lastSourceHorizY,
              lastTargetHorizY,
              sideSpans,
            ),
          );
        } else if (
          (forced.sourceHorizY !== undefined ||
            forced.targetHorizY !== undefined) &&
          laneBendsWithinBudget(
            candidate,
            { ...lane, ...forced },
            sideSpans,
            diagramCenterX,
          )
        ) {
          result.set(candidate.id, forced);
          occupied.push(
            ...horizontalSegmentsForLane(
              candidate,
              { ...lane, ...forced },
              lastSourceHorizY,
              lastTargetHorizY,
              sideSpans,
            ),
          );
        }
        break;
      }
      const sourceHorizY =
        candidate.sourceY + sourceSign * sourceLane * SPLICE_LANE_SEP;
      const targetHorizY =
        candidate.targetY + targetSign * targetLane * SPLICE_LANE_SEP;
      lastSourceHorizY = sourceHorizY;
      lastTargetHorizY = targetHorizY;
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
      const trial = gapBendXsForHorizOffsets(
        candidate,
        { ...lane, ...offsets },
        sideSpans,
        diagramCenterX,
      );
      const segments = horizontalSegmentsForLane(
        candidate,
        trial,
        sourceHorizY,
        targetHorizY,
        sideSpans,
      );
      if (!horizSegmentsOverlapOccupied(segments, occupied)) {
        if (
          !laneBendsWithinBudget(
            candidate,
            trial,
            sideSpans,
            diagramCenterX,
          )
        ) {
          if (
            laneBendsWithinBudget(
              candidate,
              { ...lane, ...offsets },
              sideSpans,
              diagramCenterX,
            )
          ) {
            occupied.push(
              ...horizontalSegmentsForLane(
                candidate,
                { ...lane, ...offsets },
                sourceHorizY,
                targetHorizY,
                sideSpans,
              ),
            );
            if (
              offsets.sourceHorizY !== undefined ||
              offsets.targetHorizY !== undefined
            ) {
              result.set(candidate.id, offsets);
            }
            break;
          }
          if (offsets.sourceHorizY !== undefined) sourceLane += 1;
          if (offsets.targetHorizY !== undefined) targetLane += 1;
          if (
            offsets.sourceHorizY === undefined &&
            offsets.targetHorizY === undefined
          ) {
            sourceLane += 1;
            targetLane += 1;
          }
          continue;
        }
        occupied.push(...segments);
        if (
          offsets.sourceHorizY !== undefined ||
          offsets.targetHorizY !== undefined
        ) {
          result.set(candidate.id, offsets);
        }
        break;
      }

      const sourceSegs = spliceRouteHorizontalSegments(
        candidate.sourceX,
        candidate.sourceY,
        candidate.targetX,
        candidate.targetY,
        lane.midX,
        lane.jogX,
        { sourceHorizY, targetHorizY: candidate.targetY },
        lane,
        sideSpans,
        columnCenterXForCandidate(candidate),
        candidate.sourceTagWidth ?? 0,
        candidate.targetTagWidth ?? 0,
      );
      const targetSegs = spliceRouteHorizontalSegments(
        candidate.sourceX,
        candidate.sourceY,
        candidate.targetX,
        candidate.targetY,
        lane.midX,
        lane.jogX,
        { sourceHorizY: candidate.sourceY, targetHorizY },
        lane,
        sideSpans,
        columnCenterXForCandidate(candidate),
        candidate.sourceTagWidth ?? 0,
        candidate.targetTagWidth ?? 0,
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
  }

  return result;
}

/** Map layout handle entries to midX lane candidates (plan §4.4 step 1–3 inputs). */
export function handleEntriesToCandidates(
  entries: SpliceHandleEntry[],
): MidXLaneCandidate[] {
  return entries.map((entry) => ({
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
}

function verticalYSpanForCandidate(
  candidate: MidXLaneCandidate,
  sourceHorizY?: number,
  targetHorizY?: number,
): { y0: number; y1: number } {
  const srcHY = sourceHorizY ?? candidate.sourceY;
  const tgtHY = targetHorizY ?? candidate.targetY;
  const spliceY = (candidate.sourceY + candidate.targetY) / 2;
  return {
    y0: Math.min(srcHY, spliceY, tgtHY, candidate.sourceY, candidate.targetY),
    y1: Math.max(srcHY, spliceY, tgtHY, candidate.sourceY, candidate.targetY),
  };
}

function globalCenterMidXBounds(
  candidates: MidXLaneCandidate[],
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
): { lo: number; hi: number } {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const routing = spliceRoutingBounds(candidate.sourceX, candidate.targetX);
    const inset = spliceMidXInsetBounds(
      candidate.sourceX,
      candidate.targetX,
      diagramCenterX,
      sideSpans,
    );
    const effectiveLo = Math.max(routing.lo, inset.lo);
    const effectiveHi = Math.min(
      routing.hi,
      inset.hi <= inset.lo ? routing.hi : inset.hi,
    );
    lo = Math.min(lo, effectiveLo);
    hi = Math.max(hi, effectiveHi);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return { lo: diagramCenterX - SPLICE_LANE_SEP, hi: diagramCenterX + SPLICE_LANE_SEP };
  }
  return { lo, hi };
}

function vertLaneConflictsOccupied(
  x: number,
  y0: number,
  y1: number,
  occupied: Array<{ x: number; y0: number; y1: number }>,
): boolean {
  return occupied.some((existing) =>
    vertLanePairConflicts(x, y0, y1, existing.x, existing.y0, existing.y1),
  );
}

function vertLanePairConflicts(
  xA: number,
  y0A: number,
  y1A: number,
  xB: number,
  y0B: number,
  y1B: number,
): boolean {
  return (
    Math.abs(xA - xB) < SPLICE_LANE_SEP - SPLICE_PATH_EPS &&
    verticalSpanOverlaps(y0A, y1A, y0B, y1B)
  );
}

function findF2VertLaneX(
  candidate: MidXLaneCandidate,
  idealMidX: number,
  ySpan: { y0: number; y1: number },
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
  globalBounds: { lo: number; hi: number },
  occupied: Array<{ x: number; y0: number; y1: number }>,
): number {
  const columnX = (candidate.sourceX + candidate.targetX) / 2;
  const inward =
    inwardSignForColumn(columnX, diagramCenterX) > 0 ? 1 : -1;
  const zoneBounds = vertLanePackBounds(
    candidate.sourceX,
    candidate.targetX,
    diagramCenterX,
    sideSpans,
  );
  const searchLo = Math.min(globalBounds.lo, zoneBounds.lo);
  const searchHi = Math.max(globalBounds.hi, zoneBounds.hi);

  for (let ring = 0; ring <= 96; ring++) {
    const offsets =
      ring === 0
        ? [0]
        : Array.from({ length: ring }, (_, i) => (i + 1) * SPLICE_LANE_SEP).flatMap(
            (delta) => [inward * delta, -inward * delta],
          );
    for (const offset of offsets) {
      const x = idealMidX + offset;
      if (x < searchLo - SPLICE_PATH_EPS || x > searchHi + SPLICE_PATH_EPS) {
        continue;
      }
      if (!vertLaneConflictsOccupied(x, ySpan.y0, ySpan.y1, occupied)) {
        return x;
      }
    }
  }

  for (
    let x = searchLo;
    x <= searchHi + SPLICE_PATH_EPS;
    x += SPLICE_LANE_SEP
  ) {
    if (!vertLaneConflictsOccupied(x, ySpan.y0, ySpan.y1, occupied)) {
      return x;
    }
  }

  return idealMidX + inward * occupied.length * SPLICE_LANE_SEP;
}

function midXClearsHandleInsets(
  midX: number,
  candidate: MidXLaneCandidate,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
): boolean {
  return (
    horizontalInsetOkFromHandle(
      midX,
      candidate.sourceX,
      diagramCenterX,
      sideSpans,
      MIN_SPLICE_HORIZONTAL_INSET,
      candidate.sourceTagWidth ?? 0,
    ) &&
    horizontalInsetOkFromHandle(
      midX,
      candidate.targetX,
      diagramCenterX,
      sideSpans,
      MIN_SPLICE_HORIZONTAL_INSET,
      candidate.targetTagWidth ?? 0,
    )
  );
}

function pickF2ClearMidX(
  candidate: MidXLaneCandidate,
  tryRaw: number,
  ySpan: { y0: number; y1: number },
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
  occupied: Array<{ x: number; y0: number; y1: number }>,
): number | null {
  const clamped = clampMidXForCandidate(
    tryRaw,
    candidate,
    diagramCenterX,
    sideSpans,
  );
  if (
    !vertLaneConflictsOccupied(clamped, ySpan.y0, ySpan.y1, occupied) &&
    midXClearsHandleInsets(clamped, candidate, diagramCenterX, sideSpans)
  ) {
    return clamped;
  }
  if (
    !vertLaneConflictsOccupied(tryRaw, ySpan.y0, ySpan.y1, occupied) &&
    midXClearsHandleInsets(tryRaw, candidate, diagramCenterX, sideSpans)
  ) {
    return tryRaw;
  }
  return null;
}

function placeF2MidXIfNeeded(
  candidate: MidXLaneCandidate,
  idealMidX: number,
  midXMap: Map<string, number>,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
  globalBounds: { lo: number; hi: number },
  occupied: Array<{ x: number; y0: number; y1: number }>,
): void {
  const ySpan = verticalYSpanForCandidate(candidate);
  const columnX = (candidate.sourceX + candidate.targetX) / 2;
  const inward =
    inwardSignForColumn(columnX, diagramCenterX) > 0 ? 1 : -1;

  let midX: number | null = null;
  for (let attempt = 0; attempt <= 128; attempt++) {
    const tryRaw =
      attempt === 0
        ? idealMidX
        : idealMidX + inward * attempt * SPLICE_LANE_SEP;
    midX = pickF2ClearMidX(
      candidate,
      tryRaw,
      ySpan,
      diagramCenterX,
      sideSpans,
      occupied,
    );
    if (midX !== null) break;
  }

  if (midX === null) {
    midX = findF2VertLaneX(
      candidate,
      idealMidX,
      ySpan,
      diagramCenterX,
      sideSpans,
      globalBounds,
      occupied,
    );
    midX =
      pickF2ClearMidX(
        candidate,
        midX,
        ySpan,
        diagramCenterX,
        sideSpans,
        occupied,
      ) ?? midX;
  }

  midXMap.set(candidate.id, midX);
  occupied.push({ x: midX, y0: ySpan.y0, y1: ySpan.y1 });
}

function assignGlobalF2BundleVertLaneMidXs(
  members: MidXLaneCandidate[],
  midXMap: Map<string, number>,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
  globalBounds: { lo: number; hi: number },
  occupied: Array<{ x: number; y0: number; y1: number }>,
): void {
  const sorted = sortCandidatesByRowOrder(members);
  if (sorted.length === 0) return;

  const columnX = (sorted[0]!.sourceX + sorted[0]!.targetX) / 2;
  const inward =
    inwardSignForColumn(columnX, diagramCenterX) > 0 ? 1 : -1;

  for (let bundleShift = 0; bundleShift <= 96; bundleShift++) {
    const placements: Array<{
      candidate: MidXLaneCandidate;
      x: number;
      y0: number;
      y1: number;
    }> = [];
    let allClear = true;

    for (const candidate of sorted) {
      const idealMidX = midXMap.get(candidate.id);
      if (idealMidX === undefined) {
        allClear = false;
        break;
      }
      const tryX = idealMidX + inward * bundleShift * SPLICE_LANE_SEP;
      const ySpan = verticalYSpanForCandidate(candidate);
      if (
        vertLaneConflictsOccupied(tryX, ySpan.y0, ySpan.y1, occupied) ||
        placements.some((planned) =>
          vertLanePairConflicts(
            tryX,
            ySpan.y0,
            ySpan.y1,
            planned.x,
            planned.y0,
            planned.y1,
          ),
        )
      ) {
        allClear = false;
        break;
      }
      placements.push({ candidate, x: tryX, y0: ySpan.y0, y1: ySpan.y1 });
    }

    if (allClear) {
      for (const placement of placements) {
        const placed =
          pickF2ClearMidX(
            placement.candidate,
            placement.x,
            { y0: placement.y0, y1: placement.y1 },
            diagramCenterX,
            sideSpans,
            occupied,
          ) ?? placement.x;
        midXMap.set(placement.candidate.id, placed);
        occupied.push({ x: placed, y0: placement.y0, y1: placement.y1 });
      }
      return;
    }
  }

  for (const candidate of sorted) {
    const idealMidX = midXMap.get(candidate.id) ?? diagramCenterX;
    placeF2MidXIfNeeded(
      candidate,
      idealMidX,
      midXMap,
      diagramCenterX,
      sideSpans,
      globalBounds,
      occupied,
    );
  }
}

function assignGlobalF2VertLaneMidXs(
  candidates: MidXLaneCandidate[],
  midXMap: Map<string, number>,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
): void {
  const globalBounds = globalCenterMidXBounds(
    candidates,
    diagramCenterX,
    sideSpans,
  );
  const occupied: Array<{ x: number; y0: number; y1: number }> = [];
  const processed = new Set<string>();

  const bundleGroups = groupCandidatesByTubeBundle(
    candidates.filter((c) => c.tubeBundleKey && !c.fullButtSplice),
  ).filter((bundle) => bundle.length > 1);

  for (const bundle of bundleGroups.sort((a, b) => {
    const minA = Math.min(...a.map((m) => m.rowOffset));
    const minB = Math.min(...b.map((m) => m.rowOffset));
    return minA - minB;
  })) {
    assignGlobalF2BundleVertLaneMidXs(
      bundle,
      midXMap,
      diagramCenterX,
      sideSpans,
      globalBounds,
      occupied,
    );
    for (const member of bundle) {
      processed.add(member.id);
    }
  }

  const singles = sortCandidatesByRowOrder(
    candidates.filter((c) => !processed.has(c.id) && !c.fullButtSplice),
  );

  for (const candidate of singles) {
    const idealMidX = midXMap.get(candidate.id);
    if (idealMidX === undefined) continue;
    placeF2MidXIfNeeded(
      candidate,
      idealMidX,
      midXMap,
      diagramCenterX,
      sideSpans,
      globalBounds,
      occupied,
    );
  }
}

/**
 * §4.4 steps 4–5: zone-packed midX plus global F2-by-construction vertical lanes.
 * Replaces legacy `assignSpliceMidXLanes` + `assignSideVertLaneXs` for the center router.
 */
function assignCenterMidXLanes(
  candidates: MidXLaneCandidate[],
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
): Map<string, number> {
  const midXMap = assignSpliceMidXLanes(candidates, sideSpans);
  for (const candidate of candidates) {
    const raw = midXMap.get(candidate.id);
    if (raw === undefined) continue;
    midXMap.set(
      candidate.id,
      clampMidXForCandidate(raw, candidate, diagramCenterX, sideSpans),
    );
  }
  assignGlobalF2VertLaneMidXs(candidates, midXMap, diagramCenterX, sideSpans);
  return midXMap;
}

function assignSpliceRoutingLanesFromMidXMap(
  candidates: MidXLaneCandidate[],
  midXMap: Map<string, number>,
  sideSpans: SideCircuitLabelSpan,
  diagramCenterX = globalDiagramCenterX(candidates),
): Map<string, SpliceRoutingLane> {
  const result = new Map<string, SpliceRoutingLane>();
  const candidateById = new Map(candidates.map((c) => [c.id, c]));

  for (const candidate of candidates) {
    const midX = midXMap.get(candidate.id);
    if (midX === undefined) continue;
    result.set(candidate.id, { midX });
  }

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

  assignSideHorizLanesWithGapBends(
    candidates,
    result,
    sideSpans,
    diagramCenterX,
  );

  return result;
}

/**
 * Center lane assignment entry point for the nodes routing engine (plan §4.4).
 */
export function assignCenterLanes(
  entries: SpliceHandleEntry[],
  diagramCenterX: number,
): Map<string, SpliceRoutingLane> {
  if (entries.length === 0) return new Map();

  const sideSpans =
    entries.find((entry) => entry.sideCircuitSpan)?.sideCircuitSpan ??
    defaultSideCircuitLabelSpan();
  const candidates = handleEntriesToCandidates(entries);
  const midXMap = assignCenterMidXLanes(candidates, diagramCenterX, sideSpans);
  return assignSpliceRoutingLanesFromMidXMap(
    candidates,
    midXMap,
    sideSpans,
    diagramCenterX,
  );
}
