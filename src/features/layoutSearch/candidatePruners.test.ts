import { describe, expect, it } from "vitest";

import { connectionRowIndexMap } from "@/features/diagram/connectionRowOrder";
import { DEFAULT_LAYOUT_EXPANSION } from "@/features/diagram/layoutExpansion";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";

import {
  heuristicBaselineCandidate,
  type LayoutCandidate,
  type LayoutSide,
} from "./layoutCandidate";
import { enumerateCandidates } from "./layoutSearch";
import { predictEarlyRejectAtT0, predictEarlyRejectAtT1 } from "./candidatePruners";
import { syntheticTopBottomReliefGraph } from "./fixtures/syntheticGraphs";
import { cableKeysFromGraph } from "./layoutSearch";
import type { TopologyConstraints } from "./topology/topologyTypes";

function emptyConstraints(cableKeys: string[]): TopologyConstraints {
  return {
    lockedCableSides: {},
    forbiddenSameSidePairs: [],
    searchableCables: cableKeys,
    hubCables: [],
    satelliteCables: cableKeys,
    proxyBundleGroups: [],
    lockedCableCount: 0,
  };
}

describe("candidatePruners", () => {
  it("rejects top/bottom candidates with no relief at T1", () => {
    const graph = syntheticTopBottomReliefGraph();
    const cableKeys = cableKeysFromGraph(graph);
    const constraints = emptyConstraints(cableKeys);
    const { visualCables } = buildVisualCablesForLayout(graph);
    const rowIndex = connectionRowIndexMap(graph, visualCables);

    const baseline = heuristicBaselineCandidate(graph);
    const baselineReject = predictEarlyRejectAtT0(
      baseline,
      graph,
      constraints,
      visualCables,
      rowIndex,
    );
    expect(baselineReject.reject).toBe(false);

    const noReliefTopBottom: LayoutCandidate = {
      cableSides: {
        "CABLE-A": "top" as LayoutSide,
        "CABLE-B": "top" as LayoutSide,
      },
      stackOrder: {
        left: [],
        right: [],
        top: ["CABLE-A", "CABLE-B"],
        bottom: [],
      },
      layoutWidth: 1200,
      layoutExpansion: DEFAULT_LAYOUT_EXPANSION,
    };

    const reject = predictEarlyRejectAtT1(
      noReliefTopBottom,
      graph,
      constraints,
      visualCables,
      rowIndex,
    );
    expect(reject.reject).toBe(true);
    expect(reject.reason).toBe("top-bottom-no-relief");
    expect(reject.predictedRules).toContain("SDC-LAYOUT-002");
  });

  it("allows top/bottom relief candidates through T1 gate", () => {
    const graph = syntheticTopBottomReliefGraph();
    const cableKeys = cableKeysFromGraph(graph);
    const constraints = emptyConstraints(cableKeys);
    const { visualCables } = buildVisualCablesForLayout(graph);
    const rowIndex = connectionRowIndexMap(graph, visualCables);

    const relief = enumerateCandidates(cableKeys, [1200]).find(
      (c) =>
        c.cableSides["CABLE-A"] === "top" &&
        c.cableSides["CABLE-B"] === "bottom",
    );
    expect(relief).toBeDefined();

    const reject = predictEarlyRejectAtT1(
      relief!,
      graph,
      constraints,
      visualCables,
      rowIndex,
    );
    expect(reject.reject).toBe(false);
  });
});
