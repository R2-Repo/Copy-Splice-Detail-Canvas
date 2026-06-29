/**
 * Barrel for splice routing — path geometry in splicePathGeometry.ts;
 * lane packing in spliceCenterLanes.ts; handle extraction in spliceHandleEntries.ts.
 */
import {
  assignGapBendLaneXs,
  assignSideHorizLaneYs,
} from "@/features/diagram/spliceCenterLanes";

export {
  assignCenterLanes,
  assignGapBendLaneXs,
  assignSideHorizLaneYs,
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
  sourceTubeDotGroupKey,
  spliceTubeBundleKey,
  type MidXLaneCandidate,
} from "@/features/diagram/spliceCenterLanes";

export {
  buildButtSplicePath,
  buildDemarcatedSplicePaths,
  buildOrthogonalSplicePath,
  buildSplicePath,
  reconcileBufferTubeDotColumns,
  resolveFusionDotPosition,
  fusionDotLiesOnHorizontal,
  type FusionDotOptions,
  BUTT_SPLICE_STRAIGHT_Y_TOLERANCE,
  clampButtSpliceMidX,
  clampMidXForMinHorizontalInset,
  canvasSideForHandle,
  circuitLabelSpanForSide,
  countOrthogonalBends,
  defaultSideCircuitLabelSpan,
  effectiveRoutingLane,
  effectiveSpliceLaneSep,
  enforceMinHorizontalInset,
  fiberHandlePosition,
  FUSION_DOT_MIN_CORNER_CLEARANCE,
  horizontalInsetOkFromHandle,
  hvDemarcatedPathsCross,
  inwardClearXBeforeVertical,
  inwardSignForColumn,
  isCenterVerticalCrossingHandleRowLeadIn,
  isNestedHandleRowHorizOverlap,
  isSameColumnSplice,
  isSharedSpliceRowLeadInOverlap,
  isTwoBendRoutingCrossing,
  labelColumnRunForSide,
  laneClearXBeforeVertical,
  MAX_SPLICE_BENDS,
  maxSpliceBendsForLane,
  minClearMidXForHandle,
  minHorizontalRunFromHandle,
  parallelSpliceSegmentsOverlap,
  parseButtTubeEndpointsFromEdgeId,
  parseOrthogonalPathPoints,
  pathCornerClearanceFromFusionDot,
  pathDistanceToNearestCorner,
  parseTubeHandleId,
  pickSpliceRouteTemplate,
  reconcileBundleJogXForRender,
  resolveButtSpliceMidX,
  resolveSpliceMidX,
  routingLaneDataFromLane,
  routingLaneFromData,
  routingLaneFromEntries,
  routingMidXForRender,
  sortSpliceRouteEntries,
  sourceHorizontalLeg,
  SPLICE_PATH_EPS,
  spliceMidOrderInverts,
  spliceMidX,
  spliceMidXFromRowOffset,
  spliceMidXInsetBounds,
  splicePathsAvoidHandleColumnVertical,
  spliceRouteHorizontalSegments,
  spliceRouteSegments,
  spliceRoutingBounds,
  spliceRoutingSpan,
  targetClearXBeforeVertical,
  targetHorizontalLeg,
  templateUsesMidXLanes,
  tubeHandlePosition,
  type SpliceEdgeRouteEntry,
  type SplicePathResult,
  type SpliceRouteTemplate,
  type SpliceRoutingLane,
  type SpliceRoutingLaneData,
} from "@/features/canvas/edges/splicePathGeometry";

export {
  buildSpliceHandleEntries,
  type SpliceHandleEntry,
} from "@/features/canvas/edges/spliceHandleEntries";

/** @internal SDC-ROUTE-003-B — exported for unit tests. */
export const spliceLaneYTrackHelpers = {
  assignSideHorizLaneYs,
  assignGapBendLaneXs,
};

/** Legacy drag registry removed — nodes engine uses precomputed paths only. */
export function publishDragRoutingSnapshot(
  _entries?: unknown,
  _diagramCenterX?: number,
): void {}

export function setActiveDragCableNodeId(_nodeId: string | null): void {}

export function getActiveDragCableNodeId(): null {
  return null;
}

/** @internal no-op — registry deleted */
export function resetSpliceRouteRegistryForTests(): void {}
