import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";

import {
  deriveLayoutMode,
  heuristicBaselineCandidate,
} from "./layoutCandidate";
import { evaluateLayoutCandidate } from "./evaluateCandidate";
import { generateSeedCandidates } from "./seedCandidateGeneration";
import { cableKeysFromGraph } from "./layoutSearch";
import { analyzeTopology } from "./topology/analyzeTopology";
import { deriveRoutingIntent } from "./routingIntent";

function layout002Failures(
  violations: Array<{ id: string; ok: boolean }>,
): Array<{ id: string; ok: boolean }> {
  return violations.filter((v) => v.id === "SDC-LAYOUT-002" && !v.ok);
}

describe("SDC-LAYOUT-002 import validation", () => {
  it("heuristic baseline passes fan-out rules (STATE_OFFICE)", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readLeftCsv("Left-STATE_OFFICE.csv")),
    );
    const result = evaluateLayoutCandidate(
      graph,
      heuristicBaselineCandidate(graph),
    );
    expect(layout002Failures(result.violations)).toEqual([]);
  }, 45_000);

  it("quad seed candidates pass fan-out stem alignment (STATE_OFFICE)", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readLeftCsv("Left-STATE_OFFICE.csv")),
    );
    const cableKeys = cableKeysFromGraph(graph);
    const topology = analyzeTopology(graph);
    const intent = deriveRoutingIntent(graph, topology);
    const seeds = generateSeedCandidates(graph, intent, topology.constraints, {
      cableKeys,
      layoutWidths: [1200],
      expansionIters: [0],
      seed: 1,
    });
    const quadSeeds = seeds.filter((c) => deriveLayoutMode(c) === "quad");
    expect(quadSeeds.length).toBeGreaterThan(0);

    for (const candidate of quadSeeds.slice(0, 4)) {
      const result = evaluateLayoutCandidate(graph, candidate);
      expect(
        layout002Failures(result.violations),
        `candidate ${candidate.id}`,
      ).toEqual([]);
    }
  }, 120_000);
});
