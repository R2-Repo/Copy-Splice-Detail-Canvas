import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { compareCandidates, heuristicBaselineCandidate } from "./layoutCandidate";
import { evaluateLayoutCandidate } from "./evaluateCandidate";
import type { LayoutCandidate, LayoutSide } from "./layoutCandidate";
import { defaultLayoutWidth } from "./layoutCandidate";
import { DEFAULT_LAYOUT_EXPANSION } from "@/features/diagram/layoutExpansion";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import type { SplicePair } from "@/types/splice";

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const perm of permutations(rest)) {
      out.push([items[i]!, ...perm]);
    }
  }
  return out;
}

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

function cableKeysFromGraph(
  graph: ReturnType<typeof syntheticThreeCableGraph>,
): string[] {
  return [...new Set(graph.legs.map((leg) => cableNameKey(leg.cable)))].sort(
    (a, b) => a.localeCompare(b),
  );
}

function enumerateCandidates(
  cableKeys: string[],
  layoutWidths: number[],
): LayoutCandidate[] {
  const n = cableKeys.length;
  const candidates: LayoutCandidate[] = [];

  for (const layoutWidth of layoutWidths) {
    for (let mask = 0; mask < 1 << n; mask++) {
      const leftKeys: string[] = [];
      const rightKeys: string[] = [];
      const cableSides: Record<string, LayoutSide> = {};

      cableKeys.forEach((cable, index) => {
        const side: LayoutSide = (mask >> index) & 1 ? "right" : "left";
        cableSides[cable] = side;
        (side === "left" ? leftKeys : rightKeys).push(cable);
      });

      const leftPerms = leftKeys.length > 0 ? permutations(leftKeys) : [[]];
      const rightPerms = rightKeys.length > 0 ? permutations(rightKeys) : [[]];

      for (const left of leftPerms) {
        for (const right of rightPerms) {
          const candidate: LayoutCandidate = {
            cableSides,
            stackOrder: { left, right },
            layoutWidth,
            layoutExpansion: DEFAULT_LAYOUT_EXPANSION,
          };
          candidate.id = `W${layoutWidth}-mask${mask}-${left.join(".")}|${right.join(".")}`;
          candidates.push(candidate);
        }
      }
    }
  }

  return candidates;
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

    // Heuristic seed uses default width only; search also tries a narrower width.
    const candidates = enumerateCandidates(cableKeys, [1200, defaultLayoutWidth()]);
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
    const candidates = enumerateCandidates(cableKeys, [1200, defaultLayoutWidth()]);

    const run1 = bestCandidateByEvaluation(graph, candidates);
    const run2 = bestCandidateByEvaluation(graph, candidates);

    expect(run1.candidate.id).toBe(run2.candidate.id);
    expect(run1.evaluation.score).toBe(run2.evaluation.score);
    expect(run1.evaluation.softScore).toEqual(run2.evaluation.softScore);
  });
});
