import type { Node } from "@xyflow/react";

import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { type LayoutRuleContext } from "@/features/diagram/layoutRules";
import type { CablePlacement } from "@/features/diagram/canvasPlacement";
import {
  edgePlacementFromCandidate,
  type EdgePlacement,
} from "@/features/diagram/edgePlacement";
import type { CableNodeData } from "@/features/canvas/nodes/types";
import type { QuadSide } from "@/types/splice";
import { computeCanvasPlacement } from "@/features/diagram/canvasPlacement";
import { applyCableSideOverrides } from "@/features/diagram/cableDisplaySide";
import { connectionRowIndexMap } from "@/features/diagram/connectionRowOrder";
import { type AlignedDiagramLayout } from "@/features/diagram/spliceRowLayout";
import { DEFAULT_LAYOUT_EXPANSION } from "@/features/diagram/layoutExpansion";
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

/** Derive left/right placement from evaluated cable nodes (not a fresh layout rebuild). */
function placementFromCableNodes(nodes: Node[]): Map<string, CablePlacement> {
  const placement = new Map<string, CablePlacement>();
  const orderBySide: Record<"left" | "right", number> = { left: 0, right: 0 };

  const cableNodes = nodes
    .filter((node) => node.type === "cable")
    .sort((a, b) => a.position.y - b.position.y);

  for (const node of cableNodes) {
    const vcId = node.id.replace(/^cable-/, "");
    const data = node.data as CableNodeData;
    const side = data.quadSide
      ? data.side ?? "left"
      : data.side ?? "left";
    if (side !== "left" && side !== "right") continue;
    const order = orderBySide[side];
    orderBySide[side] = order + 1;
    placement.set(vcId, { side, order });
  }

  return placement;
}

function edgePlacementFromCableNodes(nodes: Node[]): Map<string, EdgePlacement> {
  const placement = new Map<string, EdgePlacement>();
  const orderBySide: Record<QuadSide, number> = {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  };

  for (const node of nodes.filter((n) => n.type === "cable")) {
    const vcId = node.id.replace(/^cable-/, "");
    const data = node.data as CableNodeData;
    const side: QuadSide = data.quadSide ?? data.side ?? "left";
    const order = orderBySide[side];
    orderBySide[side] = order + 1;
    placement.set(vcId, { side, order });
  }

  return placement;
}

function minimalAlignedLayout(
  nodes: Node[],
  layoutWidth: number,
): AlignedDiagramLayout {
  const cablePositions = new Map<
    string,
    { x: number; y: number; height: number }
  >();
  for (const node of nodes) {
    if (node.type !== "cable") continue;
    const vcId = node.id.replace(/^cable-/, "");
    cablePositions.set(vcId, {
      x: node.position.x,
      y: node.position.y,
      height: node.height ?? 0,
    });
  }
  return {
    reportKey: "evaluated-layout",
    rowYs: new Map(),
    cablePositions,
    layoutWidth,
    alignmentLocked: new Set<string>(),
  };
}

/** Prefer painted / candidate placement; fall back to node-derived order. */
function resolveEvaluatedPlacement(ctx: SdcRuleContext): Map<string, CablePlacement> {
  if (ctx.placement) return ctx.placement;

  const visualCables = ctx.visualCables ?? [];
  const candidate = ctx.overrides?.optimizedLayoutCandidate;
  if (candidate && visualCables.length > 0) {
    const fromCandidate = candidateToPlacementMap(candidate, visualCables);
    if (fromCandidate.size > 0) return fromCandidate;
  }

  if (ctx.reactFlow) {
    return placementFromCableNodes(ctx.reactFlow.nodes);
  }

  const rowIndex = connectionRowIndexMap(ctx.graph, visualCables);
  const placement = computeCanvasPlacement(ctx.graph, visualCables, rowIndex);
  applyCableSideOverrides(placement, visualCables, ctx.overrides?.cableSides);
  return placement;
}

function resolveEvaluatedEdgePlacement(
  ctx: SdcRuleContext,
): Map<string, EdgePlacement> | undefined {
  if (ctx.edgePlacement) return ctx.edgePlacement;

  const visualCables = ctx.visualCables ?? [];
  const candidate = ctx.overrides?.optimizedLayoutCandidate;
  if (candidate && visualCables.length > 0) {
    const fromCandidate = edgePlacementFromCandidate(
      candidate.cableSides,
      candidate.stackOrder,
      visualCables,
    );
    if ([...fromCandidate.values()].some((p) => p.side === "top" || p.side === "bottom")) {
      return fromCandidate;
    }
  }

  if (ctx.reactFlow?.nodes.some((n) => (n.data as CableNodeData).quadSide)) {
    return edgePlacementFromCableNodes(ctx.reactFlow.nodes);
  }

  return undefined;
}

/** Build layout-rule context from the evaluated import/search graph — no rebuild. */
function buildLayoutRuleContextFromEvaluated(
  ctx: SdcRuleContext,
): LayoutRuleContext {
  const visualCables =
    ctx.visualCables ?? buildVisualCablesForLayout(ctx.graph).visualCables;
  const layoutWidth = ctx.layoutWidth ?? 1920;
  const placement = resolveEvaluatedPlacement(ctx);

  for (const vc of visualCables) {
    const p = placement.get(vc.id);
    if (p) vc.side = p.side;
  }

  return {
    graph: ctx.graph,
    visualCables,
    placement,
    edgePlacement: resolveEvaluatedEdgePlacement(ctx),
    layout: minimalAlignedLayout(ctx.reactFlow!.nodes, layoutWidth),
    reactFlow: ctx.reactFlow!,
    layoutWidth,
    layoutExpansion: ctx.overrides?.layoutExpansion ?? DEFAULT_LAYOUT_EXPANSION,
  };
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
    if (graphResult.edgePlacement) {
      ctx.edgePlacement = graphResult.edgePlacement;
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
  if (!ctx.reactFlow || !ctx.graph || !ctx.visualCables?.length) return undefined;
  try {
    return buildLayoutRuleContextFromEvaluated(ctx);
  } catch {
    return undefined;
  }
}
