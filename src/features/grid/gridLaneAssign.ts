import type { SpliceHandleEntry } from "@/features/canvas/edges/spliceHandleEntries";
import {
  routeCenterSplices,
  type SpliceRoutingLane,
} from "@/features/diagram/centerRouter";
import { applyLocksToGrid } from "@/features/layoutHybrid/applyLocksToGrid";
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
import { snapX, snapY } from "./snap";
import type { GridMap, GridPoint, GridRoute } from "./gridTypes";

function connectionIdFromEdgeId(edgeId: string): string {
  return edgeId
    .replace(/^splice-left-/, "")
    .replace(/^splice-right-/, "")
    .replace(/^splice-/, "")
    .replace(/^butt-/, "");
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

    const lane =
      !shouldReroute && options?.cachedLanesByEdgeId?.has(id)
        ? options.cachedLanesByEdgeId.get(id)!
        : snapLaneToGrid(baseLane, grid);

    const pathResult = splicePathFromGridRoute(entry, lane, diagramCenterX);
    const route = buildGridRoute(grid, connectionId, pathResult.gridPoints);

    tryReserveRoute(grid, route);
    lanes.set(id, lane);
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
