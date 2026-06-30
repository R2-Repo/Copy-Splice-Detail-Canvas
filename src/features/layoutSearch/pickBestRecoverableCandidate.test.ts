import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import type { RuleResult } from "@/features/rules/types";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

import { evaluateLayoutCandidate } from "./evaluateCandidate";
import type { LayoutEvaluationResult } from "./evaluateCandidate";
import { heuristicBaselineCandidate } from "./layoutCandidate";
import {
  breakdownRecoverableFailures,
  compareRecoverableCandidates,
  pickBestRecoverableCandidate,
  toRecoverableCandidate,
} from "./pickBestRecoverableCandidate";

function failRule(id: RuleResult["id"]): RuleResult {
  return { id, severity: "fail", ok: false, detail: id };
}

function mockEval(violations: RuleResult[]): LayoutEvaluationResult {
  const hasFail = violations.some((r) => !r.ok && r.severity === "fail");
  return {
    feasible: !hasFail,
    score: hasFail ? Number.MAX_SAFE_INTEGER : 1000,
    violations,
    softScore: {
      crossings: 0,
      bendsOverBudget: 0,
      sameSideLoopbacks: 0,
      sidesUsed: 2,
      centerWidth: 0,
      heightImbalance: 0,
      pathLength: 0,
      nearStraightBends: 0,
      handleMisalignment: 0,
      total: 5000,
    },
    tieBreak: { sidesUsed: 2, candidateId: "mock" },
  };
}

describe("pickBestRecoverableCandidate", () => {
  it("prefers fully passing candidate over failed finalists", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #2.csv")),
    );
    const passing = heuristicBaselineCandidate(graph);
    const passingEval = evaluateLayoutCandidate(graph, passing);

    const failed = {
      ...passing,
      stackOrder: {
        ...passing.stackOrder,
        top: ["forced-top"],
      },
    };
    const failedEval = {
      ...evaluateLayoutCandidate(graph, failed),
      feasible: false,
      violations: [failRule("SDC-ROUTE-001"), failRule("SDC-LAYOUT-002")],
    };

    const result = pickBestRecoverableCandidate([
      toRecoverableCandidate(failed, failedEval, "optimizer-finalist"),
      toRecoverableCandidate(passing, passingEval, "heuristic"),
    ]);

    expect(result?.selectionKind).toBe("fully-passing");
    expect(result?.picked.source).toBe("heuristic");
  });

  it("ranks failed finalist with fewer hard failures above heuristic", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #2.csv")),
    );
    const candidate = heuristicBaselineCandidate(graph);

    const fewFails = toRecoverableCandidate(
      candidate,
      mockEval([
        failRule("SDC-LAYOUT-002"),
        failRule("SDC-ROUTE-002"),
        failRule("SDC-ROUTE-003"),
      ]),
      "optimizer-finalist",
    );
    const manyFails = toRecoverableCandidate(
      candidate,
      mockEval([
        failRule("SDC-LAYOUT-002"),
        failRule("SDC-ROUTE-001"),
        failRule("SDC-ROUTE-002"),
        failRule("SDC-ROUTE-003"),
      ]),
      "heuristic",
    );

    const result = pickBestRecoverableCandidate([manyFails, fewFails]);
    expect(result?.picked.source).toBe("optimizer-finalist");
    expect(result?.selectionKind).toBe("best-recoverable");
    expect(result?.comparisonVsHeuristic?.heuristicWon).toBe(false);
    expect(result?.rejected.some((r) => r.isHeuristic)).toBe(true);
  });

  it("uses weighted penalty when hard failure counts tie", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #2.csv")),
    );
    const candidate = heuristicBaselineCandidate(graph);

    const lowPenalty = toRecoverableCandidate(
      candidate,
      mockEval([failRule("SDC-ROUTE-003")]),
      "optimizer-finalist",
    );
    const highPenalty = toRecoverableCandidate(
      candidate,
      mockEval([failRule("SDC-LAYOUT-002"), failRule("SDC-ROUTE-001")]),
      "heuristic",
    );

    expect(compareRecoverableCandidates(lowPenalty, highPenalty)).toBeLessThan(0);
    const breakdown = breakdownRecoverableFailures(highPenalty.violations);
    expect(breakdown.weightedPenalty).toBeGreaterThan(
      breakdownRecoverableFailures(lowPenalty.violations).weightedPenalty,
    );
  });

  it("prefers default canvas width when soft scores differ only by center-width noise", () => {
    const stackOrder = { left: [], right: [], top: [], bottom: [] };
    const expansion = { left: 0, right: 0, top: 0, bottom: 0 };
    const heuristic = {
      cableSides: {},
      stackOrder,
      layoutWidth: 1400,
      layoutExpansion: expansion,
    };
    const narrow = { ...heuristic, layoutWidth: 1133 };

    const narrowEval = mockEval([]);
    narrowEval.softScore!.total = 6380.8;
    const wideEval = mockEval([]);
    wideEval.softScore!.total = 6647.8;

    const result = pickBestRecoverableCandidate([
      toRecoverableCandidate(narrow, narrowEval, "search-best"),
      toRecoverableCandidate(heuristic, wideEval, "heuristic"),
    ]);

    expect(result?.picked.candidate.layoutWidth).toBe(1400);
    expect(result?.picked.source).toBe("heuristic");
  });
});
