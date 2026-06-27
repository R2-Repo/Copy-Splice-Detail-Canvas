import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { runWithLayoutExpansion } from "@/features/diagram/layoutExpansion";
import type { SpliceRoutingLane } from "@/features/diagram/centerRouter";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { routeAllOnGrid } from "@/features/grid/gridRouter";
import type { GridMap, GridRoute } from "@/features/grid/gridTypes";
import { runRules } from "@/features/rules/runRules";
import type { RuleResult, SdcRuleContext } from "@/features/rules/types";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

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
  scoreLayoutEvaluation,
  type LayoutScoreResult,
  type SoftScoreBreakdown,
} from "./layoutScorer";

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

export type LayoutEvaluationResult = LayoutScoreResult & {
  violations: RuleResult[];
  routes?: Map<string, GridRoute>;
  grid?: GridMap;
};

/**
 * Full evaluate loop: apply candidate → React Flow graph → grid route → SDC rules → score.
 * Calls frozen routing APIs only; does not edit spliceEdgeRouting symbols.
 */
export function evaluateLayoutCandidate(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
): LayoutEvaluationResult {
  return runWithLayoutExpansion(candidate.layoutExpansion, () => {
    const appliedGraph = cloneGraphForCandidate(graph, candidate);
    const { visualCables: seedVisualCables } =
      buildVisualCablesForLayout(appliedGraph);
    const width = candidate.layoutWidth;
    const layoutMode = deriveLayoutMode(candidate);
    const useQuad = layoutMode === "quad";

    const overrides: LayoutOverrides = {
      reportKey: candidate.id ?? "layout-search-eval",
      positions: {},
      cableSides: candidateToCableSidesRecord(candidate, seedVisualCables),
      layoutWidth: width,
      layoutExpansion: candidate.layoutExpansion,
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
    const layoutHeight = diagramHeightFromNodes(graphResult.nodes);

    const gridResult = routeAllOnGrid({
      nodes: graphResult.nodes,
      edges: graphResult.edges,
      visualCables,
      diagramCenterX: width / 2,
      layoutWidth: width,
      layoutHeight,
      layoutMode,
      overrides,
    });

    const gridLanes = lanesByConnectionId(gridResult.lanes);

    const ctx: SdcRuleContext = {
      report: appliedGraph.report,
      graph: appliedGraph,
      visualCables,
      overrides,
      reactFlow: { nodes: graphResult.nodes, edges: gridResult.edges },
      grid: gridResult.grid,
      gridRoutes: gridResult.routes,
      gridLanes,
      gridPackedLanes: gridResult.packedLanes,
      layoutWidth: width,
    };

    const violations = runRules(ctx);
    const scored = scoreLayoutEvaluation(
      violations,
      candidate,
      gridResult.routes,
      gridResult.grid,
      visualCables,
      width,
    );

    return {
      ...scored,
      violations,
      routes: gridResult.routes,
      grid: gridResult.grid,
    };
  });
}

export type { SoftScoreBreakdown, LayoutScoreResult };
