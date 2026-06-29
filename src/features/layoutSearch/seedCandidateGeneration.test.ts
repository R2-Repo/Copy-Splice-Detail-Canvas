import { describe, expect, it } from "vitest";

import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";

import { syntheticHubSpliceGraph, syntheticTopBottomReliefGraph } from "./fixtures/syntheticGraphs";
import { cableKeysFromGraph, seedFromReportKey, widthStepsForGraph, expansionIterations } from "./layoutSearch";
import { analyzeTopology } from "./topology/analyzeTopology";
import { deriveRoutingIntent } from "./routingIntent";
import { generateSeedCandidates } from "./seedCandidateGeneration";
import { sidesUsedCount } from "./layoutCandidate";
import { predictEarlyRejectAtT1 } from "./candidatePruners";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { connectionRowIndexMap } from "@/features/diagram/connectionRowOrder";
import { topBottomBenefit } from "./layoutScorer";

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

  it("top/bottom relief seeds are not pruned before T1 proxy", () => {
    const graph = syntheticTopBottomReliefGraph();
    const topology = analyzeTopology(graph);
    const intent = deriveRoutingIntent(graph, topology);
    const cableKeys = cableKeysFromGraph(graph);
    const constraints = {
      lockedCableSides: {},
      forbiddenSameSidePairs: [],
      searchableCables: cableKeys,
      hubCables: [],
      satelliteCables: cableKeys,
      proxyBundleGroups: [],
      lockedCableCount: 0,
    };
    const { visualCables } = buildVisualCablesForLayout(graph);
    const rowIndex = connectionRowIndexMap(graph, visualCables);

    const seeds = generateSeedCandidates(graph, intent, constraints, {
      cableKeys,
      layoutWidths: [1200],
      expansionIters: [0],
      seed: 42,
    });

    const reliefSeeds = seeds.filter(
      (c) =>
        c.cableSides["CABLE-A"] === "top" &&
        c.cableSides["CABLE-B"] === "bottom",
    );
    expect(reliefSeeds.length).toBeGreaterThan(0);
    for (const seed of reliefSeeds) {
      expect(topBottomBenefit(seed, graph, visualCables, rowIndex)).toBeLessThan(0);
      expect(
        predictEarlyRejectAtT1(
          seed,
          graph,
          constraints,
          visualCables,
          rowIndex,
        ).reject,
      ).toBe(false);
    }
  });
});
