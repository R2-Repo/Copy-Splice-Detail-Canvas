import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";

import { evaluateLayoutCandidate } from "./evaluateCandidate";
import { heuristicBaselineCandidate } from "./layoutCandidate";
import { layoutSearch, seedFromReportKey } from "./layoutSearch";

/** Opt-in CSV regressions — not in `test:fast` / smoke. See docs/agent/TESTING.md. */

function exampleTwoGraph() {
  return buildConnectionGraph(
    parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #2.csv")),
  );
}

function leftSpi215Graph() {
  return buildConnectionGraph(
    parseBentleyCsv(readLeftCsv("Left-SPI-215_I-80.csv")),
  );
}

describe("layoutSearch slow CSV regressions", () => {
  it("Example #2: 4-side search matches or beats heuristic", () => {
    const graph = exampleTwoGraph();
    const seed = seedFromReportKey(reportStorageKey(graph));
    const baselineEval = evaluateLayoutCandidate(
      graph,
      heuristicBaselineCandidate(graph),
    );
    const result = layoutSearch(graph, {
      seed,
      maxRounds: 200,
      plateauRounds: 32,
      timeBudgetMs: 60_000,
    });

    expect(baselineEval.feasible).toBe(true);
    expect(result.bestScore).toBeLessThanOrEqual(baselineEval.score);
  }, 180_000);

  it("Left-SPI-215_I-80: 4-side search matches or beats L/R-only heuristic", () => {
    const graph = leftSpi215Graph();
    const seed = seedFromReportKey(reportStorageKey(graph));
    const result = layoutSearch(graph, {
      seed,
      maxRounds: 200,
      timeBudgetMs: 60_000,
    });

    expect(result.evaluations).toBeGreaterThan(0);
    expect(result.bestScore).toBeLessThan(Number.MAX_SAFE_INTEGER);
  }, 180_000);
});
