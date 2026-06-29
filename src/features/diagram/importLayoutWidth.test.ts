import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runKnownIssuesTests } from "@/testHelpers/knownLayoutIssues";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import {
  CABLE_LAYOUT,
  minCenterGapForRowSpan,
  SPLICE_LANE_SEP,
} from "@/features/diagram/cableLayoutMetrics";
import {
  activeSpliceLaneCount,
  applyLayoutOverrides,
  importLayoutWidthForGraph,
  layoutWidthForViewport,
  minLayoutWidthForGraph,
} from "@/features/diagram/layoutSpliceDiagram";
import { stageInnerWidth } from "@/features/canvas/diagramViewport";
import { computeCanvasPlacement } from "@/features/diagram/canvasPlacement";
import {
  connectionRowIndexMap,
  connectionRowOffsets,
  maxConnectionRowOffset,
} from "@/features/diagram/connectionRowOrder";
import {
  collapsedPairIdsFromButtSplices,
  detectFullButtSpliceTubes,
  resolveFullButtSpliceVisuals,
} from "@/features/diagram/fullButtSplice";
import {
  computeCableXBounds,
  estimatedCableNodeWidth,
} from "@/features/diagram/spliceRowLayout";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import {
  effectiveSpliceLaneSep,
  spliceMidXFromRowOffset,
  spliceRoutingSpan,
} from "@/features/canvas/edges/spliceEdgeRouting";
import {
  buildLayoutRuleContext,
  checkLayoutRule,
  resolveFeasibleImportLayout,
} from "@/features/diagram/layoutRules";
import { runWithLayoutExpansion } from "@/features/diagram/layoutExpansion";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

const examples = join(process.cwd(), "docs/reference/examples");
const legacyExamples = join(examples, "old csv examples");

function productionCsvPath(file: string): string {
  const legacy = join(legacyExamples, file);
  try {
    readFileSync(legacy);
    return legacy;
  } catch {
    return join(examples, file);
  }
}

