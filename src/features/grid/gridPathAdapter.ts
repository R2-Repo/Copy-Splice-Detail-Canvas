import {
  buildSplicePath,
  type SplicePathResult,
} from "@/features/canvas/edges/splicePathGeometry";
import type { SpliceRoutingLane } from "@/features/diagram/centerRouter";
import type { SpliceHandleEntry } from "@/features/canvas/edges/spliceHandleEntries";

import { segmentIdsForRoute } from "./reservation";
import type { GridMap, GridPoint, GridRoute } from "./gridTypes";

function pathToPoints(path: string): GridPoint[] {
  const points: GridPoint[] = [];
  const re = /[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    points.push({ x: Number(m[1]), y: Number(m[2]) });
  }
  return points;
}

export function gridRouteFromSplicePath(
  connectionId: string,
  leftPath: string,
  rightPath: string,
  spliceX: number,
  spliceY: number,
  map: GridMap,
): GridRoute {
  const left = pathToPoints(leftPath);
  const right = pathToPoints(rightPath);
  const points: GridPoint[] = [...left];
  if (
    right.length &&
    (points.length === 0 ||
      points[points.length - 1]!.x !== right[0]!.x ||
      points[points.length - 1]!.y !== right[0]!.y)
  ) {
    points.push({ x: spliceX, y: spliceY });
  }
  for (const p of right) points.push(p);

  const deduped: GridPoint[] = [];
  for (const p of points) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.x !== p.x || prev.y !== p.y) deduped.push(p);
  }

  return {
    connectionId,
    points: deduped,
    segmentIds: segmentIdsForRoute(map, deduped),
  };
}

export function splicePathFromGridRoute(
  entry: SpliceHandleEntry,
  lane: SpliceRoutingLane,
  diagramCenterX: number,
): SplicePathResult & { gridPoints: GridPoint[] } {
  const result = buildSplicePath(
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
    entry.sideCircuitSpan,
    diagramCenterX,
    entry.sourceTagWidth,
    entry.targetTagWidth,
  );

  const gridPoints = [
    ...pathToPoints(result.leftPath),
    { x: result.spliceX, y: result.spliceY },
    ...pathToPoints(result.rightPath).slice(1),
  ];

  return { ...result, gridPoints };
}

export function attachGridRouteMetadata(
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
