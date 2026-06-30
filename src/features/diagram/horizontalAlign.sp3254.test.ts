import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { candidateToPlacementMap, heuristicBaselineCandidate } from "@/features/layoutSearch/layoutCandidate";
import { computeAlignedLayout } from "@/features/diagram/spliceRowLayout";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";

import {
  HORIZONTAL_ALIGN_TOLERANCE,
  sumCrossSideHandleMisalignment,
} from "./horizontalAlign";
import { fiberRowOffsetInCable } from "./cableLayoutMetrics";
import { orderedFiberConnections, pairEndpointsForSide } from "./buildConnectionGraph";
import { cableNameKey } from "@/features/import/cableLegIdentity";

describe("Left-SP-3254.5 straight-run alignment", () => {
  it("6 DROP BL/OR aligns with 144 MP 258.96 GR SL/WH (CH 3254)", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readLeftCsv("Left-SP-3254.5.csv")),
    );
    const { visualCables } = buildVisualCablesForLayout(graph);
    const baseline = heuristicBaselineCandidate(graph);
    const placement = candidateToPlacementMap(baseline, visualCables);
    const layout = computeAlignedLayout(graph, visualCables, placement, 1400);

    const dropVc = visualCables.find((v) => /6 DROP/i.test(v.cable))!;
    const mpVc = visualCables.find((v) => /MP 258\.96/i.test(v.cable))!;

    const dropToMpGaps: number[] = [];
    for (const conn of orderedFiberConnections(graph)) {
      if (!/CH 3254/i.test(conn.pair.circuitName ?? "")) continue;
      const { left, right } = pairEndpointsForSide(conn.pair, graph);
      const leftVc = visualCables.find(
        (vc) => cableNameKey(vc.cable) === cableNameKey(left.cable),
      )!;
      const rightVc = visualCables.find(
        (vc) => cableNameKey(vc.cable) === cableNameKey(right.cable),
      )!;
      const touchesDropMp =
        (leftVc.id === dropVc.id && rightVc.id === mpVc.id) ||
        (leftVc.id === mpVc.id && rightVc.id === dropVc.id);
      if (!touchesDropMp) continue;
      const leftY =
        layout.cablePositions.get(leftVc.id)!.y +
        fiberRowOffsetInCable(leftVc, conn.id);
      const rightY =
        layout.cablePositions.get(rightVc.id)!.y +
        fiberRowOffsetInCable(rightVc, conn.id);
      dropToMpGaps.push(Math.abs(leftY - rightY));
    }

    expect(dropToMpGaps.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...dropToMpGaps)).toBeLessThanOrEqual(
      HORIZONTAL_ALIGN_TOLERANCE + 1,
    );

    const mis = sumCrossSideHandleMisalignment(
      graph,
      visualCables,
      layout.cablePositions,
      placement,
    );
    expect(mis).toBeLessThan(350);
  });
});
