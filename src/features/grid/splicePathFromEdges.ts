import type { Edge } from "@xyflow/react";

import { gridRouteFromPaths } from "@/features/grid/gridLaneAssign";
import { buildGridMap } from "@/features/grid/gridMap";
import type { GridPoint, GridRoute } from "@/features/grid/gridTypes";

export type SplicePathData = {
  connectionId: string;
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
};

function pathToPoints(path: string): GridPoint[] {
  const points: GridPoint[] = [];
  const re = /[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    points.push({ x: Number(m[1]), y: Number(m[2]) });
  }
  return points;
}

export function splicePathDataFromEdges(edges: Edge[]): SplicePathData[] {
  const seen = new Set<string>();
  const out: SplicePathData[] = [];

  for (const edge of edges) {
    if (edge.type !== "splice") continue;
    if (edge.id.startsWith("splice-right-") || edge.id.startsWith("butt-")) {
      continue;
    }
    const connectionId = edge.id
      .replace(/^splice-left-/, "")
      .replace(/^splice-/, "");
    if (seen.has(connectionId)) continue;
    seen.add(connectionId);

    const data = edge.data as Record<string, unknown> | undefined;
    const leftPath = data?.leftPath as string | undefined;
    const rightPath = data?.rightPath as string | undefined;
    const spliceX = data?.spliceX as number | undefined;
    const spliceY = data?.spliceY as number | undefined;
    if (!leftPath || !rightPath || spliceX == null || spliceY == null) continue;

    out.push({ connectionId, leftPath, rightPath, spliceX, spliceY });
  }

  return out;
}

/** All grid anchor points from committed leg SVG paths (for lock segment lookup). */
export function gridAnchorPointsFromPathData(paths: SplicePathData[]): GridPoint[] {
  return allPathPoints(paths);
}

function allPathPoints(paths: SplicePathData[]): GridPoint[] {
  const out: GridPoint[] = [];
  for (const p of paths) {
    out.push(...pathToPoints(p.leftPath));
    out.push({ x: p.spliceX, y: p.spliceY });
    out.push(...pathToPoints(p.rightPath).slice(1));
  }
  return out;
}

/** Build grid routes from live precomputed splice edge paths (drag cache). */
export function gridRoutesFromEdges(
  edges: Edge[],
  layoutWidth: number,
): Map<string, GridRoute> {
  const pathData = splicePathDataFromEdges(edges);
  const routes = new Map<string, GridRoute>();
  if (!pathData.length) return routes;

  const points = allPathPoints(pathData);
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

  for (const paths of pathData) {
    routes.set(
      paths.connectionId,
      gridRouteFromPaths(
        grid,
        paths.connectionId,
        paths.leftPath,
        paths.rightPath,
        paths.spliceX,
        paths.spliceY,
      ),
    );
  }

  return routes;
}
