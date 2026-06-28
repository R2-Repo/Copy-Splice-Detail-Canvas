import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { connectionRowIndexMap } from "@/features/diagram/connectionRowOrder";
import { runWithLayoutExpansion } from "@/features/diagram/layoutExpansion";
import type { SpliceRoutingLane } from "@/features/diagram/centerRouter";
import {
  buildVisualCablesForLayout,
  type VisualCable,
} from "@/features/diagram/visualCables";
import { routeAllOnGrid } from "@/features/grid/gridRouter";
import type { GridMap, GridRoute } from "@/features/grid/gridTypes";
import { runRulesForTier } from "@/features/rules/runRules";
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
  scoreCandidateScreen,
  scoreLayoutEvaluation,
  type LayoutScoreResult,
} from "./layoutScorer";
import type { TopologyConstraints } from "./topology/topologyTypes";
import {
  candidateViolatesForbiddenPairs,
  candidateViolatesLocks,
} from "./topology/deriveConstraints";
import {
  getActiveSearchDiagnostics,
  recordEvalSubPhase,
  recordRuleReject,
} from "./importDiagnostics";
import {
  CandidateRuleValidationCache,
  candidateGeometryKey,
} from "./candidateGeometry";
import {
  predictEarlyRejectAtT1,
  recordPrunePredictedRules,
} from "./candidatePruners";

export type EvalTier = "T0" | "T1" | "T2";

export type TieredEvalResult = LayoutScoreResult & {
  tier: EvalTier;
  violations: RuleResult[];
  routes?: Map<string, GridRoute>;
  grid?: GridMap;
  fullResult?: LayoutEvaluationResult;
};

const proxyRouteMemo = new Map<string, TieredEvalResult>();

/** Per-search rule validation cache keyed by candidate geometry (width-invariant tiers). */
let activeRuleValidationCache: CandidateRuleValidationCache | null = null;

export function beginRuleValidationCache(): CandidateRuleValidationCache {
  activeRuleValidationCache = new CandidateRuleValidationCache();
  return activeRuleValidationCache;
}

export function getRuleValidationCache(): CandidateRuleValidationCache | null {
  return activeRuleValidationCache;
}

export function clearRuleValidationCache(): void {
  activeRuleValidationCache = null;
}

function infeasibleT0(candidate: LayoutCandidate): TieredEvalResult {
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

export function proxyRouteKey(
  candidate: LayoutCandidate,
  proxyIds: Set<string>,
): string {
  const proxyList = [...proxyIds].sort().join(",");
  return `${candidate.id ?? "candidate"}|${proxyList}`;
}

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

export function proxyConnectionIds(
  graph: ConnectionGraph,
  constraints: TopologyConstraints,
  candidate?: LayoutCandidate,
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

  if (candidate) {
    for (const conn of graph.connections) {
      if (conn.kind !== "fiber") continue;
      const epA = cableNameKey(conn.pair.endpointA.cable);
      const epB = cableNameKey(conn.pair.endpointB.cable);
      const sideA = candidate.cableSides[epA];
      const sideB = candidate.cableSides[epB];
      if (sideA && sideB && sideA === sideB) {
        ids.add(conn.id);
      }
    }
  }

  if (ids.size === 0) {
    const first = graph.connections.find((c) => c.kind === "fiber");
    if (first) ids.add(first.id);
  }
  return ids;
}

export type ProxyEvalContext = {
  appliedGraph: ConnectionGraph;
  graphResult: ReturnType<typeof buildReactFlowGraph>;
  visualCables: VisualCable[];
  width: number;
  layoutMode: ReturnType<typeof deriveLayoutMode>;
  overrides: LayoutOverrides;
  proxyIds: Set<string>;
};

/** Lightweight T1 context — representative splice edges only. */
export function buildProxyEvalContext(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
  constraints: TopologyConstraints,
): ProxyEvalContext {
  const proxyIds = proxyConnectionIds(graph, constraints, candidate);
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
    proxyIds,
  };
}

/** T0 — four-side candidate screen (no grid). */
export function evaluateT0(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
  constraints: TopologyConstraints,
  visualCables: VisualCable[],
  rowIndex: Map<string, number>,
): TieredEvalResult {
  const t0Start = performance.now();
  const diag = getActiveSearchDiagnostics();

  if (
    candidateViolatesLocks(candidate, constraints) ||
    candidateViolatesForbiddenPairs(candidate, constraints)
  ) {
    const result = infeasibleT0(candidate);
    if (diag) {
      recordEvalSubPhase(diag, "evaluateT0", performance.now() - t0Start);
    }
    return result;
  }

  const geomKey = candidateGeometryKey(candidate);
  const ruleCache = getRuleValidationCache();
  const ruleCacheKey = ruleCache?.cacheKey(geomKey, "T0", "candidate-screen");
  const cachedRules =
    ruleCacheKey !== undefined ? ruleCache?.get(ruleCacheKey) : undefined;

  const screen = scoreCandidateScreen(
    candidate,
    graph,
    visualCables,
    rowIndex,
  );

  const graphCtx: SdcRuleContext = {
    report: graph.report,
    graph,
    visualCables,
  };
  let violations: RuleResult[];
  if (cachedRules) {
    violations = cachedRules.violations;
  } else {
    const ruleStart = performance.now();
    violations = runRulesForTier(graphCtx, "candidate-screen", {
      stopOnFail: true,
    });
    if (diag) {
      recordEvalSubPhase(diag, "runRules", performance.now() - ruleStart);
    }
    const hasFail = violations.some((r) => !r.ok && r.severity === "fail");
    if (ruleCache && ruleCacheKey) {
      ruleCache.set(ruleCacheKey, { feasible: !hasFail, violations });
    }
  }
  const hasFail = violations.some((r) => !r.ok && r.severity === "fail");
  if (hasFail && diag) {
    for (const v of violations) {
      if (!v.ok && v.severity === "fail") recordRuleReject(diag, v.id);
    }
  }

  const result = {
    feasible: !hasFail,
    score: hasFail ? INFEASIBLE_LAYOUT_SCORE : screen.total,
    softScore: screen,
    tieBreak: {
      sidesUsed: screen.sidesUsed,
      candidateId: candidate.id ?? "",
    },
    tier: "T0" as const,
    violations,
  };
  if (diag) {
    recordEvalSubPhase(diag, "evaluateT0", performance.now() - t0Start);
  }
  return result;
}

