import type { Edge } from "@xyflow/react";

import { buildSpliceHandleEntries } from "@/features/canvas/edges/spliceHandleEntries";
import { routeCenterSplices } from "@/features/diagram/centerRouter";
import { attachPrecomputedPaths } from "@/features/diagram/computeSpliceLayout";
import type { VisualCable } from "@/features/diagram/visualCables";
import type { LayoutMode } from "@/types/splice";

import { buildGridMap } from "./gridMap";
import { attachGridRouteMetadata } from "./gridPathAdapter";
import { reserveRouteSegments } from "./reservation";
import type { GridAnchorRef, GridMap, GridRoute } from "./gridTypes";

export type GridRouterInput = {
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: unknown;
  }>;
  edges: Edge[];
  visualCables: VisualCable[];
  diagramCenterX: number;
  layoutWidth: number;
  layoutHeight?: number;
  layoutMode?: LayoutMode;
  lockedSegmentIds?: string[];
};

export type GridRouterResult = {
  edges: Edge[];
  grid: GridMap;
  routes: Map<string, GridRoute>;
};

function anchorsFromEntries(
  entries: ReturnType<typeof buildSpliceHandleEntries>,
): GridAnchorRef[] {
  const anchors: GridAnchorRef[] = [];
  for (const e of entries) {
    anchors.push({ x: e.sourceX, y: e.sourceY, side: e.sourceX < e.targetX ? "left" : "right" });
    anchors.push({ x: e.targetX, y: e.targetY, side: e.targetX > e.sourceX ? "right" : "left" });
  }
  return anchors;
}

function connectionIdFromEdge(edge: Edge): string | undefined {
  if (edge.id.startsWith("splice-")) {
    return edge.id.replace(/^splice-(?:left-|right-)?/, "");
  }
  return undefined;
}

/** Route all splices via grid-backed lane reservation (delegates lane math to center router for parity). */
export function routeAllOnGrid(input: GridRouterInput): GridRouterResult {
  const layoutMode = input.layoutMode === "quad" ? "quad" : "horizontal";
  const handleEntries = buildSpliceHandleEntries(
    input.nodes,
    input.edges,
    input.visualCables,
  );

  const anchors = anchorsFromEntries(handleEntries);
  const grid = buildGridMap({
    anchors,
    bounds: {
      width: input.layoutWidth,
      height: input.layoutHeight ?? 800,
    },
    layoutMode,
    lockedSegmentIds: input.lockedSegmentIds,
  });

  const lanes = routeCenterSplices(handleEntries, input.diagramCenterX);
  const routedEdges = attachPrecomputedPaths(
    input.edges,
    handleEntries,
    lanes,
    input.diagramCenterX,
  );

  const routes = new Map<string, GridRoute>();

  for (const edge of routedEdges) {
    if (edge.type !== "splice") continue;
    const connId = connectionIdFromEdge(edge);
    if (!connId) continue;
    const data = edge.data as Record<string, unknown> | undefined;
    const leftPath = data?.leftPath as string | undefined;
    const rightPath = data?.rightPath as string | undefined;
    const spliceX = data?.spliceX as number | undefined;
    const spliceY = data?.spliceY as number | undefined;
    if (!leftPath || !rightPath || spliceX == null || spliceY == null) continue;

    const route = attachGridRouteMetadata(
      grid,
      connId,
      leftPath,
      rightPath,
      spliceX,
      spliceY,
    );
    reserveRouteSegments(grid, route);
    routes.set(connId, route);
  }

  return { edges: routedEdges, grid, routes };
}

/** Re-route only affected connections after a drag (incremental). */
export function rerouteLocalOnGrid(
  input: GridRouterInput,
  connectionIds: string[],
): GridRouterResult {
  const full = routeAllOnGrid(input);
  if (!connectionIds.length) return full;

  const subset = new Map<string, GridRoute>();
  for (const id of connectionIds) {
    const route = full.routes.get(id);
    if (route) subset.set(id, route);
  }
  return { ...full, routes: subset.size ? subset : full.routes };
}
