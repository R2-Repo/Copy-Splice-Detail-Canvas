import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { evaluateLayoutCandidate } from "@/features/layoutSearch/evaluateCandidate";
import {
  candidateUsesQuadSides,
  heuristicBaselineCandidate,
} from "@/features/layoutSearch/layoutCandidate";
import { countSameSideLoopbacksFromCandidate } from "@/features/layoutSearch/layoutScorer";
import { pointInsideZone } from "@/features/grid/routingZone";
import { sdcRoute001 } from "@/features/rules/route001";
import { buildSdcRuleContext } from "@/features/rules/buildSdcContext";
import type { SdcRuleContext } from "@/features/rules/types";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

function classifyZoneViolations(
  label: string,
  csvFile: string,
): {
  label: string;
  usesQuadSides: boolean;
  feasible: boolean;
  route001Pass: boolean;
  outOfZonePoints: number;
  loopbacks: number;
  zoneHeight: number;
} {
  const graph = buildConnectionGraph(parseBentleyCsv(readReferenceCsv(csvFile)));
  const candidate = heuristicBaselineCandidate(graph);
  const evaluation = evaluateLayoutCandidate(graph, candidate);
  const zone = evaluation.grid!.routingZone;
  let outOfZonePoints = 0;
  for (const route of evaluation.routes?.values() ?? []) {
    for (const p of route.points) {
      if (!pointInsideZone(p, zone)) outOfZonePoints += 1;
    }
  }
  const ctx: SdcRuleContext = {
    ...buildSdcRuleContext(graph, {
      skipReactFlow: true,
      overrides: {
        reportKey: label,
        positions: {},
        optimizedLayoutCandidate: candidate,
      },
    }),
    grid: evaluation.grid,
    gridRoutes: evaluation.routes,
  };
  const route001Pass = sdcRoute001.check(ctx).every((r) => r.ok);
  return {
    label,
    usesQuadSides: candidateUsesQuadSides(candidate),
    feasible: evaluation.feasible,
    route001Pass,
    outOfZonePoints,
    loopbacks: countSameSideLoopbacksFromCandidate(candidate, graph),
    zoneHeight: zone.bottomY - zone.topY,
  };
}

describe("SDC-ROUTE-001 import repro (heuristic baseline)", () => {
  it("example-2: routes stay inside routing box or fail ROUTE-001", () => {
    const result = classifyZoneViolations(
      "example-2",
      "CSV Splice Detail Example #2.csv",
    );
    expect(result.zoneHeight).toBeGreaterThan(0);
    if (result.outOfZonePoints > 0) {
      expect(result.route001Pass).toBe(false);
    } else {
      expect(result.route001Pass).toBe(true);
    }
  });

  it("classifies out-of-box arcs vs in-box loops", () => {
    const zone = {
      x: 200,
      y: 160,
      width: 920,
      height: 460,
      leftX: 200,
      rightX: 1120,
      topY: 160,
      bottomY: 620,
    };
    const inBoxLoop = [
      { x: 250, y: 300 },
      { x: 600, y: 300 },
      { x: 600, y: 400 },
      { x: 1050, y: 400 },
    ];
    const outOfBoxArc = [
      { x: 250, y: 300 },
      { x: 600, y: 80 },
      { x: 600, y: 400 },
      { x: 1050, y: 400 },
    ];
    for (const p of inBoxLoop) {
      expect(pointInsideZone(p, zone)).toBe(true);
    }
    expect(pointInsideZone(outOfBoxArc[1]!, zone)).toBe(false);
  });
});
