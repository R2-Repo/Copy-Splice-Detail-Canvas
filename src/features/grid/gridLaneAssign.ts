import type { SpliceHandleEntry } from "@/features/canvas/edges/spliceHandleEntries";
import {
  inwardSignForColumn,
  SPLICE_PATH_EPS,
} from "@/features/canvas/edges/splicePathGeometry";
import {
  routeCenterSplices,
  type SpliceRoutingLane,
} from "@/features/diagram/centerRouter";
import { SPLICE_LANE_SEP } from "@/features/diagram/cableLayoutMetrics";
import { debugSessionLog } from "@/features/diagram/debugSessionLog";
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

  for (const id of sortedEntryIds(entries)) {
    const entry = entryById.get(id);
    const baseLane = baseline.get(id);
    if (!entry || !baseLane) continue;

    const connectionId = connectionIdFromEdgeId(id);
    const shouldReroute = !rerouteOnly || rerouteOnly.has(connectionId);

    if (
      connectionId.includes("|BL|GR|") ||
      connectionId.includes("|BL|BR|") ||
      connectionId.includes("|BL|OR|")
    ) {
      debugSessionLog(
        "gridLaneAssign.ts:assignGridLanes",
        "grid lane assign",
        {
          connectionId: connectionId.slice(-60),
          shouldReroute,
          rerouteOnlySize: rerouteOnly?.size ?? 0,
          usedCache:
            !shouldReroute && (options?.cachedLanesByEdgeId?.has(id) ?? false),
          midX: baseLane.midX,
        },
        shouldReroute ? "H1" : "H1",
      );
    }

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
    const lane = { ...snappedBase, midX };

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
