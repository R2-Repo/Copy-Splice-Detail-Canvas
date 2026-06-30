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
  bendCountFromPoints,
  bendPreferencePenalty,
  computeSoftScore,
  countSingleBendTopBottomCredit,
  DEFAULT_SOFT_SCORE_WEIGHTS,
  countSameSideLoopbacksFromCandidate,
  fourSideCrossingEstimate,
  getConnectionEndpointSides,
  sidePairKind,
  scoreCandidateScreen,
  topBottomBenefit,
} from "./layoutScorer";
import type { GridRoute } from "@/features/grid/gridTypes";

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

  it("bend preference ranks 0 corners better than 1 better than 2", () => {
    const mkRoute = (points: Array<{ x: number; y: number }>): GridRoute => ({
      connectionId: "test",
      segmentIds: [],
      points,
    });
    const straight = mkRoute([
      { x: 0, y: 100 },
      { x: 400, y: 100 },
    ]);
    const oneBend = mkRoute([
      { x: 0, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 300 },
    ]);
    const twoBend = mkRoute([
      { x: 0, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 300 },
      { x: 400, y: 300 },
    ]);

    expect(bendCountFromPoints(straight.points)).toBe(0);
    expect(bendCountFromPoints(oneBend.points)).toBe(1);
    expect(bendCountFromPoints(twoBend.points)).toBe(2);

    const zeroRoutes = new Map([["a", straight]]);
    const oneRoutes = new Map([["a", oneBend]]);
    const twoRoutes = new Map([["a", twoBend]]);

    expect(bendPreferencePenalty(zeroRoutes)).toBe(0);
    expect(bendPreferencePenalty(oneRoutes)).toBe(
      DEFAULT_SOFT_SCORE_WEIGHTS.bendOneCorner,
    );
    expect(bendPreferencePenalty(twoRoutes)).toBe(
      DEFAULT_SOFT_SCORE_WEIGHTS.bendTwoCorner,
    );
    expect(bendPreferencePenalty(oneRoutes)).toBeLessThan(
      bendPreferencePenalty(twoRoutes),
    );
  });

  it("T0 screen score does not penalize top/bottom sidesUsed count", () => {
    const graph = syntheticTopBottomReliefGraph();
    const cableKeys = cableKeysFromGraph(graph);
    const { visualCables } = buildVisualCablesForLayout(graph);
    const rowIndex = connectionRowIndexMap(graph, visualCables);
    const topBottom = enumerateCandidates(cableKeys, [1200]).find(
      (c: LayoutCandidate) =>
        c.cableSides["CABLE-A"] === "top" &&
        c.cableSides["CABLE-B"] === "bottom",
    )!;

    const screen = scoreCandidateScreen(
      topBottom,
      graph,
      visualCables,
      rowIndex,
    );
    const reliefOnly =
      screen.crossings * DEFAULT_SOFT_SCORE_WEIGHTS.crossings +
      screen.sameSideLoopbacks * DEFAULT_SOFT_SCORE_WEIGHTS.sameSideLoopbacks +
      screen.sidePairPenalty +
      screen.topBottomRelief +
      screen.heightImbalance * DEFAULT_SOFT_SCORE_WEIGHTS.heightImbalance;

    expect(screen.total).toBe(reliefOnly);
    expect(sidesUsedCount(topBottom)).toBe(2);
  });

  it("computeSoftScore applies single-bend top/bottom credit on T2", () => {
    const graph = twoCableGraph();
    const cableKeys = cableKeysFromGraph(graph);
    const candidate = enumerateCandidates(cableKeys, [1200]).find(
      (c: LayoutCandidate) =>
        c.cableSides.A === "top" && c.cableSides.B === "bottom",
    )!;
    const oneBendRoute: GridRoute = {
      connectionId: graph.connections[0]!.id,
      segmentIds: [],
      points: [
        { x: 100, y: 50 },
        { x: 100, y: 200 },
        { x: 300, y: 200 },
      ],
    };
    const routes = new Map([[graph.connections[0]!.id, oneBendRoute]]);

    const weights = {
      ...DEFAULT_SOFT_SCORE_WEIGHTS,
      crossings: 0,
      sameSideLoopbacks: 0,
      centerWidth: 0,
      heightImbalance: 0,
      pathLength: 0,
    };

    const credit = countSingleBendTopBottomCredit(
      routes,
      candidate,
      graph,
      weights,
    );
    expect(credit).toBe(weights.singleBendTopBottomCredit);

    const scored = computeSoftScore(
      candidate,
      routes,
      undefined,
      undefined,
      graph,
      600,
      weights,
    );
    expect(scored.bendOneCount).toBe(1);
    expect(scored.topBottomSingleBendCredit).toBe(credit);
    expect(scored.bendsOverBudget).toBe(weights.bendOneCorner);
    expect(scored.total).toBe(
      scored.bendsOverBudget - scored.topBottomSingleBendCredit,
    );
  });
});
