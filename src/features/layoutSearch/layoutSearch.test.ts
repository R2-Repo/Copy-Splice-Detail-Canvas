import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";
import type { SplicePair } from "@/types/splice";

import { evaluateLayoutCandidate } from "./evaluateCandidate";
import {
  compareCandidates,
  heuristicBaselineCandidate,
  type LayoutCandidate,
} from "./layoutCandidate";
import { defaultLayoutWidth } from "./layoutCandidate";
import {
  cableKeysFromGraph,
  enumerateCandidates,
  layoutSearch,
  seedFromReportKey,
} from "./layoutSearch";

/**
 * Three-cable splice where stack order strongly affects strand crossings.
 * CABLE-A and CABLE-B on the left; CABLE-C on the right.
 * Fiber row indices are staggered so naive top-to-bottom stack order inverts partners.
 */
function syntheticThreeCableGraph() {
  const pairs: SplicePair[] = [
    {
      id: "pair-ac-high",
      endpointA: {
        device: "DEV-L",
        cable: "CABLE-A",
        fiberNumber: 1,
        tubeColor: "BL",
        fiberColor: "BL",
        csvColumn: "from",
      },
      endpointB: {
        device: "DEV-R",
        cable: "CABLE-C",
        fiberNumber: 2,
        tubeColor: "BL",
        fiberColor: "OR",
        csvColumn: "to",
      },
    },
    {
      id: "pair-bc-low",
      endpointA: {
        device: "DEV-L",
        cable: "CABLE-B",
        fiberNumber: 1,
        tubeColor: "BL",
        fiberColor: "BL",
        csvColumn: "from",
      },
      endpointB: {
        device: "DEV-R",
        cable: "CABLE-C",
        fiberNumber: 1,
        tubeColor: "BL",
        fiberColor: "BL",
        csvColumn: "to",
      },
    },
    {
      id: "pair-ab-cross",
      endpointA: {
        device: "DEV-L",
        cable: "CABLE-A",
        fiberNumber: 2,
        tubeColor: "BL",
        fiberColor: "OR",
        csvColumn: "from",
      },
      endpointB: {
        device: "DEV-L",
        cable: "CABLE-B",
        fiberNumber: 2,
        tubeColor: "BL",
        fiberColor: "OR",
        csvColumn: "from",
      },
    },
  ];

  return buildConnectionGraph({
    header: { spliceNumber: "SYN-3C" },
    pairs,
    cableAppearances: [
      {
        device: "DEV-L",
        cable: "CABLE-A",
        left: { from: 2, to: 0 },
        right: { from: 0, to: 0 },
      },
      {
        device: "DEV-L",
        cable: "CABLE-B",
        left: { from: 2, to: 0 },
        right: { from: 0, to: 0 },
      },
      {
        device: "DEV-R",
        cable: "CABLE-C",
        left: { from: 0, to: 0 },
        right: { from: 0, to: 2 },
      },
    ],
  });
}

function bestCandidateByEvaluation(
  graph: ReturnType<typeof syntheticThreeCableGraph>,
  candidates: LayoutCandidate[],
): { candidate: LayoutCandidate; evaluation: ReturnType<typeof evaluateLayoutCandidate> } {
  let best: {
    candidate: LayoutCandidate;
    evaluation: ReturnType<typeof evaluateLayoutCandidate>;
  } | null = null;

  for (const candidate of candidates) {
    const evaluation = evaluateLayoutCandidate(graph, candidate);
    if (
      !best ||
      compareCandidates(
        { score: evaluation.score, candidate },
        { score: best.evaluation.score, candidate: best.candidate },
      ) < 0
    ) {
      best = { candidate, evaluation };
    }
  }

  if (!best) throw new Error("no candidates");
  return best;
}

function exampleTwoGraph() {
  const report = parseBentleyCsv(
    readReferenceCsv("CSV Splice Detail Example #2.csv"),
  );
  return buildConnectionGraph(report);
}

