import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";
import type { SplicePair } from "@/types/splice";

import { evaluateLayoutCandidate } from "./evaluateCandidate";
import { buildCanvasFromCandidate } from "./candidateToGraph";
import {
  ALL_LAYOUT_SIDES,
  compareCandidates,
  deriveLayoutMode,
  heuristicBaselineCandidate,
  sidesUsedCount,
  type LayoutCandidate,
  type LayoutSide,
} from "./layoutCandidate";
import {
  cableKeysFromGraph,
  enumerateCandidates,
  layoutSearch,
  seedFromReportKey,
} from "./layoutSearch";

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
) {
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

function leftSp3254Graph() {
  return buildConnectionGraph(
    parseBentleyCsv(readLeftCsv("Left-SP-3254.5.csv")),
  );
}

/** Single width keeps brute-force oracle fast in the fast gate. */
const FAST_WIDTHS = [1200] as const;

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
    const candidates = enumerateCandidates(cableKeys, [...FAST_WIDTHS]);
    expect(candidates.length).toBeGreaterThan(16);

    const best = bestCandidateByEvaluation(graph, candidates);
    const baselineEval = evaluateLayoutCandidate(
      graph,
      heuristicBaselineCandidate(graph),
    );

    expect(best.evaluation.feasible).toBe(true);
    expect(baselineEval.feasible).toBe(true);
    expect(best.evaluation.score).toBeLessThan(baselineEval.score);
  }, 45_000);

  it("brute-force selection is deterministic for a fixed candidate set", () => {
    const graph = syntheticThreeCableGraph();
    const cableKeys = cableKeysFromGraph(graph);
    const candidates = enumerateCandidates(cableKeys, [...FAST_WIDTHS]);

    const run1 = bestCandidateByEvaluation(graph, candidates);
    const run2 = bestCandidateByEvaluation(graph, candidates);

    expect(run1.candidate.id).toBe(run2.candidate.id);
    expect(run1.evaluation.score).toBe(run2.evaluation.score);
  }, 45_000);
});

describe("layoutSearch Phase 2", () => {
  it("layoutSearch brute-forces 3-cable fixture and beats heuristic baseline", () => {
    const graph = syntheticThreeCableGraph();
    const seed = seedFromReportKey(reportStorageKey(graph));
    const result = layoutSearch(graph, { seed, maxRounds: 0 });
    const baselineEval = evaluateLayoutCandidate(
      graph,
      heuristicBaselineCandidate(graph),
    );

    expect(result.evaluations).toBeGreaterThan(1);
    expect(result.bestScore).toBeLessThanOrEqual(baselineEval.score);
  }, 45_000);

  it("layoutSearch is deterministic for same graph + seed", () => {
    const graph = syntheticThreeCableGraph();
    const seed = seedFromReportKey(reportStorageKey(graph));
    const config = { seed, maxRounds: 0 };

    const run1 = layoutSearch(graph, config);
    const run2 = layoutSearch(graph, config);

    expect(run1.best.id).toBe(run2.best.id);
    expect(run1.bestScore).toBe(run2.bestScore);
  }, 45_000);
});

describe("layoutSearch Phase 3", () => {
  it("evaluate routes top/bottom cables via quad geometry + grid quad channels", () => {
    const graph = syntheticThreeCableGraph();
    const cableKeys = cableKeysFromGraph(graph);
    const withTop = enumerateCandidates(cableKeys, [...FAST_WIDTHS]).find(
      (c) =>
        c.stackOrder.top.length > 0 &&
        (c.stackOrder.left.length > 0 || c.stackOrder.right.length > 0),
    );
    expect(withTop).toBeDefined();
    expect(deriveLayoutMode(withTop!)).toBe("quad");

    const result = evaluateLayoutCandidate(graph, withTop!);
    expect(result.routes!.size).toBeGreaterThan(0);
    expect(result.grid).toBeDefined();
    expect(result.grid!.routingZone.topY).toBeDefined();
    expect(result.grid!.routingZone.bottomY).toBeDefined();
    expect(result.grid!.layoutMode).toBe("quad");
  });

  it("enumerateCandidates covers all four sides", () => {
    const cableKeys = cableKeysFromGraph(syntheticThreeCableGraph());
    const sidesSeen = new Set<LayoutSide>();
    for (const c of enumerateCandidates(cableKeys, [...FAST_WIDTHS])) {
      for (const side of ALL_LAYOUT_SIDES) {
        if (c.stackOrder[side].length > 0) sidesSeen.add(side);
      }
    }
    expect(sidesSeen.has("top")).toBe(true);
    expect(sidesSeen.has("bottom")).toBe(true);
  });

  it("Left-SP-3254.5: guided search with 4 sides enabled", () => {
    const graph = leftSp3254Graph();
    const seed = seedFromReportKey(reportStorageKey(graph));
    const result = layoutSearch(graph, {
      seed,
      maxRounds: 24,
      plateauRounds: 8,
      timeBudgetMs: 12_000,
    });

    expect(result.evaluations).toBeGreaterThan(0);
    expect(result.bestScore).toBeLessThan(Number.MAX_SAFE_INTEGER);
  }, 30_000);

  it("compareCandidates prefers fewer sides when scores tie", () => {
    const graph = syntheticThreeCableGraph();
    const baseline = heuristicBaselineCandidate(graph);
    const candidates = enumerateCandidates(
      cableKeysFromGraph(graph),
      [...FAST_WIDTHS],
    );
    const moreSides = candidates.find(
      (c) => sidesUsedCount(c) > sidesUsedCount(baseline),
    );
    expect(moreSides).toBeDefined();

    expect(
      compareCandidates(
        { score: 100, candidate: baseline },
        { score: 100, candidate: moreSides! },
      ),
    ).toBeLessThan(0);
  });

  it("candidateStableId encodes top/bottom stacks for tie-breaks", () => {
    const withTop = enumerateCandidates(
      cableKeysFromGraph(syntheticThreeCableGraph()),
      [...FAST_WIDTHS],
    ).find((c) => c.stackOrder.top.length > 0);
    expect(withTop?.id).toMatch(/^T\[/);
    expect(withTop?.id).toContain("B[");
  });

  it("buildCanvasFromCandidate renders nodes for a search winner", () => {
    const graph = syntheticThreeCableGraph();
    const candidate = heuristicBaselineCandidate(graph);
    const { nodes, edges } = buildCanvasFromCandidate(graph, candidate, {
      reportKey: "phase4-test",
      positions: {},
    });
    expect(nodes.some((n) => n.type === "cable")).toBe(true);
    expect(edges.length).toBeGreaterThan(0);
  });
});
