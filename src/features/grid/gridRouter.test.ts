import { describe, expect, it } from "vitest";

import { buildSpliceHandleEntries } from "@/features/canvas/edges/spliceHandleEntries";
import type { SpliceHandleEntry } from "@/features/canvas/edges/spliceHandleEntries";
import {
  defaultSideCircuitLabelSpan,
  isCenterVerticalCrossingHandleRowLeadIn,
  hvDemarcatedPathsCross,
  spliceRouteSegments,
} from "@/features/canvas/edges/splicePathGeometry";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { routeCenterSplices } from "@/features/diagram/centerRouter";
import {
  assignSpliceRoutingLanes,
  handleEntriesToCandidates,
} from "@/features/diagram/spliceCenterLanes";
import { FIBER_ROW_PITCH, SPLICE_LANE_SEP } from "@/features/diagram/cableLayoutMetrics";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";
import { buildGridRoutingInput } from "@/features/rules/buildSdcContext";

import { assignGridLanes } from "./gridLaneAssign";
import { buildGridMap } from "./gridMap";
import { splicePathFromGridRoute } from "./gridPathAdapter";
import { routeAllOnGrid } from "./gridRouter";
import { validateGridRoutes } from "./reservation";

const REFERENCE_FILES = [
  "Left-SP-3254.5.csv",
  "Left-STATE_OFFICE.csv",
  "Left-SPI-215_I-80.csv",
] as const;

function syntheticBundleEntries(
  sourceX: number,
  targetX: number,
  bundleKey: string,
  count: number,
): SpliceHandleEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String.fromCharCode(97 + index),
    sourceNodeId: "src",
    targetNodeId: "tgt",
    sourceX,
    sourceY: 100 + index * 24,
    targetX,
    targetY: 400 + index * 24,
    fallbackLane: index,
    rowOffset: index * 24,
    tubeBundleKey: bundleKey,
  }));
}

function sameSideLoopBundleEntries(
  columnX: number,
  bundleKey: string,
  downward: boolean,
): SpliceHandleEntry[] {
  const colors = ["bl", "or", "gr", "br", "sl", "wh"];
  const sideSpans = { left: 66, right: 120 };
  return colors.map((id, index) => {
    const sourceY = downward
      ? 100 + index * FIBER_ROW_PITCH
      : 400 + index * FIBER_ROW_PITCH;
    const targetY = downward
      ? 400 + index * FIBER_ROW_PITCH
      : 100 + index * FIBER_ROW_PITCH;
    return {
      id,
      sourceNodeId: "src",
      targetNodeId: "tgt",
      sourceX: columnX,
      sourceY,
      targetX: columnX,
      targetY,
      fallbackLane: index,
      rowOffset: index * FIBER_ROW_PITCH,
      tubeBundleKey: bundleKey,
      sideCircuitSpan: sideSpans,
    };
  });
}

function gridForEntries(
  entries: SpliceHandleEntry[],
  width = 1200,
): ReturnType<typeof buildGridMap> {
  return buildGridMap({
    anchors: entries.flatMap((e) => [
      {
        x: e.sourceX,
        y: e.sourceY,
        side: (e.sourceX < e.targetX ? "left" : "right") as "left" | "right",
      },
      {
        x: e.targetX,
        y: e.targetY,
        side: (e.targetX > e.sourceX ? "right" : "left") as "left" | "right",
      },
    ]),
    bounds: { width, height: 800 },
  });
}

