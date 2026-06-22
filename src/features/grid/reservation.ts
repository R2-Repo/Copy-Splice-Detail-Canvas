import type { GridMap, GridPoint, GridRoute, GridSegment } from "./gridTypes";

const EPS = 0.5;

function segmentIdForRun(
  axis: "horizontal" | "vertical",
  a: GridPoint,
  b: GridPoint,
): string | undefined {
  if (axis === "horizontal" && Math.abs(a.y - b.y) < EPS) {
    const y = a.y;
    const x1 = Math.min(a.x, b.x);
    const x2 = Math.max(a.x, b.x);
    return `horizontal:${x1},${y}:${x2},${y}`;
  }
  if (axis === "vertical" && Math.abs(a.x - b.x) < EPS) {
    const x = a.x;
    const y1 = Math.min(a.y, b.y);
    const y2 = Math.max(a.y, b.y);
    return `vertical:${x},${y1}:${x},${y2}`;
  }
  return undefined;
}

export function segmentOnGrid(map: GridMap, a: GridPoint, b: GridPoint): boolean {
  const horiz = Math.abs(a.y - b.y) < EPS;
  const vert = Math.abs(a.x - b.x) < EPS;
  if (!horiz && !vert) return false;
  const id = segmentIdForRun(horiz ? "horizontal" : "vertical", a, b);
  if (!id) return false;
  return map.segments.has(id) || horiz || vert;
}

export function reserveSegment(
  map: GridMap,
  segId: string,
  connectionId: string,
): boolean {
  const seg = map.segments.get(segId);
  if (!seg) return false;
  if (seg.status === "blocked" || seg.status === "manual-locked") return false;
  if (seg.status === "occupied" && seg.connectionId !== connectionId) return false;
  seg.status = "reserved";
  seg.connectionId = connectionId;
  return true;
}

export function occupySegment(map: GridMap, segId: string, connectionId: string): boolean {
  const seg = map.segments.get(segId);
  if (!seg) return false;
  if (seg.status === "blocked") return false;
  if (
    (seg.status === "occupied" || seg.status === "manual-locked") &&
    seg.connectionId &&
    seg.connectionId !== connectionId
  ) {
    return false;
  }
  seg.status = "occupied";
  seg.connectionId = connectionId;
  return true;
}

export function releaseReservations(map: GridMap, connectionId: string): void {
  for (const seg of map.segments.values()) {
    if (seg.status === "reserved" && seg.connectionId === connectionId) {
      seg.status = "available";
      seg.connectionId = undefined;
    }
  }
}

export function releaseRouteOccupancy(map: GridMap, route: GridRoute): void {
  for (const segId of route.segmentIds) {
    const seg = map.segments.get(segId);
    if (seg && seg.connectionId === route.connectionId) {
      seg.status = "available";
      seg.connectionId = undefined;
    }
  }
}

export function segmentIdsForRoute(map: GridMap, points: GridPoint[]): string[] {
  const ids: string[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const horiz = Math.abs(a.y - b.y) < EPS;
    const vert = Math.abs(a.x - b.x) < EPS;
    const exact = segmentIdForRun(horiz ? "horizontal" : "vertical", a, b);
    if (exact && map.segments.has(exact)) {
      ids.push(exact);
      continue;
    }
    const containing = containingSegmentForRun(map, a, b, horiz, vert);
    if (containing) ids.push(containing);
  }
  return ids;
}

function containingSegmentForRun(
  map: GridMap,
  a: GridPoint,
  b: GridPoint,
  horiz: boolean,
  vert: boolean,
): string | undefined {
  if (horiz) {
    const y = a.y;
    const x1 = Math.min(a.x, b.x);
    const x2 = Math.max(a.x, b.x);
    for (const seg of map.segments.values()) {
      if (seg.axis !== "horizontal" || Math.abs(seg.y1 - y) >= EPS) continue;
      if (seg.x1 <= x1 + EPS && seg.x2 >= x2 - EPS) return seg.id;
    }
  }
  if (vert) {
    const x = a.x;
    const y1 = Math.min(a.y, b.y);
    const y2 = Math.max(a.y, b.y);
    for (const seg of map.segments.values()) {
      if (seg.axis !== "vertical" || Math.abs(seg.x1 - x) >= EPS) continue;
      if (seg.y1 <= y1 + EPS && seg.y2 >= y2 - EPS) return seg.id;
    }
  }
  return undefined;
}

export function reserveRouteSegments(
  map: GridMap,
  route: GridRoute,
): { ok: boolean; conflicts: string[] } {
  const conflicts: string[] = [];
  for (const segId of route.segmentIds) {
    if (!reserveSegment(map, segId, route.connectionId)) {
      conflicts.push(segId);
    }
  }
  if (conflicts.length) {
    releaseReservations(map, route.connectionId);
    return { ok: false, conflicts };
  }
  for (const segId of route.segmentIds) {
    occupySegment(map, segId, route.connectionId);
  }
  releaseReservations(map, route.connectionId);
  return { ok: true, conflicts: [] };
}

export function validateGridRoutes(
  map: GridMap,
  routes?: Map<string, GridRoute>,
): string[] {
  if (!routes?.size) return [];
  const issues: string[] = [];
  const seen = new Map<string, string>();

  for (const [connId, route] of routes) {
    for (const segId of route.segmentIds) {
      const seg = map.segments.get(segId);
      if (!seg) {
        issues.push(`${connId}: unknown segment ${segId}`);
        continue;
      }
      const prior = seen.get(segId);
      if (prior && prior !== connId) {
        issues.push(`${connId}: segment ${segId} shared with ${prior}`);
      } else {
        seen.set(segId, connId);
      }
    }
  }
  return issues;
}

export function lockSegments(map: GridMap, segmentIds: string[]): void {
  for (const id of segmentIds) {
    const seg = map.segments.get(id);
    if (seg) {
      seg.status = "manual-locked";
    }
  }
}

export function applyGridLocksToMap(
  map: GridMap,
  lockedSegmentIds: string[] = [],
): void {
  lockSegments(map, lockedSegmentIds);
}

export type SegmentOccupancy = Pick<GridSegment, "id" | "status" | "connectionId">;

export function occupancySnapshot(map: GridMap): SegmentOccupancy[] {
  return [...map.segments.values()].map((s) => ({
    id: s.id,
    status: s.status,
    connectionId: s.connectionId,
  }));
}
