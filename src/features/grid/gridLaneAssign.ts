import type { SpliceHandleEntry } from "@/features/canvas/edges/spliceHandleEntries";
import {
  buildSplicePath,
  defaultSideCircuitLabelSpan,
  inwardSignForColumn,
  maxSpliceBendsForLane,
  parallelSpliceSegmentsOverlap,
  spliceRouteSegments,
  SPLICE_PATH_EPS,
} from "@/features/canvas/edges/splicePathGeometry";
import {
  routeCenterSplices,
  type SpliceRoutingLane,
} from "@/features/diagram/centerRouter";
import { SPLICE_LANE_SEP } from "@/features/diagram/cableLayoutMetrics";
import { applyLocksToGrid } from "@/features/layoutHybrid/applyLocksToGrid";
import {
  handleEntriesToCandidates,
  reconcileGapHorizontalLanesAfterRouting,
} from "@/features/diagram/spliceCenterLanes";
import type { LayoutOverrides } from "@/types/splice";

import {
  gridRouteFromSplicePath,
  splicePathFromGridRoute,
} from "./gridPathAdapter";
import {
  releaseReservations,
  releaseRouteOccupancy,
  reserveRouteSegments,
  segmentIdsForRoute,
} from "./reservation";
import { snapToLaneSep, snapX, snapY } from "./snap";
import type { GridMap, GridPoint, GridRoute } from "./gridTypes";

