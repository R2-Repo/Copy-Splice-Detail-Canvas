import type { CablePlacement } from "@/features/diagram/canvasPlacement";
import { computeCanvasPlacement } from "@/features/diagram/canvasPlacement";
import { applyCableSideOverrides } from "@/features/diagram/cableDisplaySide";
import { connectionRowIndexMap } from "@/features/diagram/connectionRowOrder";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import {
  buildLayoutRuleContextFromRendered,
  type LayoutRuleContext,
} from "@/features/diagram/layoutRules";
import { importLayoutWidthForGraph } from "@/features/diagram/layoutSpliceDiagram";
import { routeAllOnGrid } from "@/features/grid/gridRouter";
import type { SpliceRoutingLane } from "@/features/diagram/centerRouter";
import { candidateToPlacementMap } from "@/features/layoutSearch/layoutCandidate";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

import type { SdcRuleContext } from "./types";

function lanesByConnectionId(
  lanes: Map<string, SpliceRoutingLane>,
): Map<string, SpliceRoutingLane> {
  const byConn = new Map<string, SpliceRoutingLane>();
  for (const [edgeId, lane] of lanes) {
    const connId = edgeId
      .replace(/^splice-left-/, "")
      .replace(/^splice-right-/, "")
      .replace(/^splice-/, "")
      .replace(/^butt-/, "");
    byConn.set(connId, lane);
  }
  return byConn;
}

export type BuildSdcRuleContextOptions = {
  layoutWidth?: number;
  overrides?: LayoutOverrides;
  skipReactFlow?: boolean;
  routingEngine?: "composite" | "grid" | "nodes" | "legacy";
  /** Attach grid map + routes for SDC-GRID/ROUTE validators. Default true when React Flow is built. */
  withGrid?: boolean;
};

function resolveRenderedPlacement(ctx: SdcRuleContext): Map<string, CablePlacement> {
  if (ctx.placement) return ctx.placement;

  const visualCables = ctx.visualCables ?? [];
  const candidate = ctx.overrides?.optimizedLayoutCandidate;
  if (candidate && visualCables.length > 0) {
    return candidateToPlacementMap(candidate, visualCables);
  }

  const rowIndex = connectionRowIndexMap(ctx.graph, visualCables);
  const placement = computeCanvasPlacement(ctx.graph, visualCables, rowIndex);
  applyCableSideOverrides(placement, visualCables, ctx.overrides?.cableSides);
  return placement;
}

/** Build grid routing input from a connection graph (cable-level edges, pre-split). */
export function buildGridRoutingInput(
  graph: ConnectionGraph,
  overrides?: LayoutOverrides,
  layoutWidth?: number,
) {
  const legacyOverrides: LayoutOverrides = {
    reportKey: overrides?.reportKey ?? "grid-routing",
    positions: overrides?.positions ?? {},
    ...overrides,
    routingEngine: "composite",
  };
  const graphResult = buildReactFlowGraph(
    graph,
    legacyOverrides,
    layoutWidth,
  );
  const { visualCables } = buildVisualCablesForLayout(graph);
  const width = layoutWidth ?? 1920;
  return {
    nodes: graphResult.nodes,
    edges: graphResult.edges,
    visualCables,
    diagramCenterX: width / 2,
    layoutWidth: width,
  };
}

/** Run grid router and attach grid + routes to an existing SDC context. */
export function enrichSdcContextWithGrid(
  ctx: SdcRuleContext,
  layoutWidth?: number,
): SdcRuleContext {
  if (!ctx.graph || !ctx.visualCables?.length) return ctx;

  const width = layoutWidth ?? ctx.layoutWidth ?? 1920;
  const routingInput = buildGridRoutingInput(ctx.graph, ctx.overrides, width);

  const gridResult = routeAllOnGrid({
    ...routingInput,
    layoutMode: ctx.overrides?.layoutMode,
    lockedSegmentIds: ctx.overrides?.gridLocks?.segments,
    overrides: ctx.overrides,
  });

  const gridLanes = lanesByConnectionId(gridResult.lanes);

  return {
    ...ctx,
    grid: gridResult.grid,
    gridRoutes: gridResult.routes,
    gridLanes,
    gridPackedLanes: gridResult.packedLanes,
    layoutWidth: width,
  };
}

/** Build a full SDC rule context from a connection graph. */
export function buildSdcRuleContext(
  graph: ConnectionGraph,
  options?: BuildSdcRuleContextOptions,
): SdcRuleContext {
  const { visualCables } = buildVisualCablesForLayout(graph);
  const mergedOverrides: LayoutOverrides = {
    reportKey: options?.overrides?.reportKey ?? "sdc-context",
    positions: options?.overrides?.positions ?? {},
    ...options?.overrides,
    routingEngine:
      options?.routingEngine ??
      options?.overrides?.routingEngine ??
      "grid",
  };
  const ctx: SdcRuleContext = {
    report: graph.report,
    graph,
    visualCables,
    overrides: mergedOverrides,
    locks: mergedOverrides.locks,
    layoutWidth: options?.layoutWidth,
  };

  if (!options?.skipReactFlow) {
    const graphResult = buildReactFlowGraph(
      graph,
      mergedOverrides,
      options?.layoutWidth,
    );
    ctx.reactFlow = { nodes: graphResult.nodes, edges: graphResult.edges };
    if (graphResult.placement) {
      ctx.placement = graphResult.placement;
    }

    if (options?.withGrid !== false) {
      return enrichSdcContextWithGrid(ctx, options?.layoutWidth);
    }
  }

  return ctx;
}

/** Bridge SDC context to layout rule checks using the painted graph geometry. */
export function buildSdcContextFromLayout(
  ctx: SdcRuleContext,
): LayoutRuleContext | undefined {
  if (!ctx.reactFlow || !ctx.visualCables?.length) return undefined;
  try {
    const layoutWidth =
      ctx.layoutWidth ?? importLayoutWidthForGraph(ctx.graph);
    return buildLayoutRuleContextFromRendered({
      graph: ctx.graph,
      visualCables: ctx.visualCables,
      reactFlow: ctx.reactFlow,
      layoutWidth,
      placement: resolveRenderedPlacement(ctx),
      layoutExpansion: ctx.overrides?.layoutExpansion,
      reportKey: ctx.overrides?.reportKey,
    });
  } catch {
    return undefined;
  }
}
