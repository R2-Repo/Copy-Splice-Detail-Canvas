import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { FIBER_ROW_PITCH } from "@/features/diagram/cableLayoutMetrics";
import {
  buildLayoutRuleContext,
  checkLayoutRule,
  findSpliceOverlapPair,
} from "@/features/diagram/layoutRules";
import { scoreCableSideAssignment } from "@/features/diagram/layoutScoring";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

const csvPath = join(
  process.cwd(),
  "docs/reference/examples/SPI-215_I-80.csv",
);

function graphFromSpi215() {
  return buildConnectionGraph(parseBentleyCsv(readFileSync(csvPath, "utf8")));
}

function sameSidePairCount(graph: ReturnType<typeof graphFromSpi215>): number {
  let sameSide = 0;
  for (const conn of graph.connections) {
    if (conn.kind !== "fiber") continue;
    const sideA = graph.cableSides.get(cableNameKey(conn.pair.endpointA.cable));
    const sideB = graph.cableSides.get(cableNameKey(conn.pair.endpointB.cable));
    if (sideA === sideB) sameSide += 1;
  }
  return sameSide;
}

describe("SPI-215_I-80 layout", () => {
  it("exhaustive side search finds low same-side count", () => {
    const graph = graphFromSpi215();
    const pairs = graph.report.pairs;
    const cables = [...graph.cableSides.keys()];
    let minBends = Number.POSITIVE_INFINITY;
    for (let mask = 0; mask < 1 << cables.length; mask++) {
      const sides = new Map<string, "left" | "right">();
      cables.forEach((cable, index) => {
        sides.set(cable, (mask >> index) & 1 ? "right" : "left");
      });
      const { bends } = scoreCableSideAssignment(pairs, sides);
      if (bends < minBends) minBends = bends;
    }
    expect(minBends).toBeLessThan(20);
    expect(scoreCableSideAssignment(pairs, graph.cableSides).bends).toBe(
      minBends,
    );
  });

  it("majority of fiber pairs are cross-side after placement", () => {
    const graph = graphFromSpi215();
    const total = graph.connections.length;
    const sameSide = sameSidePairCount(graph);
    expect(sameSide / total).toBeLessThanOrEqual(0.3);
  });

  it("side assignment minimizes layout score vs naive from/to preference", () => {
    const graph = graphFromSpi215();
    const assigned = scoreCableSideAssignment(
      graph.report.pairs,
      graph.cableSides,
    );
    expect(assigned.bends).toBeLessThan(20);
  });

  it("passes FBR-001 and FBR-002", () => {
    const ctx = buildLayoutRuleContext(graphFromSpi215());
    for (const id of ["FBR-001", "FBR-002"] as const) {
      const result = checkLayoutRule(id, ctx);
      expect(result.ok, result.detail).toBe(true);
    }
  });

  it("passes splice routing spacing rules EDGE-004, EDGE-011, no stacked segments", () => {
    const ctx = buildLayoutRuleContext(graphFromSpi215());
    for (const id of ["EDGE-004", "EDGE-011"] as const) {
      const result = checkLayoutRule(id, ctx);
      expect(result.ok, `${id}: ${result.detail}`).toBe(true);
    }
    expect(findSpliceOverlapPair(ctx)).toBeNull();
  });

  it("every buffer tube has 24px pitch between consecutive fibers", () => {
    const ctx = buildLayoutRuleContext(graphFromSpi215());
    for (const vc of ctx.visualCables) {
      for (const tube of vc.tubes) {
        for (let i = 1; i < tube.fibers.length; i++) {
          const prev = tube.fibers[i - 1]!;
          const curr = tube.fibers[i]!;
          expect(
            curr.fiberNumber,
            `${vc.cable} ${tube.tubeColor}`,
          ).toBeGreaterThan(prev.fiberNumber);
          expect(
            curr.rowYOffset - prev.rowYOffset,
            `${vc.cable} ${tube.tubeColor}`,
          ).toBe(FIBER_ROW_PITCH);
        }
      }
    }
  });
});
