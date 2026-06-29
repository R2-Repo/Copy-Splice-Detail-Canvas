import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

import { syntheticHubSpliceGraph } from "../fixtures/syntheticGraphs";
import { analyzeTopology } from "./analyzeTopology";

function example2Graph() {
  return buildConnectionGraph(
    parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #2.csv")),
  );
}

describe("analyzeTopology", () => {
  it("example-2 locks two dominant through cables on opposite sides", () => {
    const graph = example2Graph();
    const analysis = analyzeTopology(graph);
    const lock = analysis.constraints.primaryPairLock;

    expect(lock).toBeDefined();
    expect(lock!.sideA).not.toBe(lock!.sideB);
    expect(lock!.cableA).toMatch(/DIST/i);
    expect(lock!.cableB).toMatch(/DIST/i);
    expect(analysis.constraints.lockedCableCount).toBe(2);
    expect(analysis.constraints.lockedCableSides[lock!.cableA]).toBe(
      lock!.sideA,
    );
    expect(analysis.constraints.lockedCableSides[lock!.cableB]).toBe(
      lock!.sideB,
    );
  });

  it("hub fixture marks drops searchable and hubs locked", () => {
    const graph = syntheticHubSpliceGraph(32);
    const analysis = analyzeTopology(graph);

    expect(analysis.constraints.lockedCableCount).toBeGreaterThanOrEqual(2);
    expect(analysis.constraints.searchableCables).toContain("DROP-A");
    expect(analysis.constraints.searchableCables).toContain("DROP-B");
    expect(analysis.constraints.searchableCables).not.toContain("CABLE-A-144");
    expect(analysis.constraints.searchableCables).not.toContain("CABLE-B-144");
  });

  it("computes high-affinity pair for symmetric hub graph", () => {
    const graph = syntheticHubSpliceGraph(48);
    const top = analyzeTopology(graph).affinities[0]!;

    expect(top.cableA).toMatch(/144/);
    expect(top.cableB).toMatch(/144/);
    expect(top.connectionCount).toBeGreaterThanOrEqual(24);
    expect(top.affinityA).toBeGreaterThanOrEqual(0.75);
  });
});
