import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { stackOrderCrossingCount } from "@/features/diagram/canvasPlacement";
import { connectionRowIndexMap } from "@/features/diagram/connectionRowOrder";
import { runWithLayoutExpansion } from "@/features/diagram/layoutExpansion";
import type { SpliceRoutingLane } from "@/features/diagram/centerRouter";
import {
  buildVisualCablesForLayout,
  type VisualCable,
} from "@/features/diagram/visualCables";
import { routeAllOnGrid } from "@/features/grid/gridRouter";
import type { GridMap, GridRoute } from "@/features/grid/gridTypes";
import { runRules } from "@/features/rules/runRules";
import type { RuleResult, SdcRuleContext } from "@/features/rules/types";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";
import { cableNameKey } from "@/features/import/cableLegIdentity";

import {
  candidateQuadStackOrder,
  candidateToCableSidesRecord,
  candidateToPlacementMap,
  candidateToQuadCableSidesRecord,
  cloneGraphForCandidate,
  deriveLayoutMode,
  type LayoutCandidate,
} from "./layoutCandidate";
import {
  evaluateLayoutCandidate,
  type LayoutEvaluationResult,
} from "./evaluateCandidate";
import { INFEASIBLE_LAYOUT_SCORE } from "./layoutSearch";
import {
  DEFAULT_SOFT_SCORE_WEIGHTS,
  scoreLayoutEvaluation,
  type LayoutScoreResult,
} from "./layoutScorer";
import type { TopologyConstraints } from "./topology/topologyTypes";
import {
  candidateViolatesForbiddenPairs,
  candidateViolatesLocks,
} from "./topology/deriveConstraints";

export type EvalTier = "T0" | "T1" | "T2";

export type TieredEvalResult = LayoutScoreResult & {
  tier: EvalTier;
  violations: RuleResult[];
  routes?: Map<string, GridRoute>;
  grid?: GridMap;
  fullResult?: LayoutEvaluationResult;
};

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

function diagramHeightFromNodes(
  nodes: Array<{ position: { x: number; y: number }; height?: number }>,
  fallback = 800,
): number {
  let maxY = 0;
  for (const node of nodes) {
    maxY = Math.max(maxY, node.position.y + (node.height ?? 0));
  }
  return Math.max(fallback, maxY + 80);
}

function visualCableOrder(
  candidate: LayoutCandidate,
  visualCables: VisualCable[],
  side: "left" | "right",
): VisualCable[] {
  const stack = candidate.stackOrder[side];
  const byCable = new Map<string, VisualCable>();
  for (const vc of visualCables) {
    if (vc.side !== side) continue;
    const key = cableNameKey(vc.cable);
    if (!byCable.has(key)) byCable.set(key, vc);
  }
  const ordered: VisualCable[] = [];
  for (const cable of stack) {
    const vc = byCable.get(cable);
    if (vc) ordered.push(vc);
  }
  for (const vc of visualCables) {
    if (vc.side !== side) continue;
    if (!ordered.some((o) => o.id === vc.id)) ordered.push(vc);
  }
  return ordered;
}

