import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { connectionRowIndexMap } from "@/features/diagram/connectionRowOrder";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import type { SplicePair } from "@/types/splice";

import {
  ALL_LAYOUT_SIDES,
  heuristicBaselineCandidate,
  sidesUsedCount,
  type LayoutCandidate,
} from "./layoutCandidate";
import { cableKeysFromGraph, enumerateCandidates } from "./layoutSearch";
import { syntheticTopBottomReliefGraph } from "./fixtures/syntheticGraphs";
import {
  countSameSideLoopbacksFromCandidate,
  fourSideCrossingEstimate,
  getConnectionEndpointSides,
  sidePairKind,
  scoreCandidateScreen,
  topBottomBenefit,
} from "./layoutScorer";

function twoCableGraph() {
  const pairs: SplicePair[] = [
    {
      id: "p1",
      endpointA: {
        device: "D",
        cable: "A",
        fiberNumber: 1,
        tubeColor: "BL",
        fiberColor: "BL",
        csvColumn: "from",
      },
      endpointB: {
        device: "D",
        cable: "B",
        fiberNumber: 1,
        tubeColor: "BL",
        fiberColor: "BL",
        csvColumn: "to",
      },
    },
  ];
  return buildConnectionGraph({
    header: { spliceNumber: "2C" },
    pairs,
    cableAppearances: [
      { device: "D", cable: "A", left: { from: 1, to: 0 }, right: { from: 0, to: 0 } },
      { device: "D", cable: "B", left: { from: 0, to: 0 }, right: { from: 0, to: 1 } },
    ],
  });
}

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

describe("layoutScorer four-side", () => {
  it("sidePairKind classifies same, opposite, adjacent", () => {
    expect(sidePairKind("left", "left")).toBe("same");
    expect(sidePairKind("top", "top")).toBe("same");
    expect(sidePairKind("left", "right")).toBe("opposite");
    expect(sidePairKind("top", "bottom")).toBe("opposite");
    expect(sidePairKind("left", "top")).toBe("adjacent");
    expect(sidePairKind("right", "bottom")).toBe("adjacent");
  });

  it("getConnectionEndpointSides reads candidate sides", () => {
    const graph = twoCableGraph();
    const cableKeys = cableKeysFromGraph(graph);
    const candidate = enumerateCandidates(cableKeys, [1200]).find(
      (c: LayoutCandidate) =>
        c.cableSides.A === "top" && c.cableSides.B === "bottom",
    );
    expect(candidate).toBeDefined();
    const conn = graph.connections[0]!;
    const sides = getConnectionEndpointSides(candidate!, graph, conn as never);
    expect(sides.sideA).toBe("top");
    expect(sides.sideB).toBe("bottom");
  });

  it("countSameSideLoopbacks detects L-L and T-T not adjacent", () => {
    const graph = syntheticTopBottomReliefGraph();
    const cableKeys = cableKeysFromGraph(graph);
    const allLeft = enumerateCandidates(cableKeys, [1200]).find(
      (c: LayoutCandidate) =>
        c.cableSides["CABLE-A"] === "left" && c.cableSides["CABLE-B"] === "left",
    );
    const topBottom = enumerateCandidates(cableKeys, [1200]).find(
      (c: LayoutCandidate) =>
        c.cableSides["CABLE-A"] === "top" &&
        c.cableSides["CABLE-B"] === "bottom",
    );
    expect(allLeft).toBeDefined();
    expect(topBottom).toBeDefined();
    expect(countSameSideLoopbacksFromCandidate(allLeft!, graph)).toBe(12);
    expect(countSameSideLoopbacksFromCandidate(topBottom!, graph)).toBe(0);
  });

  it("top/bottom screen score beats same-side L/L on relief fixture", () => {
    const graph = syntheticTopBottomReliefGraph();
    const cableKeys = cableKeysFromGraph(graph);
    const { visualCables } = buildVisualCablesForLayout(graph);
    const rowIndex = connectionRowIndexMap(graph, visualCables);

    const allLeft = enumerateCandidates(cableKeys, [1200]).find(
      (c: LayoutCandidate) =>
        c.cableSides["CABLE-A"] === "left" && c.cableSides["CABLE-B"] === "left",
    )!;
    const topBottom = enumerateCandidates(cableKeys, [1200]).find(
      (c: LayoutCandidate) =>
        c.cableSides["CABLE-A"] === "top" &&
        c.cableSides["CABLE-B"] === "bottom",
    )!;

    const leftScore = scoreCandidateScreen(
      allLeft,
      graph,
      visualCables,
      rowIndex,
    );
    const tbScore = scoreCandidateScreen(
      topBottom,
      graph,
      visualCables,
      rowIndex,
    );

    expect(tbScore.total).toBeLessThan(leftScore.total);
    expect(topBottomBenefit(topBottom, graph, visualCables, rowIndex)).toBeLessThan(
      0,
    );
  });

  it("fourSideCrossingEstimate runs for quad candidates", () => {
    const graph = twoCableGraph();
    const cableKeys = cableKeysFromGraph(graph);
    const { visualCables } = buildVisualCablesForLayout(graph);
    const rowIndex = connectionRowIndexMap(graph, visualCables);
    const quad = enumerateCandidates(cableKeys, [1200]).find(
      (c: LayoutCandidate) => c.stackOrder.top.length > 0,
    );
    expect(quad).toBeDefined();
    expect(
      fourSideCrossingEstimate(quad!, graph, visualCables, rowIndex),
    ).toBeGreaterThanOrEqual(0);
    for (const side of ALL_LAYOUT_SIDES) {
      expect(typeof quad!.stackOrder[side]).toBe("object");
    }
  });

  it("simple two-cable L/R uses fewer sides than quad placement", () => {
    const graph = syntheticThreeCableGraph();
    const baseline = heuristicBaselineCandidate(graph);
    const cableKeys = cableKeysFromGraph(graph);
    const quad = enumerateCandidates(cableKeys, [1200]).find(
      (c: LayoutCandidate) => sidesUsedCount(c) >= 3,
    )!;

    expect(sidesUsedCount(baseline)).toBeLessThanOrEqual(2);
    expect(sidesUsedCount(quad)).toBeGreaterThanOrEqual(3);
  });
});
