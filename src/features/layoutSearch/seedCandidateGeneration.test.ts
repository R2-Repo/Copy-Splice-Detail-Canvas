import { describe, expect, it } from "vitest";

import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";

import { syntheticHubSpliceGraph, syntheticTopBottomReliefGraph } from "./fixtures/syntheticGraphs";
import { cableKeysFromGraph, seedFromReportKey, widthStepsForGraph, expansionIterations } from "./layoutSearch";
import { analyzeTopology } from "./topology/analyzeTopology";
import { deriveRoutingIntent } from "./routingIntent";
import { generateSeedCandidates } from "./seedCandidateGeneration";
import { sidesUsedCount } from "./layoutCandidate";

describe("seedCandidateGeneration", () => {
  it("produces deterministic seeds for same graph + seed", () => {
    const graph = syntheticHubSpliceGraph(12);
    const topology = analyzeTopology(graph);
    const intent = deriveRoutingIntent(graph, topology);
    const cableKeys = cableKeysFromGraph(graph);
    const seed = seedFromReportKey(reportStorageKey(graph));

    const run1 = generateSeedCandidates(graph, intent, topology.constraints, {
      cableKeys,
      layoutWidths: widthStepsForGraph(graph),
      expansionIters: expansionIterations(),
      seed,
    });
    const run2 = generateSeedCandidates(graph, intent, topology.constraints, {
      cableKeys,
      layoutWidths: widthStepsForGraph(graph),
      expansionIters: expansionIterations(),
      seed,
    });

    expect(run1.map((c) => c.id)).toEqual(run2.map((c) => c.id));
    expect(run1.length).toBeGreaterThanOrEqual(3);
    expect(run1.length).toBeLessThanOrEqual(30);
  });

  it("includes top/bottom seeds when relief candidates exist", () => {
    const graph = syntheticTopBottomReliefGraph();
    const topology = analyzeTopology(graph);
    const intent = deriveRoutingIntent(graph, topology);
    const relaxed = {
      ...topology.constraints,
      lockedCableSides: {},
      dominantPairLock: undefined,
    };

    const seeds = generateSeedCandidates(graph, intent, relaxed, {
      cableKeys: cableKeysFromGraph(graph),
      layoutWidths: [1200],
      expansionIters: [0],
      seed: 42,
    });

    const hasTopOrBottom = seeds.some(
      (c) => c.stackOrder.top.length > 0 || c.stackOrder.bottom.length > 0,
    );
    expect(hasTopOrBottom).toBe(true);
  });

  it("simple two-cable fixture seeds use at most two sides", () => {
    const graph = syntheticTopBottomReliefGraph();
    const topology = analyzeTopology(graph);
    const intent = deriveRoutingIntent(graph, topology);

    const seeds = generateSeedCandidates(graph, intent, topology.constraints, {
      cableKeys: cableKeysFromGraph(graph),
      layoutWidths: [1200],
      expansionIters: [0],
      seed: 1,
    });

    const twoSided = seeds.filter((c) => sidesUsedCount(c) <= 2);
    expect(twoSided.length).toBeGreaterThan(0);
  });
});