export function proxyConnectionIds(
  graph: ConnectionGraph,
  constraints: TopologyConstraints,
): Set<string> {
  const ids = new Set<string>();
  for (const group of constraints.proxyBundleGroups) {
    ids.add(group.representativeId);
  }

  const seenPairs = new Set<string>();
  for (const conn of graph.connections) {
    if (conn.kind !== "fiber") continue;
    const epA = cableNameKey(conn.pair.endpointA.cable);
    const epB = cableNameKey(conn.pair.endpointB.cable);
    const pairKey = epA < epB ? `${epA}\0${epB}` : `${epB}\0${epA}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    ids.add(conn.id);
  }

  if (ids.size === 0) {
    const first = graph.connections.find((c) => c.kind === "fiber");
    if (first) ids.add(first.id);
  }
  return ids;
}

/** T0 — placement validity + cheap stack-crossing estimate (no grid). */
export function evaluateT0(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
  constraints: TopologyConstraints,
  visualCables: VisualCable[],
  rowIndex: Map<string, number>,
): TieredEvalResult {
  if (
    candidateViolatesLocks(candidate, constraints) ||
    candidateViolatesForbiddenPairs(candidate, constraints)
  ) {
    return {
      feasible: false,
      score: INFEASIBLE_LAYOUT_SCORE,
      softScore: {
        crossings: 0,
        bendsOverBudget: 0,
        sameSideLoopbacks: 0,
        sidesUsed: 0,
        centerWidth: 0,
        heightImbalance: 0,
        pathLength: 0,
        total: INFEASIBLE_LAYOUT_SCORE,
      },
      tieBreak: { sidesUsed: 0, candidateId: candidate.id ?? "" },
      tier: "T0",
      violations: [],
    };
  }

  const leftOrder = visualCableOrder(candidate, visualCables, "left");
  const rightOrder = visualCableOrder(candidate, visualCables, "right");
  const crossings = stackOrderCrossingCount(
    leftOrder,
    rightOrder,
    graph,
    rowIndex,
    visualCables,
  );
  const score =
    crossings * DEFAULT_SOFT_SCORE_WEIGHTS.crossings +
    (candidate.stackOrder.top.length > 0 ||
    candidate.stackOrder.bottom.length > 0
      ? DEFAULT_SOFT_SCORE_WEIGHTS.sidesUsed
      : 0);

  return {
    feasible: true,
    score,
    softScore: {
      crossings,
      bendsOverBudget: 0,
      sameSideLoopbacks: 0,
      sidesUsed: 0,
      centerWidth: 0,
      heightImbalance: 0,
      pathLength: 0,
      total: score,
    },
    tieBreak: { sidesUsed: 0, candidateId: candidate.id ?? "" },
    tier: "T0",
    violations: [],
  };
}

function buildEvalContext(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
  proxyIds: Set<string>,
): {
  appliedGraph: ConnectionGraph;
  graphResult: ReturnType<typeof buildReactFlowGraph>;
  visualCables: VisualCable[];
  width: number;
  layoutMode: ReturnType<typeof deriveLayoutMode>;
  overrides: LayoutOverrides;
} {
  const appliedGraph = cloneGraphForCandidate(graph, candidate);
  const { visualCables: seedVisualCables } =
    buildVisualCablesForLayout(appliedGraph);
  const width = candidate.layoutWidth;
  const layoutMode = deriveLayoutMode(candidate);
  const useQuad = layoutMode === "quad";

  const overrides: LayoutOverrides = {
    reportKey: candidate.id ?? "layout-search-proxy",
    positions: {},
    cableSides: candidateToCableSidesRecord(candidate, seedVisualCables),
    layoutWidth: width,
    layoutExpansion: candidate.layoutExpansion,
    optimizedLayoutCandidate: candidate,
    routingEngine: "legacy",
    layoutMode,
    ...(useQuad
      ? {
          quadCableSides: candidateToQuadCableSidesRecord(
            candidate,
            seedVisualCables,
          ),
        }
      : {}),
  };

  const graphResult = buildReactFlowGraph(
    appliedGraph,
    overrides,
    width,
    useQuad
      ? {
          skipFeasibility: true,
          fixedQuadStackOrder: candidateQuadStackOrder(candidate),
        }
      : {
          fixedPlacement: candidateToPlacementMap(candidate, seedVisualCables),
          skipFeasibility: true,
        },
  );

  const visualCables = graphResult.visualCables ?? seedVisualCables;

  if (proxyIds.size < appliedGraph.connections.length) {
    graphResult.edges = graphResult.edges.filter((edge) => {
      if (edge.type !== "splice") return true;
      const connId = edge.id.replace(/^splice-(?:left-|right-)?/, "");
      return proxyIds.has(connId);
    });
  }

  return {
    appliedGraph,
    graphResult,
    visualCables,
    width,
    layoutMode,
    overrides,
  };
}

/** T1 — proxy route one strand per bundle + one per cable-pair edge. */
export function evaluateT1(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
  constraints: TopologyConstraints,
): TieredEvalResult {
  return runWithLayoutExpansion(candidate.layoutExpansion, () => {
    const proxyIds = proxyConnectionIds(graph, constraints);
    const ctx = buildEvalContext(graph, candidate, proxyIds);
    const layoutHeight = diagramHeightFromNodes(ctx.graphResult.nodes);

    const gridResult = routeAllOnGrid({
      nodes: ctx.graphResult.nodes,
      edges: ctx.graphResult.edges,
      visualCables: ctx.visualCables,
      diagramCenterX: ctx.width / 2,
      layoutWidth: ctx.width,
      layoutHeight,
      layoutMode: ctx.layoutMode,
      overrides: ctx.overrides,
    });

    const gridLanes = lanesByConnectionId(gridResult.lanes);
    const ruleCtx: SdcRuleContext = {
      report: ctx.appliedGraph.report,
      graph: ctx.appliedGraph,
      visualCables: ctx.visualCables,
      overrides: ctx.overrides,
      reactFlow: { nodes: ctx.graphResult.nodes, edges: gridResult.edges },
      grid: gridResult.grid,
      gridRoutes: gridResult.routes,
      gridLanes,
      gridPackedLanes: gridResult.packedLanes,
      layoutWidth: ctx.width,
    };

    const violations = runRules(ruleCtx);
    const scored = scoreLayoutEvaluation(
      violations,
      candidate,
      gridResult.routes,
      gridResult.grid,
      ctx.visualCables,
      ctx.width,
    );

    return {
      ...scored,
      tier: "T1",
      violations,
      routes: gridResult.routes,
      grid: gridResult.grid,
    };
  });
}

/** T2 — full per-strand route + rules (current evaluate path). */
export function evaluateT2(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
): TieredEvalResult {
  const full = evaluateLayoutCandidate(graph, candidate);
  return { ...full, tier: "T2", fullResult: full };
}

export type TieredEvalOptions = {
  constraints: TopologyConstraints;
  bestScore: number;
  /** When false, always run T2 (baseline comparisons). */
  tieredEvalEnabled?: boolean;
  /** Promote to T2 when proxy score within this factor of best. */
  t2PromoteFactor?: number;
};

const DEFAULT_T2_PROMOTE_FACTOR = 1.25;

export function evaluateCandidateTiered(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
  options: TieredEvalOptions,
  cache?: {
    visualCables: VisualCable[];
    rowIndex: Map<string, number>;
    dominant: ReturnType<typeof buildVisualCablesForLayout>["dominant"];
  },
): TieredEvalResult {
  if (options.tieredEvalEnabled === false) {
    return evaluateT2(graph, candidate);
  }

  const built = cache?.visualCables
    ? {
        visualCables: cache.visualCables,
        dominant: cache.dominant,
      }
    : buildVisualCablesForLayout(graph);
  const visualCables = built.visualCables;
  const rowIndex =
    cache?.rowIndex ??
    connectionRowIndexMap(graph, visualCables, built.dominant);

  const t0 = evaluateT0(graph, candidate, options.constraints, visualCables, rowIndex);
  if (!t0.feasible) return t0;

  const t0Margin =
    options.bestScore < INFEASIBLE_LAYOUT_SCORE
      ? options.bestScore * 3 + 5000
      : INFEASIBLE_LAYOUT_SCORE;
  if (t0.score > t0Margin) return t0;

  const totalFibers = graph.connections.filter((c) => c.kind === "fiber").length;
  const proxyCount = proxyConnectionIds(graph, options.constraints).size;
  const useProxyRoute = proxyCount < totalFibers * 0.75;

  const t1 = useProxyRoute
    ? evaluateT1(graph, candidate, options.constraints)
    : { ...t0, tier: "T1" as const };
  if (!t1.feasible) return t1;

  const promoteFactor = options.t2PromoteFactor ?? DEFAULT_T2_PROMOTE_FACTOR;
  const competitive =
    options.bestScore >= INFEASIBLE_LAYOUT_SCORE ||
    t1.score <= options.bestScore * promoteFactor;

  if (!competitive) return t1;

  return evaluateT2(graph, candidate);
}