/** T1 — proxy route one strand per bundle + one per cable-pair edge. */
export function evaluateT1(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
  constraints: TopologyConstraints,
): TieredEvalResult {
  const memoKey = proxyRouteKey(
    candidate,
    proxyConnectionIds(graph, constraints, candidate),
  );
  const cached = proxyRouteMemo.get(memoKey);
  if (cached) return cached;

  const t1Start = performance.now();
  const diag = getActiveSearchDiagnostics();

  const built = buildVisualCablesForLayout(graph);
  const rowIndex = connectionRowIndexMap(graph, built.visualCables, built.dominant);
  const t1Reject = predictEarlyRejectAtT1(
    candidate,
    graph,
    constraints,
    built.visualCables,
    rowIndex,
  );
  if (t1Reject.reject) {
    if (diag) {
      recordPrunePredictedRules(diag.ruleRejectCounts, t1Reject.predictedRules);
      recordEvalSubPhase(diag, "evaluateT1", performance.now() - t1Start);
    }
    return { ...infeasibleT0(candidate), tier: "T1" as const };
  }

  const result = runWithLayoutExpansion(candidate.layoutExpansion, () => {
    const buildStart = performance.now();
    const ctx = buildProxyEvalContext(graph, candidate, constraints);
    if (diag) {
      recordEvalSubPhase(diag, "buildReactFlowGraph", performance.now() - buildStart);
    }
    const layoutHeight = diagramHeightFromNodes(ctx.graphResult.nodes);

    const routeStart = performance.now();
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
    if (diag) {
      recordEvalSubPhase(diag, "routeAllOnGrid", performance.now() - routeStart);
    }

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

    const ruleStart = performance.now();
    const violations = runRulesForTier(ruleCtx, "proxy-route");
    if (diag) {
      recordEvalSubPhase(diag, "runRules", performance.now() - ruleStart);
    }

    const scoreStart = performance.now();
    const scored = scoreLayoutEvaluation(
      violations,
      candidate,
      gridResult.routes,
      gridResult.grid,
      ctx.visualCables,
      ctx.width,
      ctx.appliedGraph,
    );
    if (diag) {
      recordEvalSubPhase(
        diag,
        "scoreLayoutEvaluation",
        performance.now() - scoreStart,
      );
    }

    return {
      ...scored,
      tier: "T1" as const,
      violations,
      routes: gridResult.routes,
      grid: gridResult.grid,
    };
  });

  if (diag) {
    recordEvalSubPhase(diag, "evaluateT1", performance.now() - t1Start);
  }

  proxyRouteMemo.set(memoKey, result);
  return result;
}

/** T2 — full per-strand route + rules (current evaluate path). */
export function evaluateT2(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
): TieredEvalResult {
  const t2Start = performance.now();
  const diag = getActiveSearchDiagnostics();
  const full = evaluateLayoutCandidate(graph, candidate);
  if (diag) {
    recordEvalSubPhase(diag, "evaluateT2", performance.now() - t2Start);
  }
  return { ...full, tier: "T2", fullResult: full };
}

export type TieredEvalOptions = {
  constraints: TopologyConstraints;
  bestScore: number;
  /** When false, always run T2 (baseline comparisons). */
  tieredEvalEnabled?: boolean;
  /** Stop evaluation at this tier (beam pipeline). */
  maxTier?: EvalTier;
  /** Skip tier gating and run full T2. */
  forceT2?: boolean;
};

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
  if (options.tieredEvalEnabled === false || options.forceT2) {
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
  if (!t0.feasible || options.maxTier === "T0") return t0;

  const t0Margin =
    options.bestScore < INFEASIBLE_LAYOUT_SCORE
      ? options.bestScore * 3 + 5000
      : INFEASIBLE_LAYOUT_SCORE;
  if (t0.score > t0Margin) return t0;

  const totalFibers = graph.connections.filter((c) => c.kind === "fiber").length;
  const proxyCount = proxyConnectionIds(graph, options.constraints, candidate).size;
  const useProxyRoute = proxyCount < totalFibers * 0.75;

  const t1 = useProxyRoute
    ? evaluateT1(graph, candidate, options.constraints)
    : { ...t0, tier: "T1" as const };
  if (!t1.feasible || options.maxTier === "T1") return t1;

  if (options.maxTier === "T2") {
    return evaluateT2(graph, candidate);
  }

  return t1;
}

export function clearProxyRouteMemo(): void {
  proxyRouteMemo.clear();
}
