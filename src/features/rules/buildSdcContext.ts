import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import {
  buildLayoutRuleContext,
  placementFromReactFlowNodes,
  type LayoutRuleContext,
} from "@/features/diagram/layoutRules";
import { routeAllOnGrid } from "@/features/grid/gridRouter";
import type { SpliceRoutingLane } from "@/features/diagram/centerRouter";

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
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

import { DEFAULT_LAYOUT_EXPANSION } from "@/features/diagram/layoutExpansion";
import { computeAlignedLayout } from "@/features/diagram/spliceRowLayout";

import type { SdcRuleContext } from "./types";

export type BuildSdcRuleContextOptions = {
  layoutWidth?: number;
  overrides?: LayoutOverrides;
  skipReactFlow?: boolean;
  routingEngine?: "composite" | "grid" | "nodes" | "legacy";
  /** Attach grid map + routes for SDC-GRID/ROUTE validators. Default true when React Flow is built. */
  withGrid?: boolean;
};

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
  const { nodes, edges } = buildReactFlowGraph(
    graph,
    legacyOverrides,
    layoutWidth,
  );
  const { visualCables } = buildVisualCablesForLayout(graph);
  const width = layoutWidth ?? 1920;
  return {
    nodes,
    edges,
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
    const { nodes, edges } = buildReactFlowGraph(
      graph,
      mergedOverrides,
      options?.layoutWidth,
    );
    ctx.reactFlow = { nodes, edges };

    if (options?.withGrid !== false) {
      return enrichSdcContextWithGrid(ctx, options?.layoutWidth);
    }
  }

  return ctx;
}

/** Build layout rule context from an already-rendered search/import graph. */
function buildLayoutRuleContextFromRender(
  ctx: SdcRuleContext,
): LayoutRuleContext {
  const visualCables =
    ctx.visualCables ??
    buildVisualCablesForLayout(ctx.graph).visualCables;
  const layoutWidth = ctx.layoutWidth ?? 1920;
  const placement = placementFromReactFlowNodes(ctx.reactFlow!.nodes);
  return {
    graph: ctx.graph,
    visualCables,
    placement,
    layout: computeAlignedLayout(
      ctx.graph,
      visualCables,
      placement,
      layoutWidth,
    ),
    reactFlow: ctx.reactFlow!,
    layoutWidth,
    layoutExpansion:
      ctx.overrides?.layoutExpansion ?? DEFAULT_LAYOUT_EXPANSION,
  };
}

/** Bridge SDC context to layoutRules when React Flow data exists. */
export function buildSdcContextFromLayout(
  ctx: SdcRuleContext,
): LayoutRuleContext | undefined {
  if (!ctx.reactFlow) return undefined;
  try {
    if (
      ctx.overrides?.optimizedLayoutCandidate ||
      ctx.overrides?.layoutMode === "quad"
    ) {
      return buildLayoutRuleContextFromRender(ctx);
    }

    const layoutCtx = buildLayoutRuleContext(
      ctx.graph,
      ctx.layoutWidth,
      ctx.overrides,
      { skipFeasibility: true },
    );
    return {
      ...layoutCtx,
      reactFlow: ctx.reactFlow,
    };
  } catch {
    return undefined;
  }
}
