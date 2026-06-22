import type { Edge } from "@xyflow/react";

import { gridRouteFromPaths } from "@/features/grid/gridLaneAssign";
import { buildGridMap } from "@/features/grid/gridMap";
import {
  gridAnchorPointsFromPathData,
  splicePathDataFromEdges,
} from "@/features/grid/splicePathFromEdges";

/** Map committed leg SVG paths to internal grid segment ids for SDC-UX-001 locks. */
export function gridSegmentIdsFromLegPaths(
  _nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: unknown;
  }>,
  edges: Edge[],
  connectionIds: string[],
  layoutWidth: number,
): string[] {
  if (!connectionIds.length) return [];

  const pathData = splicePathDataFromEdges(edges).filter((p) =>
    connectionIds.includes(p.connectionId),
  );
  if (!pathData.length) return [];

  const points = gridAnchorPointsFromPathData(pathData);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  const grid = buildGridMap({
    anchors: [
      { x: Math.min(...xs), y: Math.min(...ys), side: "left" },
      { x: Math.max(...xs), y: Math.max(...ys), side: "right" },
    ],
    bounds: {
      width: layoutWidth,
      height: Math.max(800, Math.max(...ys) - Math.min(...ys) + 160),
    },
    extraVerticalXs: xs,
    extraHorizontalYs: ys,
  });

  const segmentIds = new Set<string>();
  for (const paths of pathData) {
    const route = gridRouteFromPaths(
      grid,
      paths.connectionId,
      paths.leftPath,
      paths.rightPath,
      paths.spliceX,
      paths.spliceY,
    );
    for (const segId of route.segmentIds) segmentIds.add(segId);
  }

  return [...segmentIds];
}