describe("layoutSearch Phase 1", () => {
  it("evaluateLayoutCandidate runs grid route + rule check for one candidate", () => {
    const graph = syntheticThreeCableGraph();
    const baseline = heuristicBaselineCandidate(graph);
    const result = evaluateLayoutCandidate(graph, baseline);

    expect(result.routes).toBeDefined();
    expect(result.grid).toBeDefined();
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.routes!.size).toBeGreaterThan(0);
    expect(typeof result.feasible).toBe("boolean");
    expect(typeof result.score).toBe("number");
  });

  it("brute-force 3-cable fixture beats heuristic baseline score", () => {
    const graph = syntheticThreeCableGraph();
    const cableKeys = cableKeysFromGraph(graph);
    expect(cableKeys).toHaveLength(3);

    const candidates = enumerateCandidates(cableKeys, [
      1200,
      defaultLayoutWidth(),
    ]);
    expect(candidates.length).toBeGreaterThan(16);

    const best = bestCandidateByEvaluation(graph, candidates);
    const baseline = heuristicBaselineCandidate(graph);
    const baselineEval = evaluateLayoutCandidate(graph, baseline);

    expect(best.evaluation.feasible).toBe(true);
    expect(baselineEval.feasible).toBe(true);
    expect(best.evaluation.score).toBeLessThan(baselineEval.score);
    expect(best.candidate.layoutWidth).toBe(1200);
  });

  it("brute-force selection is deterministic for a fixed candidate set", () => {
    const graph = syntheticThreeCableGraph();
    const cableKeys = cableKeysFromGraph(graph);
    const candidates = enumerateCandidates(cableKeys, [
      1200,
      defaultLayoutWidth(),
    ]);

    const run1 = bestCandidateByEvaluation(graph, candidates);
    const run2 = bestCandidateByEvaluation(graph, candidates);

    expect(run1.candidate.id).toBe(run2.candidate.id);
    expect(run1.evaluation.score).toBe(run2.evaluation.score);
    expect(run1.evaluation.softScore).toEqual(run2.evaluation.softScore);
  });
});

describe("layoutSearch Phase 2", () => {
  it("layoutSearch brute-forces 3-cable fixture and beats heuristic baseline", () => {
    const graph = syntheticThreeCableGraph();
    const seed = seedFromReportKey(reportStorageKey(graph));
    const result = layoutSearch(graph, { seed, maxRounds: 0 });

    const baseline = heuristicBaselineCandidate(graph);
    const baselineEval = evaluateLayoutCandidate(graph, baseline);
    const searchEval = evaluateLayoutCandidate(graph, result.best);

    expect(result.evaluations).toBeGreaterThan(1);
    expect(searchEval.feasible).toBe(true);
    expect(searchEval.score).toBeLessThanOrEqual(baselineEval.score);
    expect(searchEval.softScore.crossings).toBeLessThanOrEqual(
      baselineEval.softScore.crossings,
    );
  });

  it("layoutSearch is deterministic for same graph + seed", () => {
    const graph = syntheticThreeCableGraph();
    const seed = seedFromReportKey(reportStorageKey(graph));
    const config = { seed, maxRounds: 32, plateauRounds: 0 };

    const run1 = layoutSearch(graph, config);
    const run2 = layoutSearch(graph, config);

    expect(run1.best.id).toBe(run2.best.id);
    expect(run1.bestScore).toBe(run2.bestScore);
    expect(run1.evaluations).toBe(run2.evaluations);
  });

  it("Example #2: search matches or beats heuristic on crossings / soft score", () => {
    const graph = exampleTwoGraph();
    const seed = seedFromReportKey(reportStorageKey(graph));
    const result = layoutSearch(graph, { seed, maxRounds: 500, plateauRounds: 64 });

    const baseline = heuristicBaselineCandidate(graph);
    const baselineEval = evaluateLayoutCandidate(graph, baseline);
    const searchEval = evaluateLayoutCandidate(graph, result.best);

    expect(searchEval.feasible).toBe(true);
    const crossingsOk =
      searchEval.softScore.crossings <= baselineEval.softScore.crossings;
    const scoreOk = searchEval.score <= baselineEval.score;
    expect(crossingsOk || scoreOk).toBe(true);
  }, 120_000);

  it("Example #2 determinism: same seed yields same best candidate id", () => {
    const graph = exampleTwoGraph();
    const seed = seedFromReportKey(reportStorageKey(graph));
    const config = { seed, maxRounds: 100, plateauRounds: 0 };

    const run1 = layoutSearch(graph, config);
    const run2 = layoutSearch(graph, config);

    expect(run1.best.id).toBe(run2.best.id);
  }, 60_000);
});