describe("importLayoutWidthForGraph", () => {
  it("11400S: lane-driven width exceeds row-only floor and supports 24px stride", () => {
    const csv = readFileSync(productionCsvPath("SP-I-15_11400S.csv"), "utf8");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const expandedLanes = activeSpliceLaneCount(graph, false);
    const collapsedLanes = activeSpliceLaneCount(graph, true);
    expect(expandedLanes).toBe(314);
    expect(collapsedLanes).toBeLessThan(expandedLanes);

    for (const collapse of [false, true] as const) {
      const laneCount = activeSpliceLaneCount(graph, collapse);
      const { visualCables } = buildVisualCablesForLayout(graph);
      const hidden = collapse
        ? collapsedPairIdsFromButtSplices(
            resolveFullButtSpliceVisuals(
              visualCables,
              detectFullButtSpliceTubes(graph, visualCables),
            ).map((r) => r.tube),
          )
        : undefined;
      const rowOffsets = connectionRowOffsets(
        graph,
        visualCables,
        hidden,
      );
      const maxTubes = Math.max(1, ...visualCables.map((vc) => vc.tubes.length));
      const nodeWidth = estimatedCableNodeWidth(maxTubes);
      const margin = CABLE_LAYOUT.leftX;
      const maxRowOffset = maxConnectionRowOffset(rowOffsets);
      const minCenterGap = minCenterGapForRowSpan(maxRowOffset, laneCount);
      const minWidth = 2 * margin + 2 * nodeWidth + minCenterGap;

      const width = importLayoutWidthForGraph(graph, { collapse });
      expect(width).toBeGreaterThanOrEqual(minWidth);

      const rowIndex = connectionRowIndexMap(graph, visualCables);
      const placement = computeCanvasPlacement(
        graph, visualCables, rowIndex,
      );
      const bounds = computeCableXBounds(visualCables, placement, width);
      const centerGap = bounds.rightX - bounds.leftX - nodeWidth;
      const sourceX = bounds.leftX + nodeWidth;
      const targetX = bounds.rightX;
      const routingSpan = spliceRoutingSpan(sourceX, targetX);
      expect(routingSpan).toBeGreaterThanOrEqual(maxRowOffset - 1);
      const stride = effectiveSpliceLaneSep(sourceX, targetX, laneCount);
      expect(stride).toBeGreaterThanOrEqual(SPLICE_LANE_SEP - 0.01);
      expect(centerGap).toBeGreaterThanOrEqual(minCenterGap - 1);

      const mids = [...rowOffsets.values()].map((offset) =>
        spliceMidXFromRowOffset(sourceX, targetX, offset, maxRowOffset),
      );
      expect(new Set(mids.map((x) => Math.round(x))).size).toBe(mids.length);
    }
  });

  it("re-import refreshColumnX replaces stale narrow X with wide column placement", () => {
    const csv = readFileSync(
      join(legacyExamples, "CSV Splice Detail Example #2.csv"),
      "utf8",
    );
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const width = importLayoutWidthForGraph(graph);
    const auto = buildReactFlowGraph(graph, undefined, width);
    const wideRightX = Math.max(
      ...auto.nodes
        .filter((n) => n.type === "cable")
        .map((n) => n.position.x),
    );

    const stalePositions = Object.fromEntries(
      auto.nodes.map((n) => [n.id, { x: CABLE_LAYOUT.rightX, y: n.position.y }]),
    );

    const refreshed = buildReactFlowGraph(
      graph,
      { reportKey: "test", positions: stalePositions },
      width,
      { refreshColumnX: true },
    );

    for (const node of refreshed.nodes) {
      if (node.type !== "cable") continue;
      const autoNode = auto.nodes.find((n) => n.id === node.id)!;
      expect(node.position.x).toBe(autoNode.position.x);
      expect(node.position.x).not.toBe(CABLE_LAYOUT.rightX);
    }
    expect(
      Math.max(
        ...refreshed.nodes
          .filter((n) => n.type === "cable")
          .map((n) => n.position.x),
      ),
    ).toBe(wideRightX);
  });

  it("11400S: width is identical with collapse on/off (toggle is width-stable)", () => {
    const csv = readFileSync(productionCsvPath("SP-I-15_11400S.csv"), "utf8");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const expanded = importLayoutWidthForGraph(graph, { collapse: false });
    const collapsed = importLayoutWidthForGraph(graph, { collapse: true });
    expect(collapsed).toBe(expanded);
  });

  it("fills viewport width when stage is wider than content minimum", () => {
    const csv = readFileSync(
      join(legacyExamples, "CSV Splice Detail Example #2.csv"),
      "utf8",
    );
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const minWidth = minLayoutWidthForGraph(graph);
    const stageWidth = minWidth + 480;
    const viewportWidth = Math.max(stageInnerWidth(stageWidth), minWidth);

    expect(importLayoutWidthForGraph(graph, { stageWidth })).toBe(viewportWidth);
  });

  it("content minimum wins when stage is narrower than routing needs", () => {
    const csv = readFileSync(
      join(legacyExamples, "CSV Splice Detail Example #2.csv"),
      "utf8",
    );
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const minWidth = minLayoutWidthForGraph(graph);

    expect(importLayoutWidthForGraph(graph, { stageWidth: 400 })).toBe(
      minWidth,
    );
  });

  it("layoutWidthForViewport preserves user outward drag expansion", () => {
    const csv = readFileSync(
      join(legacyExamples, "CSV Splice Detail Example #2.csv"),
      "utf8",
    );
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const minWidth = minLayoutWidthForGraph(graph);
    const stageWidth = minWidth + 200;
    const userExpanded = stageWidth + 600;
    const viewportWidth = Math.max(stageInnerWidth(stageWidth), minWidth);

    expect(
      layoutWidthForViewport(graph, stageWidth, userExpanded),
    ).toBe(userExpanded);
    expect(
      layoutWidthForViewport(graph, stageWidth, minWidth),
    ).toBe(viewportWidth);
  });

  it("applyLayoutOverrides refreshColumnX keeps saved Y only", () => {
    const auto = {
      "cable-a": { x: 24, y: 100 },
      "cable-b": { x: 9000, y: 200 },
    };
    const merged = applyLayoutOverrides(
      auto,
      {
        reportKey: "test",
        positions: {
          "cable-a": { x: 500, y: 150 },
          "cable-b": { x: 600, y: 250 },
        },
      },
      { refreshColumnX: true },
    );
    expect(merged["cable-a"]).toEqual({ x: 24, y: 150 });
    expect(merged["cable-b"]).toEqual({ x: 9000, y: 250 });
  });

  const spiFeasibilityTest = runKnownIssuesTests() ? it : it.skip;
  spiFeasibilityTest(
    "resolveFeasibleImportLayout widens busy SPI-215 until strict EDGE rules pass (KI-003)",
    () => {
    const csv = readFileSync(join(examples, "Left-SPI-215_I-80.csv"), "utf8");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const baseWidth = importLayoutWidthForGraph(graph, { stageWidth: 1920 });
    const resolved = resolveFeasibleImportLayout(graph, { stageWidth: 1920 });
    expect(resolved.layoutWidth).toBeGreaterThanOrEqual(baseWidth);

    const ctx = runWithLayoutExpansion(resolved.expansion, () =>
      buildLayoutRuleContext(graph, resolved.layoutWidth, undefined, {
        skipFeasibility: true,
        stageWidth: 1920,
      }),
    );
    for (const id of ["SDC-ROUTE-004-A", "SDC-ROUTE-003-B", "SDC-ROUTE-003-C"] as const) {
      const result = checkLayoutRule(id, ctx);
      expect(result.ok, result.detail).toBe(true);
    }
  });
});