describe("gridRouter", () => {
  it("routes Left-SP-3254.5 with reserved segments", () => {
    const graph = buildConnectionGraph(parseBentleyCsv(readReferenceCsv("Left-SP-3254.5.csv")));
    const result = routeAllOnGrid(buildGridRoutingInput(graph));

    expect(result.routes.size).toBeGreaterThan(0);
    expect(result.lanes.size).toBeGreaterThan(0);
    expect(validateGridRoutes(result.grid, result.routes)).toEqual([]);
    const routed = result.edges.filter((e) => e.type === "splice" && !e.id.startsWith("butt-"));
    expect(routed.length).toBeGreaterThan(0);
    for (const edge of routed) {
      const data = edge.data as Record<string, unknown>;
      if (data.routingPrecomputed) {
        expect(data.leftPath).toBeTruthy();
        expect(data.rightPath).toBeTruthy();
      }
    }
  });

  it("grid map has routing zone between cable frontiers", () => {
    const graph = buildConnectionGraph(parseBentleyCsv(readReferenceCsv("Left-SP-3254.5.csv")));
    const result = routeAllOnGrid(buildGridRoutingInput(graph));
    expect(result.grid.routingZone.width).toBeGreaterThan(0);
    expect(result.grid.segments.size).toBeGreaterThan(0);
  });

  for (const file of REFERENCE_FILES) {
    it(`${file}: grid lane midX within snap tolerance of nodes engine`, () => {
      const graph = buildConnectionGraph(parseBentleyCsv(readReferenceCsv(file)));
      const input = buildGridRoutingInput(graph);
      const layoutWidth = input.layoutWidth;
      const centerX = input.diagramCenterX;

      const handleEntries = buildSpliceHandleEntries(
        input.nodes,
        input.edges,
        input.visualCables,
      );
      const sideSpans =
        handleEntries.find((entry) => entry.sideCircuitSpan)?.sideCircuitSpan ??
        defaultSideCircuitLabelSpan();
      const nodesLanes = assignSpliceRoutingLanes(
        handleEntriesToCandidates(handleEntries),
        sideSpans,
      );

      const anchors = handleEntries.flatMap((e) => [
        {
          x: e.sourceX,
          y: e.sourceY,
          side: e.sourceX < e.targetX ? ("left" as const) : ("right" as const),
        },
        {
          x: e.targetX,
          y: e.targetY,
          side: e.targetX > e.sourceX ? ("right" as const) : ("left" as const),
        },
      ]);
      const grid = buildGridMap({
        anchors,
        bounds: { width: layoutWidth, height: 800 },
        extraVerticalXs: [...nodesLanes.values()].map((lane) => lane.midX),
      });
      const { lanes: gridLanes, routes } = assignGridLanes(
        handleEntries,
        grid,
        centerX,
        undefined,
        nodesLanes,
      );

      expect(gridLanes.size).toBe(nodesLanes.size);
      for (const [edgeId, nodesLane] of nodesLanes) {
        const gridLane = gridLanes.get(edgeId);
        expect(gridLane, edgeId).toBeDefined();
        // Grid may offset midX by multiple lane steps to de-stack vertical legs (EDGE-011).
        expect(Math.abs(gridLane!.midX - nodesLane.midX)).toBeLessThanOrEqual(
          SPLICE_LANE_SEP * 65,
        );
      }
      expect(validateGridRoutes(grid, routes)).toEqual([]);
    });
  }

  it("assignGridLanes spaces tube bundle lanes and shares jogX trunk", () => {
    const sourceX = 500;
    const targetX = 100;
    const centerX = 300;
    const bundleKey = "vc-right|BL|vc-left";
    const entries: SpliceHandleEntry[] = [
      {
        id: "bl",
        sourceNodeId: "src",
        targetNodeId: "tgt",
        sourceX,
        sourceY: 100,
        targetX,
        targetY: 400,
        fallbackLane: 0,
        rowOffset: 0,
        tubeBundleKey: bundleKey,
      },
      {
        id: "or",
        sourceNodeId: "src",
        targetNodeId: "tgt",
        sourceX,
        sourceY: 124,
        targetX,
        targetY: 376,
        fallbackLane: 1,
        rowOffset: 24,
        tubeBundleKey: bundleKey,
      },
    ];
    const grid = buildGridMap({
      anchors: entries.flatMap((e) => [
        { x: e.sourceX, y: e.sourceY, side: "right" as const },
        { x: e.targetX, y: e.targetY, side: "left" as const },
      ]),
      bounds: { width: 1200, height: 800 },
    });
    const { lanes, routes } = assignGridLanes(entries, grid, centerX);
    const bl = lanes.get("bl")!;
    const or = lanes.get("or")!;
    expect(Math.abs(or.midX - bl.midX)).toBeGreaterThanOrEqual(SPLICE_LANE_SEP - 0.01);
    const outerLane = or.jogX !== undefined ? or : bl;
    expect(outerLane.jogX).toBeDefined();
    expect(bl.jogX ?? outerLane.jogX).toBe(or.jogX ?? outerLane.jogX);
    expect(validateGridRoutes(grid, routes)).toEqual([]);
  });

  it("assignGridLanes anchors bundle trunk at source side (no loop-back)", () => {
    const sourceX = 100;
    const targetX = 1100;
    const centerX = 550;
    const bundleKey = "vc-left|BL|vc-right";
    const entries = syntheticBundleEntries(sourceX, targetX, bundleKey, 4);
    const grid = gridForEntries(entries);
    const { lanes } = assignGridLanes(entries, grid, centerX);

    const laneList = entries.map((e) => lanes.get(e.id)!);
    const mids = laneList.map((l) => l.midX);
    const minMid = Math.min(...mids);
    const trunkXs = laneList
      .map((l) => l.jogX)
      .filter((x): x is number => x !== undefined);
    expect(new Set(trunkXs).size).toBe(1);
    expect(trunkXs[0]).toBe(minMid);
    for (const lane of laneList) {
      expect(lane.midX).toBeGreaterThanOrEqual(minMid - 0.01);
    }
  });

  it("grid left path skips reverse fan-out when jogX exceeds midX", () => {
    const centerX = 550;
    const entry: SpliceHandleEntry = {
      id: "strand-a",
      sourceNodeId: "src",
      targetNodeId: "tgt",
      sourceX: 100,
      sourceY: 50,
      targetX: 900,
      targetY: 200,
      fallbackLane: 0,
    };
    const lane = { midX: 350, jogX: 400 };
    const { leftPath } = splicePathFromGridRoute(entry, lane, centerX);
    expect(leftPath).not.toContain("L 400,50");
  });

  it("assignGridLanes packs same-side loop bundle with crossing source bend on downward splices", () => {
    const columnX = 200;
    const centerX = 700;
    const bundleKey = "vc-left|BL|vc-left-lower";
    const entries = sameSideLoopBundleEntries(columnX, bundleKey, true);
    const sideSpans = { left: 66, right: 120 };
    const nodesLanes = routeCenterSplices(entries, centerX);
    const grid = buildGridMap({
      anchors: entries.flatMap((e) => [
        { x: e.sourceX, y: e.sourceY, side: "left" as const },
        { x: e.targetX, y: e.targetY, side: "left" as const },
      ]),
      bounds: { width: 1400, height: 800 },
      extraVerticalXs: [...nodesLanes.values()].map((lane) => lane.midX),
    });
    const { lanes, routes } = assignGridLanes(
      entries,
      grid,
      centerX,
      undefined,
      nodesLanes,
    );

    const bl = lanes.get("bl")!;
    const wh = lanes.get("wh")!;
    expect(bl.midX).toBeLessThanOrEqual(wh.midX);
    expect(Math.abs(wh.midX - bl.midX)).toBeGreaterThanOrEqual(SPLICE_LANE_SEP - 0.01);
    expect(bl.jogX).toBeUndefined();
    expect(wh.jogX).toBeUndefined();
    expect(validateGridRoutes(grid, routes)).toEqual([]);

    const blSegs = spliceRouteSegments(
      columnX,
      entries[0]!.sourceY,
      columnX,
      entries[0]!.targetY,
      bl.midX,
      undefined,
      undefined,
      sideSpans,
      centerX,
    );
    const whSegs = spliceRouteSegments(
      columnX,
      entries[5]!.sourceY,
      columnX,
      entries[5]!.targetY,
      wh.midX,
      undefined,
      undefined,
      sideSpans,
      centerX,
    );
    let sourceBendCrosses = false;
    for (const vertical of blSegs) {
      for (const horizontal of whSegs) {
        if (
          isCenterVerticalCrossingHandleRowLeadIn(
            vertical,
            horizontal,
            entries[5]!.sourceY,
          )
        ) {
          sourceBendCrosses = true;
        }
      }
    }
    expect(sourceBendCrosses).toBe(true);
  });

  it("assignGridLanes packs same-side loop bundle on upward splices without path cross", () => {
    const columnX = 200;
    const centerX = 700;
    const bundleKey = "vc-left|BL|vc-left-upper";
    const entries = sameSideLoopBundleEntries(columnX, bundleKey, false);
    const nodesLanes = routeCenterSplices(entries, centerX);
    const blNodes = nodesLanes.get("bl")!;
    const whNodes = nodesLanes.get("wh")!;

    const grid = buildGridMap({
      anchors: entries.flatMap((e) => [
        { x: e.sourceX, y: e.sourceY, side: "left" as const },
        { x: e.targetX, y: e.targetY, side: "left" as const },
      ]),
      bounds: { width: 1400, height: 800 },
      extraVerticalXs: [...nodesLanes.values()].map((lane) => lane.midX),
    });
    const { lanes, routes } = assignGridLanes(
      entries,
      grid,
      centerX,
      undefined,
      nodesLanes,
    );

    const bl = lanes.get("bl")!;
    const wh = lanes.get("wh")!;
    expect(Math.abs(bl.midX - blNodes.midX)).toBeLessThanOrEqual(SPLICE_LANE_SEP);
    expect(Math.abs(wh.midX - whNodes.midX)).toBeLessThanOrEqual(SPLICE_LANE_SEP);
    expect(Math.abs(bl.midX - wh.midX)).toBeGreaterThanOrEqual(SPLICE_LANE_SEP - 0.01);
    expect(validateGridRoutes(grid, routes)).toEqual([]);
    expect(
      hvDemarcatedPathsCross(
        columnX,
        entries[0]!.sourceY,
        columnX,
        entries[0]!.targetY,
        bl.midX,
        columnX,
        entries[5]!.sourceY,
        columnX,
        entries[5]!.targetY,
        wh.midX,
        bl.jogX,
        wh.jogX,
      ),
    ).toBe(false);
  });
});
