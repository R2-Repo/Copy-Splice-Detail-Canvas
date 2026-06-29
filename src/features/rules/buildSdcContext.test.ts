import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { evaluateSdcLayoutSpacingRules } from "@/features/diagram/layoutRules";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import {
  candidateToCableSidesRecord,
  candidateToPlacementMap,
  heuristicBaselineCandidate,
} from "@/features/layoutSearch/layoutCandidate";
import { evaluateLayoutCandidate } from "@/features/layoutSearch/evaluateCandidate";
import { buildSdcContextFromLayout } from "@/features/rules/buildSdcContext";
import { sdcLayout001 } from "@/features/rules/layout001";

const examples = join(process.cwd(), "docs/reference/examples");

describe("buildSdcContextFromLayout", () => {
  it("validates search candidate placement against rendered cable nodes", () => {
    const csv = readFileSync(join(examples, "Left-SP-3254.5.csv"), "utf8");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const candidate = heuristicBaselineCandidate(graph);
    const evalResult = evaluateLayoutCandidate(graph, candidate);
    expect(evalResult.feasible).toBe(true);

    const { visualCables } = buildVisualCablesForLayout(graph);
    const overrides = {
      reportKey: "layout-test",
      positions: {},
      cableSides: candidateToCableSidesRecord(candidate, visualCables),
      optimizedLayoutCandidate: candidate,
      layoutWidth: candidate.layoutWidth,
      layoutExpansion: candidate.layoutExpansion,
    };
    const graphResult = buildReactFlowGraph(
      graph,
      overrides,
      candidate.layoutWidth,
      {
        fixedPlacement: candidateToPlacementMap(candidate, visualCables),
        skipFeasibility: true,
      },
    );

    const sdcCtx = {
      report: graph.report,
      graph,
      visualCables: graphResult.visualCables ?? visualCables,
      overrides,
      reactFlow: { nodes: graphResult.nodes, edges: graphResult.edges },
      placement: graphResult.placement,
      layoutWidth: candidate.layoutWidth,
    };

    const layoutCtx = buildSdcContextFromLayout(sdcCtx);
    expect(layoutCtx).toBeDefined();

    const spacing = evaluateSdcLayoutSpacingRules(layoutCtx!);
    expect(spacing.every((r) => r.ok)).toBe(true);

    const ruleResults = sdcLayout001.check(sdcCtx);
    expect(ruleResults.some((r) => r.id === "SDC-LAYOUT-001" && r.ok)).toBe(
      true,
    );
  });
});
