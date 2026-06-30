import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { runWithLayoutExpansion } from "@/features/diagram/layoutExpansion";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
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

export type BuildCanvasFromCandidateOptions = {
  refreshColumnX?: boolean;
  refreshRowLayout?: boolean;
  skipTubeAutoAlign?: boolean;
  dragSync?: boolean;
  rerouteConnectionIds?: string[];
  dragCacheEdges?: import("@xyflow/react").Edge[];
};

/** Apply candidate side assignment + stack order to React Flow graph (unified L/R + quad). */
export function buildCanvasFromCandidate(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
  overrides: LayoutOverrides,
  buildOptions?: BuildCanvasFromCandidateOptions,
) {
  return runWithLayoutExpansion(candidate.layoutExpansion, () => {
    const appliedGraph = cloneGraphForCandidate(graph, candidate);
    const { visualCables: seedVisualCables } =
      buildVisualCablesForLayout(appliedGraph);
    const width = candidate.layoutWidth;
    const layoutMode = deriveLayoutMode(candidate);
    const useQuad = layoutMode === "quad";

    const mergedOverrides: LayoutOverrides = {
      ...overrides,
      reportKey: overrides.reportKey,
      layoutWidth: width,
      layoutExpansion: candidate.layoutExpansion,
      layoutMode,
      optimizedLayoutCandidate: candidate,
      cableSides: {
        ...candidateToCableSidesRecord(candidate, seedVisualCables),
        ...overrides.cableSides,
      },
      ...(useQuad
        ? {
            quadCableSides: {
              ...candidateToQuadCableSidesRecord(candidate, seedVisualCables),
              ...overrides.quadCableSides,
            },
          }
        : {}),
    };

    return buildReactFlowGraph(
      appliedGraph,
      mergedOverrides,
      width,
      useQuad
        ? {
            skipFeasibility: true,
            fixedQuadStackOrder: candidateQuadStackOrder(candidate),
            refreshColumnX: buildOptions?.refreshColumnX,
            refreshRowLayout: buildOptions?.refreshRowLayout,
            skipTubeAutoAlign: buildOptions?.skipTubeAutoAlign,
            dragSync: buildOptions?.dragSync,
            rerouteConnectionIds: buildOptions?.rerouteConnectionIds,
            dragCacheEdges: buildOptions?.dragCacheEdges,
          }
        : {
            fixedPlacement: candidateToPlacementMap(candidate, seedVisualCables),
            skipFeasibility: true,
            refreshColumnX: buildOptions?.refreshColumnX,
            refreshRowLayout: buildOptions?.refreshRowLayout,
            skipTubeAutoAlign: buildOptions?.skipTubeAutoAlign,
            dragSync: buildOptions?.dragSync,
            rerouteConnectionIds: buildOptions?.rerouteConnectionIds,
            dragCacheEdges: buildOptions?.dragCacheEdges,
          },
    );
  });
}

/** Build overrides patch from candidate (cable side maps + mode + snapshot). */
export function candidateOverridePatch(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
  reportKey: string,
): Partial<LayoutOverrides> {
  const appliedGraph = cloneGraphForCandidate(graph, candidate);
  const { visualCables } = buildVisualCablesForLayout(appliedGraph);
  const layoutMode = deriveLayoutMode(candidate);
  const useQuad = layoutMode === "quad";

  return {
    reportKey,
    layoutWidth: candidate.layoutWidth,
    layoutExpansion: candidate.layoutExpansion,
    layoutMode,
    optimizedLayoutCandidate: candidate,
    cableSides: candidateToCableSidesRecord(candidate, visualCables),
    ...(useQuad
      ? { quadCableSides: candidateToQuadCableSidesRecord(candidate, visualCables) }
      : {}),
  };
}