function connectionIdFromEdgeId(edgeId: string): string {
  return edgeId
    .replace(/^splice-left-/, "")
    .replace(/^splice-right-/, "")
    .replace(/^splice-/, "")
    .replace(/^butt-/, "");
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

function horizSegmentsForEntry(
  entry: SpliceHandleEntry,
  lane: SpliceRoutingLane,
): Array<{ kind: "h"; y: number; x0: number; x1: number }> {
  const sourceHorizY = lane.sourceHorizY ?? entry.sourceY;
  const targetHorizY = lane.targetHorizY ?? entry.targetY;
  return spliceRouteSegments(
    entry.sourceX,
    entry.sourceY,
    entry.targetX,
    entry.targetY,
    lane.midX,
    lane.jogX,
    {
      sourceHorizY,
      targetHorizY,
      sourceBendX: lane.sourceBendX,
      targetBendX: lane.targetBendX,
    },
  ).filter(
    (seg): seg is { kind: "h"; y: number; x0: number; x1: number } =>
      seg.kind === "h",
  );
}

function horizSegmentsOverlapOccupied(
  segments: Array<{ kind: "h"; y: number; x0: number; x1: number }>,
  occupied: Array<{ kind: "h"; y: number; x0: number; x1: number }>,
): boolean {
  return occupied.some((existing) =>
    segments.some((seg) => parallelSpliceSegmentsOverlap(seg, existing)),
  );
}

function laneBendsWithinBudgetForEntry(
  entry: SpliceHandleEntry,
  lane: SpliceRoutingLane,
  diagramCenterX: number,
): boolean {
  const sideSpans = entry.sideCircuitSpan ?? defaultSideCircuitLabelSpan();
  const { bendCount } = buildSplicePath(
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
    sideSpans,
    diagramCenterX,
    entry.sourceTagWidth ?? 0,
    entry.targetTagWidth ?? 0,
  );
  return (
    bendCount <=
    maxSpliceBendsForLane(entry.sourceY, entry.targetY, lane)
  );
}

function assignHorizYAvoidOverlap(
  entry: SpliceHandleEntry,
  lane: SpliceRoutingLane,
  diagramCenterY: number,
  diagramCenterX: number,
  occupied: Array<{ kind: "h"; y: number; x0: number; x1: number }>,
): SpliceRoutingLane {
  const sourceSign = entry.sourceY <= diagramCenterY ? 1 : -1;
  const targetSign = entry.targetY <= diagramCenterY ? 1 : -1;
  const defaultSegments = horizSegmentsForEntry(entry, lane);
  if (!horizSegmentsOverlapOccupied(defaultSegments, occupied)) {
    occupied.push(...defaultSegments);
    return lane;
  }

  for (let sourceLane = 0; sourceLane <= 128; sourceLane++) {
    for (let targetLane = 0; targetLane <= 128; targetLane++) {
      const sourceHorizY =
        entry.sourceY + sourceSign * sourceLane * SPLICE_LANE_SEP;
      const targetHorizY =
        entry.targetY + targetSign * targetLane * SPLICE_LANE_SEP;
      const trial: SpliceRoutingLane = { ...lane };
      if (Math.abs(sourceHorizY - entry.sourceY) > SPLICE_PATH_EPS) {
        trial.sourceHorizY = snapToLaneSep(sourceHorizY);
      } else {
        delete trial.sourceHorizY;
      }
      if (Math.abs(targetHorizY - entry.targetY) > SPLICE_PATH_EPS) {
        trial.targetHorizY = snapToLaneSep(targetHorizY);
      } else {
        delete trial.targetHorizY;
      }
      const segments = horizSegmentsForEntry(entry, trial);
      if (
        !horizSegmentsOverlapOccupied(segments, occupied) &&
        laneBendsWithinBudgetForEntry(entry, trial, diagramCenterX)
      ) {
        occupied.push(...segments);
        return trial;
      }
    }
  }

  occupied.push(...defaultSegments);
  return lane;
}

function snapLaneMidXAvoidOverlap(
  baseLane: SpliceRoutingLane,
  entry: SpliceHandleEntry,
  grid: GridMap,
  diagramCenterX: number,
  occupied: Array<{ x: number; y0: number; y1: number }>,
): number {
  const columnX = (entry.sourceX + entry.targetX) / 2;
  const inward = inwardSignForColumn(columnX, diagramCenterX) > 0 ? 1 : -1;
  const spliceY = (entry.sourceY + entry.targetY) / 2;
  const srcHY = baseLane.sourceHorizY ?? entry.sourceY;
  const tgtHY = baseLane.targetHorizY ?? entry.targetY;
  const y0 = Math.min(srcHY, spliceY, tgtHY);
  const y1 = Math.max(srcHY, spliceY, tgtHY);

  for (let attempt = 0; attempt <= 64; attempt++) {
    const candidateX = snapX(
      grid,
      baseLane.midX + inward * attempt * SPLICE_LANE_SEP,
    );
    const conflict = occupied.some(
      (existing) =>
        Math.abs(existing.x - candidateX) <= SPLICE_PATH_EPS &&
        verticalSpanOverlaps(y0, y1, existing.y0, existing.y1),
    );
    if (!conflict) {
      occupied.push({ x: candidateX, y0, y1 });
      return candidateX;
    }
  }

  const fallback = snapX(grid, baseLane.midX);
  occupied.push({ x: fallback, y0, y1 });
  return fallback;
}

function snapLaneToGrid(lane: SpliceRoutingLane, grid: GridMap): SpliceRoutingLane {
  return {
    midX: snapX(grid, lane.midX),
    jogX: lane.jogX !== undefined ? snapX(grid, lane.jogX) : undefined,
    sourceHorizY:
      lane.sourceHorizY !== undefined ? snapY(grid, lane.sourceHorizY) : undefined,
    targetHorizY:
      lane.targetHorizY !== undefined ? snapY(grid, lane.targetHorizY) : undefined,
    sourceBendX:
      lane.sourceBendX !== undefined ? snapX(grid, lane.sourceBendX) : undefined,
    targetBendX:
      lane.targetBendX !== undefined ? snapX(grid, lane.targetBendX) : undefined,
  };
}

function sortedEntryIds(entries: SpliceHandleEntry[]): string[] {
  return [...entries]
    .sort(
      (a, b) =>
        (a.rowOffset ?? a.fallbackLane) - (b.rowOffset ?? b.fallbackLane) ||
        a.fallbackLane - b.fallbackLane ||
        a.sourceY - b.sourceY ||
        a.targetY - b.targetY ||
        a.id.localeCompare(b.id),
    )
    .map((e) => e.id);
}

function buildGridRoute(
  grid: GridMap,
  connectionId: string,
  points: GridPoint[],
): GridRoute {
  return {
    connectionId,
    points,
    segmentIds: segmentIdsForRoute(grid, points),
  };
}

function tryReserveRoute(
  grid: GridMap,
  route: GridRoute,
): { ok: boolean; conflicts: string[] } {
  const { ok, conflicts } = reserveRouteSegments(grid, route);
  if (!ok) {
    releaseReservations(grid, route.connectionId);
  }
  return { ok, conflicts };
}

export type AssignGridLanesResult = {
  lanes: Map<string, SpliceRoutingLane>;
  routes: Map<string, GridRoute>;
};

export type AssignGridLanesOptions = {
  /** When set, reuse cached lanes for other connections (live cable drag). */
  rerouteConnectionIds?: Set<string>;
  cachedLanesByEdgeId?: Map<string, SpliceRoutingLane>;
  priorRoutes?: Map<string, GridRoute>;
};

/**
 * Grid-native lane assignment: snap center lanes to grid lines and reserve
 * occupied segments as each connection is routed (SDC-GRID-001).
 */
export function assignGridLanes(
  entries: SpliceHandleEntry[],
  grid: GridMap,
  diagramCenterX: number,
  overrides?: Pick<LayoutOverrides, "gridLocks">,
  baselineLanes?: Map<string, SpliceRoutingLane>,
  options?: AssignGridLanesOptions,
): AssignGridLanesResult {
  applyLocksToGrid(grid, overrides);

  const baseline = baselineLanes ?? routeCenterSplices(entries, diagramCenterX);
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const lanes = new Map<string, SpliceRoutingLane>();
  const routes = new Map<string, GridRoute>();
  const rerouteOnly = options?.rerouteConnectionIds;
  const verticalOccupied: Array<{ x: number; y0: number; y1: number }> = [];
  const horizOccupied: Array<{ kind: "h"; y: number; x0: number; x1: number }> =
    [];
  let diagramCenterY = 0;
  if (entries.length > 0) {
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const entry of entries) {
      minY = Math.min(minY, entry.sourceY, entry.targetY);
      maxY = Math.max(maxY, entry.sourceY, entry.targetY);
    }
    diagramCenterY = (minY + maxY) / 2;
  }

  for (const id of sortedEntryIds(entries)) {
    const entry = entryById.get(id);
    const baseLane = baseline.get(id);
    if (!entry || !baseLane) continue;

    const connectionId = connectionIdFromEdgeId(id);
    const shouldReroute = !rerouteOnly || rerouteOnly.has(connectionId);

    if (shouldReroute) {
      const prior = options?.priorRoutes?.get(connectionId);
      if (prior) releaseRouteOccupancy(grid, prior);
    }

    if (!shouldReroute && options?.cachedLanesByEdgeId?.has(id)) {
      const cached = options.cachedLanesByEdgeId.get(id)!;
      const spliceY = (entry.sourceY + entry.targetY) / 2;
      const srcHY = cached.sourceHorizY ?? entry.sourceY;
      const tgtHY = cached.targetHorizY ?? entry.targetY;
      verticalOccupied.push({
        x: cached.midX,
        y0: Math.min(srcHY, spliceY, tgtHY),
        y1: Math.max(srcHY, spliceY, tgtHY),
      });
      horizOccupied.push(...horizSegmentsForEntry(entry, cached));
      lanes.set(id, cached);
      const pathResult = splicePathFromGridRoute(entry, cached, diagramCenterX);
      const route = buildGridRoute(grid, connectionId, pathResult.gridPoints);
      tryReserveRoute(grid, route);
      routes.set(connectionId, route);
      continue;
    }

    const snappedBase = snapLaneToGrid(baseLane, grid);
    const midX = snapLaneMidXAvoidOverlap(
      snappedBase,
      entry,
      grid,
      diagramCenterX,
      verticalOccupied,
    );
    const lane = assignHorizYAvoidOverlap(
      entry,
      { ...snappedBase, midX },
      diagramCenterY,
      diagramCenterX,
      horizOccupied,
    );

    const pathResult = splicePathFromGridRoute(entry, lane, diagramCenterX);
    const route = buildGridRoute(grid, connectionId, pathResult.gridPoints);

    tryReserveRoute(grid, route);
    lanes.set(id, lane);
    routes.set(connectionId, route);
  }

  const sideSpans =
    entries.find((entry) => entry.sideCircuitSpan)?.sideCircuitSpan ??
    defaultSideCircuitLabelSpan();
  const candidates = handleEntriesToCandidates(entries);

  for (const [id, lane] of lanes) {
    lanes.set(id, snapLaneToGrid(lane, grid));
  }

  reconcileGapHorizontalLanesAfterRouting(
    candidates,
    lanes,
    sideSpans,
    diagramCenterX,
  );

  for (const route of routes.values()) {
    releaseRouteOccupancy(grid, route);
  }
  routes.clear();

  for (const id of sortedEntryIds(entries)) {
    const entry = entryById.get(id);
    const lane = lanes.get(id);
    if (!entry || !lane) continue;

    const connectionId = connectionIdFromEdgeId(id);
    const pathResult = splicePathFromGridRoute(entry, lane, diagramCenterX);
    const route = buildGridRoute(grid, connectionId, pathResult.gridPoints);
    tryReserveRoute(grid, route);
    routes.set(connectionId, route);
  }

  return { lanes, routes };
}

/** Refresh route metadata from final SVG paths (post attachPrecomputedPaths). */
export function gridRouteFromPaths(
  map: GridMap,
  connectionId: string,
  leftPath: string,
  rightPath: string,
  spliceX: number,
  spliceY: number,
): GridRoute {
  return gridRouteFromSplicePath(
    connectionId,
    leftPath,
    rightPath,
    spliceX,
    spliceY,
    map,
  );
}
