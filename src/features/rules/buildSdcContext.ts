import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import {
  buildLayoutRuleContext,
  type LayoutRuleContext,
} from "@/features/diagram/layoutRules";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

import type { SdcRuleContext } from "./types";

export type BuildSdcRuleContextOptions = {
  layoutWidth?: number;
  overrides?: LayoutOverrides;
  skipReactFlow?: boolean;
  routingEngine?: "legacy" | "grid";
};

/** Build a full SDC rule context from a connection graph. */
export function buildSdcRuleContext(
  graph: ConnectionGraph,
  options?: BuildSdcRuleContextOptions,
): SdcRuleContext {
  const { visualCables } = buildVisualCablesForLayout(graph);
  const ctx: SdcRuleContext = {
    report: graph.report,
    graph,
    visualCables,
    overrides: options?.overrides,
    locks: options?.overrides?.locks,
    layoutWidth: options?.layoutWidth,
  };

  if (!options?.skipReactFlow) {
    const { nodes, edges } = buildReactFlowGraph(
      graph,
      options?.overrides,
      options?.layoutWidth,
    );
    ctx.reactFlow = { nodes, edges };
  }

  return ctx;
}

/** Bridge SDC context to legacy layoutRules context when React Flow data exists. */
export function buildSdcContextFromLayout(
  ctx: SdcRuleContext,
): LayoutRuleContext | undefined {
  if (!ctx.reactFlow) return undefined;
  try {
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
