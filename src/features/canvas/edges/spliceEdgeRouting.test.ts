import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FIBER_ROW_PITCH, MIN_HORIZONTAL_INSET_FLOOR, MIN_SPLICE_HORIZONTAL_INSET, SPLICE_HANDLE_OVERHANG, SPLICE_ROUTING_END_MARGIN, fiberRowPrefixWidth, CABLE_LAYOUT } from "@/features/diagram/cableLayoutMetrics";
import { formattedCircuitTagWidth } from "@/features/diagram/cableLabels";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { computeCableBreakout } from "@/features/diagram/cableBreakoutGeometry";
import { TIA_12_COLORS } from "@/features/diagram/colorCode";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import type { SplicePair } from "@/types/splice";

import {
  assignSpliceMidXLanes,
  assignSpliceRoutingLanes,
  assignSpliceRoutingLanesFromHandleEntries,
  buildDemarcatedSplicePaths,
  buildOrthogonalSplicePath,
  buildButtSplicePath,
  buildSpliceHandleEntries,
  buildSplicePath,
  reconcileBufferTubeDotColumns,
  resolveFusionDotPosition,
  fusionDotLiesOnHorizontal,
  pathCornerClearanceFromFusionDot,
  FUSION_DOT_MIN_CORNER_CLEARANCE,
  clampMidXForMinHorizontalInset,
  defaultSideCircuitLabelSpan,
  effectiveRoutingLane,
  effectiveSpliceLaneSep,
  enforceMinHorizontalInset,
  horizontalInsetOkFromHandle,
  hvDemarcatedPathsCross,
  isCenterVerticalCrossingHandleRowLeadIn,
  inwardClearXBeforeVertical,
  targetClearXBeforeVertical,
  MAX_SPLICE_BENDS,
  minClearMidXForHandle,
  packMidXLanes,
  parseTubeHandleId,
  pickSpliceRouteTemplate,
  resolveButtSpliceMidX,
  routingLaneFromData,
  routingLaneFromEntries,
  reconcileBundleJogXForRender,
  routingMidXForRender,
  splicePathsAvoidHandleColumnVertical,
  spliceRouteSegments,
  sortSpliceRouteEntries,
  sourceHorizontalLeg,
  spliceMidX,
  spliceMidXFromRowOffset,
  spliceMidXInsetBounds,
  tubeHandlePosition,
} from "./spliceEdgeRouting";
import { SPLICE_LANE_SEP } from "@/features/diagram/cableLayoutMetrics";

describe("spliceEdgeRouting", () => {
  it("assigns distinct import routing lanes for a pair of edges", () => {
    const lanes = assignSpliceRoutingLanesFromHandleEntries([
      {
        id: "top",
        sourceNodeId: "cable-left",
        targetNodeId: "cable-right",
        sourceX: 100,
        sourceY: 100,
        targetX: 500,
        targetY: 400,
        fallbackLane: 0,
      },
      {
        id: "bottom",
        sourceNodeId: "cable-left",
        targetNodeId: "cable-right",
        sourceX: 100,
        sourceY: 140,
        targetX: 500,
        targetY: 420,
        fallbackLane: 1,
      },
    ]);
    const top = lanes.get("top")!;
    const bottom = lanes.get("bottom")!;
    expect(top.midX).not.toBe(bottom.midX);
  });

  it("inverts lanes when target is below source (right cable lower)", () => {
    const entries = [
      {
        id: "top",
        sourceNodeId: "a",
        targetNodeId: "b",
        sourceX: 100,
        sourceY: 100,
        targetX: 500,
        targetY: 400,
        fallbackLane: 0,
      },
      {
        id: "bottom",
        sourceNodeId: "a",
        targetNodeId: "b",
        sourceX: 100,
        sourceY: 140,
        targetX: 500,
        targetY: 420,
        fallbackLane: 1,
      },
    ];
    expect(routingLaneFromEntries(entries, "top")).toBe(1);
    expect(routingLaneFromEntries(entries, "bottom")).toBe(0);
  });

  it("keeps ascending lanes when target is above source", () => {
    const entries = [
      {
        id: "low",
        sourceNodeId: "a",
        targetNodeId: "b",
        sourceX: 100,
        sourceY: 200,
        targetX: 500,
        targetY: 100,
        fallbackLane: 0,
      },
      {
        id: "high",
        sourceNodeId: "a",
        targetNodeId: "b",
        sourceX: 100,
        sourceY: 240,
        targetX: 500,
        targetY: 120,
        fallbackLane: 1,
      },
    ];
    expect(routingLaneFromEntries(entries, "low")).toBe(0);
    expect(routingLaneFromEntries(entries, "high")).toBe(1);
  });

  it("keeps ascending lanes when source is dragged to the right of target", () => {
    const entries = [
      {
        id: "top",
        sourceNodeId: "a",
        targetNodeId: "b",
        sourceX: 900,
        sourceY: 100,
        targetX: 200,
        targetY: 400,
        fallbackLane: 0,
      },
      {
        id: "bottom",
        sourceNodeId: "a",
        targetNodeId: "b",
        sourceX: 900,
        sourceY: 140,
        targetX: 200,
        targetY: 420,
        fallbackLane: 1,
      },
    ];
    expect(routingLaneFromEntries(entries, "top")).toBe(0);
    expect(routingLaneFromEntries(entries, "bottom")).toBe(1);
  });

  it("sorts by sourceY then targetY", () => {
    const entries = [
      {
        id: "a",
        sourceNodeId: "s",
        targetNodeId: "t",
        sourceX: 100,
        sourceY: 120,
        targetX: 500,
        targetY: 300,
        fallbackLane: 1,
      },
      {
        id: "b",
        sourceNodeId: "s",
        targetNodeId: "t",
        sourceX: 100,
        sourceY: 120,
        targetX: 500,
        targetY: 180,
        fallbackLane: 0,
      },
    ];
    expect(sortSpliceRouteEntries(entries).map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("builds explicit orthogonal path", () => {
    const { path, labelX, labelY } = buildOrthogonalSplicePath(
      100,
      50,
      500,
      200,
      300,
    );
    expect(path).toBe("M 100,50 L 300,50 L 300,200 L 500,200");
    expect(labelX).toBe(300);
    expect(labelY).toBe(125);
  });

  it("demarcates left and right legs at the fusion dot", () => {
    const sideSpans = defaultSideCircuitLabelSpan();
    const { leftPath, rightPath, spliceX, spliceY } = buildDemarcatedSplicePaths(
      100,
      50,
      500,
      200,
      300,
      undefined,
      undefined,
      sideSpans,
      300,
    );
    const clearX = inwardClearXBeforeVertical(100, 300, 300, sideSpans);
    const dotX = 300 - FUSION_DOT_MIN_CORNER_CLEARANCE;
    expect(leftPath).toBe(
      dotX < clearX ? `M 100,50 L ${dotX},50` : `M 100,50 L ${clearX},50 L ${dotX},50`,
    );
    expect(rightPath).toBe(
      `M ${dotX},50 L ${clearX},50 L 300,50 L 300,125 L 300,200 L 500,200`,
    );
    expect(spliceX).toBe(dotX);
    expect(spliceY).toBe(50);
    expect(
      pathCornerClearanceFromFusionDot(leftPath, rightPath),
    ).toBeGreaterThanOrEqual(FUSION_DOT_MIN_CORNER_CLEARANCE);
  });

  it("resolveFusionDotPosition places dot on source horizontal row (DOT-001)", () => {
    const sideSpans = defaultSideCircuitLabelSpan();
    const pos = resolveFusionDotPosition(100, 50, 500, 200, 300, undefined, undefined, sideSpans, 300);
    expect(pos.spliceY).toBe(50);
    expect(pos.spliceX).toBe(300 - FUSION_DOT_MIN_CORNER_CLEARANCE);
    const segments = spliceRouteSegments(100, 50, 500, 200, 300, undefined, undefined, sideSpans, 300);
    expect(fusionDotLiesOnHorizontal(pos.spliceX, pos.spliceY, segments)).toBe(true);
  });

  it("buildSplicePath keeps fusion dot at least 48px from leg corners (DOT-003)", () => {
    const sideSpans = defaultSideCircuitLabelSpan();
    const built = buildSplicePath(100, 50, 500, 200, 300, 280, undefined, sideSpans, 300);
    expect(
      pathCornerClearanceFromFusionDot(built.leftPath, built.rightPath),
    ).toBeGreaterThanOrEqual(FUSION_DOT_MIN_CORNER_CLEARANCE);
  });

  it("reconcileBufferTubeDotColumns shares one clearance-aware column per tube (DOT-002)", () => {
    const sourceX = 100;
    const targetX = 1100;
    const bundleKey = "vc-left|BL|vc-right";
    const tubeGroupKey = "vc-left|BL";
    const entries = [
      {
        id: "a",
        sourceX,
        sourceY: 100,
        targetX,
        targetY: 400,
        sourceTubeDotGroupKey: tubeGroupKey,
      },
      {
        id: "b",
        sourceX,
        sourceY: 124,
        targetX,
        targetY: 424,
        sourceTubeDotGroupKey: tubeGroupKey,
      },
    ];
    const lanes = assignSpliceRoutingLanes(
      entries.map((e, i) => ({
        ...e,
        rowOffset: i * 24,
        tubeBundleKey: bundleKey,
      })),
    );
    const columns = reconcileBufferTubeDotColumns(entries, lanes, 600);
    const shared = columns.get("a");
    expect(shared).toBeDefined();
    expect(columns.get("b")).toBe(shared);
  });

  it("routes source-side gap horizontals on sourceHorizY offset track", () => {
    const sourceX = 250;
    const sourceY = 100;
    const midX = 420;
    const sideSpans = defaultSideCircuitLabelSpan();
    const { leftPath, spliceX } = buildDemarcatedSplicePaths(
      sourceX,
      sourceY,
      900,
      400,
      midX,
      undefined,
      { sourceHorizY: 124 },
      sideSpans,
      550,
    );
    const clearX = inwardClearXBeforeVertical(
      sourceX,
      midX,
      550,
      sideSpans,
    );
    expect(leftPath).toMatch(new RegExp(`^M ${sourceX},${sourceY} L ${clearX},${sourceY}`));
    expect(leftPath).toContain(`,124`);
    expect(leftPath).toContain(`L ${spliceX},124`);
    expect(spliceX).toBeLessThanOrEqual(midX - FUSION_DOT_MIN_CORNER_CLEARANCE);
    expect(spliceX).toBeLessThan(midX);
  });

  it("uses OS span for clearX when side labels are wide", () => {
    const sideSpans = { left: 220, right: 220 };
    const sourceX = 250;
    const midX = 900;
    const minClear = minClearMidXForHandle(
      sourceX,
      550,
      sideSpans,
      0,
      MIN_SPLICE_HORIZONTAL_INSET,
      true,
    );
    const clearX = inwardClearXBeforeVertical(
      sourceX,
      midX,
      550,
      sideSpans,
    );
    expect(clearX).toBeGreaterThan(sourceX + MIN_SPLICE_HORIZONTAL_INSET);
    expect(clearX).toBeGreaterThanOrEqual(minClear - 0.01);
    expect(clearX).toBeLessThanOrEqual(midX + 0.01);
  });

  it("routes target-side gap horizontals on targetHorizY offset track", () => {
    const targetX = 900;
    const targetY = 400;
    const midX = 420;
    const sideSpans = defaultSideCircuitLabelSpan();
    const { rightPath } = buildDemarcatedSplicePaths(
      250,
      100,
      targetX,
      targetY,
      midX,
      undefined,
      { targetHorizY: 376 },
      sideSpans,
      550,
    );
    const clearX = targetClearXBeforeVertical(targetX, midX, 550, sideSpans);
    expect(rightPath).toContain(`L ${midX},376`);
    expect(rightPath).toContain(`L ${clearX},376`);
    expect(rightPath).toContain(`L ${targetX},${targetY}`);
    expect(rightPath).not.toContain(`L ${midX},${targetY}`);
  });

  it("routingMidXForRender keeps distinct packed lanes inside the inset band", () => {
    const sideSpans = { left: 180, right: 180 };
    const sourceX = 250;
    const targetX = 900;
    const centerX = 550;
    const tagWidth = formattedCircuitTagWidth("(CH 2305) YL");
    const midA = 520;
    const midB = 544;
    expect(
      routingMidXForRender(
        midA,
        sourceX,
        targetX,
        centerX,
        sideSpans,
        tagWidth,
        tagWidth,
      ),
    ).toBe(midA);
    expect(
      routingMidXForRender(
        midB,
        sourceX,
        targetX,
        centerX,
        sideSpans,
        tagWidth,
        tagWidth,
      ),
    ).toBe(midB);
  });

  it("distinct midX lanes use separate center verticals", () => {
    const sideSpans = defaultSideCircuitLabelSpan();
    const midA = 380;
    const midB = 404;
    const pathA = buildDemarcatedSplicePaths(
      250,
      100,
      900,
      400,
      midA,
      undefined,
      undefined,
      sideSpans,
      550,
    );
    const pathB = buildDemarcatedSplicePaths(
      250,
      148,
      900,
      448,
      midB,
      undefined,
      undefined,
      sideSpans,
      550,
    );
    expect(pathA.leftPath).toContain(`L ${pathA.spliceX},100`);
    expect(pathB.leftPath).toContain(`L ${pathB.spliceX},148`);
    expect(pathA.spliceX).toBeLessThanOrEqual(midA - FUSION_DOT_MIN_CORNER_CLEARANCE);
    expect(pathB.spliceX).toBeLessThanOrEqual(midB - FUSION_DOT_MIN_CORNER_CLEARANCE);
  });

  it("spliceRouteSegments match demarcated paths (no vertical at handles)", () => {
    const sideSpans = { left: 180, right: 180 };
    const sourceX = 120;
    const sourceY = 80;
    const targetX = 880;
    const targetY = 320;
    const midX = 500;
    const sideHoriz = { sourceHorizY: 104, targetHorizY: 296 };
    expect(
      splicePathsAvoidHandleColumnVertical(
        sourceX,
        sourceY,
        targetX,
        targetY,
        midX,
        undefined,
        sideHoriz,
        sideSpans,
        500,
      ),
    ).toBe(true);
    const segs = spliceRouteSegments(
      sourceX,
      sourceY,
      targetX,
      targetY,
      midX,
      undefined,
      sideHoriz,
      sideSpans,
      500,
    );
    for (const seg of segs) {
      if (seg.kind !== "v") continue;
      expect(Math.abs(seg.x - sourceX)).toBeGreaterThan(0.01);
      expect(Math.abs(seg.x - targetX)).toBeGreaterThan(0.01);
    }
  });

  it("buildSplicePath uses straight template when Y matches (0 bends)", () => {
    const result = buildSplicePath(100, 50, 500, 50, 300);
    expect(result.template).toBe("straight");
    expect(result.bendCount).toBe(0);
    expect(result.spliceY).toBe(50);
  });

  it("buildSplicePath uses same_side template for same column (2 bends)", () => {
    const sideSpans = defaultSideCircuitLabelSpan();
    const handleX = 200;
    const midX = minClearMidXForHandle(handleX, 350, sideSpans);
    const result = buildSplicePath(handleX, 100, handleX, 400, midX);
    expect(result.template).toBe("same_side");
    expect(result.bendCount).toBeLessThanOrEqual(MAX_SPLICE_BENDS);
    expect(result.leftPath).toContain(`L ${result.spliceX},100`);
    expect(result.spliceX).toBeLessThanOrEqual(midX - FUSION_DOT_MIN_CORNER_CLEARANCE);
    expect(
      horizontalInsetOkFromHandle(midX, handleX, 350, sideSpans),
    ).toBe(true);
  });

  it("buildSplicePath uses hv_demarcated with 2 bends cross-side", () => {
    const result = buildSplicePath(100, 50, 500, 200, 300);
    expect(result.template).toBe("hv_demarcated");
    expect(result.bendCount).toBeLessThanOrEqual(MAX_SPLICE_BENDS);
  });

  it("same-column paths detour toward center after OS column", () => {
    const sideSpans = defaultSideCircuitLabelSpan();
    const handleX = 200;
    const midX = minClearMidXForHandle(handleX, 350, sideSpans);
    const result = buildSplicePath(handleX, 100, handleX, 400, midX);
    expect(result.template).toBe("same_side");
    expect(result.bendCount).toBeLessThanOrEqual(MAX_SPLICE_BENDS);
    expect(result.leftPath).toMatch(
      new RegExp(`^M ${handleX},100 L ${result.spliceX},100$`),
    );
    expect(result.rightPath).toContain(`L ${midX},`);
  });

  it("clampMidXForMinHorizontalInset enforces OS span + jog on cross-side paths", () => {
    const sourceX = 100;
    const targetX = 500;
    const sideSpans = { left: 120, right: 140 };
    const centerX = 300;
    const clamped = clampMidXForMinHorizontalInset(
      116,
      sourceX,
      targetX,
      centerX,
      sideSpans,
    );
    expect(
      horizontalInsetOkFromHandle(clamped, sourceX, centerX, sideSpans),
    ).toBe(true);
    expect(
      horizontalInsetOkFromHandle(clamped, targetX, centerX, sideSpans),
    ).toBe(true);
    const bounds = spliceMidXInsetBounds(
      sourceX,
      targetX,
      centerX,
      sideSpans,
    );
    expect(clamped).toBeGreaterThanOrEqual(bounds.lo);
    expect(clamped).toBeLessThanOrEqual(bounds.hi);
  });

  it("enforceMinHorizontalInset keeps OS clearance when inset band is infeasible", () => {
    const sourceX = 100;
    const targetX = 500;
    const sideSpans = { left: 120, right: 140 };
    const centerX = 300;
    const enforced = clampMidXForMinHorizontalInset(
      116,
      sourceX,
      targetX,
      centerX,
      sideSpans,
    );
    expect(
      horizontalInsetOkFromHandle(
        enforced,
        sourceX,
        centerX,
        sideSpans,
        MIN_HORIZONTAL_INSET_FLOOR,
      ),
    ).toBe(true);
    expect(
      horizontalInsetOkFromHandle(
        enforced,
        targetX,
        centerX,
        sideSpans,
        MIN_HORIZONTAL_INSET_FLOOR,
      ),
    ).toBe(true);
    expect(enforced).toBeGreaterThan(sourceX + sideSpans.left - fiberRowPrefixWidth());
  });

  it("enforceMinHorizontalInset keeps column clearance when routing margin band is empty", () => {
    const handleX = 300;
    const sideSpans = defaultSideCircuitLabelSpan();
    const centerX = handleX;
    const enforced = clampMidXForMinHorizontalInset(
      handleX + MIN_SPLICE_HORIZONTAL_INSET,
      handleX,
      handleX,
      centerX,
      sideSpans,
      MIN_SPLICE_HORIZONTAL_INSET,
      0,
      0,
      true,
      true,
    );
    expect(
      horizontalInsetOkFromHandle(
        enforced,
        handleX,
        centerX,
        sideSpans,
        MIN_SPLICE_HORIZONTAL_INSET,
        0,
        true,
      ),
    ).toBe(true);
    expect(enforced).toBeGreaterThan(handleX + MIN_SPLICE_HORIZONTAL_INSET - 1);
  });

  it("regression: infeasible 60px inset band never falls back to routing margin only", () => {
    const columnX = 300;
    const centerX = 900;
    const sideSpans = { left: 220, right: 220 };
    const badMidX = columnX + SPLICE_ROUTING_END_MARGIN;
    const enforced = enforceMinHorizontalInset(
      badMidX,
      columnX,
      columnX,
      centerX,
      sideSpans,
      MIN_SPLICE_HORIZONTAL_INSET,
      0,
      0,
      true,
      true,
    );
    expect(enforced).toBeGreaterThan(badMidX + 40);
    expect(
      horizontalInsetOkFromHandle(
        enforced,
        columnX,
        centerX,
        sideSpans,
        MIN_HORIZONTAL_INSET_FLOOR,
        0,
        true,
      ),
    ).toBe(true);
    expect(sourceHorizontalLeg(enforced, columnX)).toBeGreaterThanOrEqual(
      MIN_HORIZONTAL_INSET_FLOOR - 0.01,
    );
  });

  it("pickSpliceRouteTemplate identifies route shapes", () => {
    expect(pickSpliceRouteTemplate(100, 50, 500, 50)).toBe("straight");
    expect(pickSpliceRouteTemplate(200, 100, 200, 400)).toBe("same_side");
    expect(pickSpliceRouteTemplate(100, 50, 500, 200)).toBe("hv_demarcated");
  });

  it("staggers midX by routing lane toward target", () => {
    expect(spliceMidX(100, 500, 0, 2)).toBeLessThan(spliceMidX(100, 500, 1, 2));
    expect(spliceMidX(900, 200, 0, 2)).toBeGreaterThan(spliceMidX(900, 200, 1, 2));
  });

  it("inverts row-offset midX when target is below source", () => {
    const sourceX = 100;
    const targetX = 500;
    const maxRowOffset = 48;
    const top = spliceMidXFromRowOffset(
      sourceX,
      targetX,
      0,
      maxRowOffset,
      100,
      400,
    );
    const bottom = spliceMidXFromRowOffset(
      sourceX,
      targetX,
      maxRowOffset,
      maxRowOffset,
      140,
      420,
    );
    expect(top).toBeGreaterThan(bottom);
    expect(
      hvDemarcatedPathsCross(
        sourceX,
        100,
        targetX,
        400,
        top,
        sourceX,
        140,
        targetX,
        420,
        bottom,
      ),
    ).toBe(false);
  });

  it("keeps ascending row-offset midX when target is above source", () => {
    const sourceX = 100;
    const targetX = 500;
    const maxRowOffset = 48;
    const top = spliceMidXFromRowOffset(
      sourceX,
      targetX,
      0,
      maxRowOffset,
      200,
      100,
    );
    const bottom = spliceMidXFromRowOffset(
      sourceX,
      targetX,
      maxRowOffset,
      maxRowOffset,
      240,
      120,
    );
    expect(top).toBeLessThan(bottom);
    expect(
      hvDemarcatedPathsCross(
        sourceX,
        200,
        targetX,
        100,
        top,
        sourceX,
        240,
        targetX,
        120,
        bottom,
      ),
    ).toBe(false);
  });

  it("allows center vertical crossing handle-row lead-in under two-bend routing", () => {
    const sourceX = 100;
    const targetX = 500;
    const topMidX = 200;
    const bottomMidX = 350;
    expect(
      hvDemarcatedPathsCross(
        sourceX,
        100,
        targetX,
        400,
        topMidX,
        sourceX,
        140,
        targetX,
        420,
        bottomMidX,
      ),
    ).toBe(false);
  });

  it("effectiveRoutingLane inverts only for downward splices", () => {
    expect(effectiveRoutingLane(0, 2, 100, 100, 500, 400)).toBe(1);
    expect(effectiveRoutingLane(1, 2, 100, 140, 500, 420)).toBe(0);
    expect(effectiveRoutingLane(0, 2, 100, 200, 500, 100)).toBe(0);
    expect(effectiveRoutingLane(0, 2, 900, 100, 200, 400)).toBe(0);
  });

  it("fills center with proportional row-offset lanes (no overlap)", () => {
    const laneCount = 60;
    const sourceX = 300;
    const targetX = 300 + (laneCount - 1) * SPLICE_LANE_SEP + 32;
    const maxRowOffset = (laneCount - 1) * SPLICE_LANE_SEP;
    const mids = Array.from({ length: laneCount }, (_, lane) =>
      spliceMidXFromRowOffset(
        sourceX,
        targetX,
        lane * SPLICE_LANE_SEP,
        maxRowOffset,
      ),
    );
    expect(new Set(mids.map((x) => Math.round(x))).size).toBe(laneCount);
    expect(Math.min(...mids)).toBeGreaterThan(sourceX);
    expect(Math.max(...mids)).toBeLessThan(targetX);
  });

  it("effectiveSpliceLaneSep distributes evenly when gap allows", () => {
    const laneCount = 4;
    const sourceX = 100;
    const targetX = 500;
    const sep = effectiveSpliceLaneSep(sourceX, targetX, laneCount);
    expect(sep).toBeGreaterThanOrEqual(SPLICE_LANE_SEP);
  });

  it("packMidXLanes separates crossover pairs that share ideal midX", () => {
    const sourceX = 100;
    const targetX = 500;
    const maxRowOffset = 72;
    const candidates = [
      {
        id: "bl",
        sourceX,
        sourceY: 100,
        targetX,
        targetY: 400,
        rowOffset: 0,
      },
      {
        id: "or",
        sourceX,
        sourceY: 124,
        targetX,
        targetY: 376,
        rowOffset: 24,
      },
      {
        id: "gr",
        sourceX,
        sourceY: 148,
        targetX,
        targetY: 160,
        rowOffset: 48,
      },
      {
        id: "br",
        sourceX,
        sourceY: 172,
        targetX,
        targetY: 136,
        rowOffset: maxRowOffset,
      },
    ];

    const ideals = candidates.map((candidate) =>
      spliceMidXFromRowOffset(
        sourceX,
        targetX,
        candidate.rowOffset,
        maxRowOffset,
        candidate.sourceY,
        candidate.targetY,
      ),
    );
    expect(new Set(ideals.map((x) => Math.round(x))).size).toBeLessThan(
      candidates.length,
    );

    const packed = packMidXLanes(candidates);
    const mids = candidates.map((candidate) => packed.get(candidate.id)!);
    expect(new Set(mids.map((x) => Math.round(x))).size).toBe(
      candidates.length,
    );
    const sorted = [...mids].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(
        SPLICE_LANE_SEP - 0.01,
      );
    }
  });

  it("keeps ten-fiber tube bundle midX lanes in row-offset color order", () => {
    const sourceX = 120;
    const targetX = 1080;
    const bundleKey = "vc-left|BL|vc-right";
    const colors = [
      "bl",
      "or",
      "gr",
      "br",
      "sl",
      "wh",
      "bk",
      "rs",
      "yl",
      "vi",
    ];
    const candidates = colors.map((id, index) => {
      const sourceY = 100 + index * FIBER_ROW_PITCH;
      const targetY = 400 + index * FIBER_ROW_PITCH;
      return {
        id,
        sourceX,
        sourceY,
        targetX,
        targetY,
        rowOffset: index * FIBER_ROW_PITCH,
        tubeBundleKey: bundleKey,
      };
    });

    const packed = assignSpliceRoutingLanes(candidates);
    const mids = colors.map((id) => packed.get(id)!.midX);

    // Downward splice: top row (BL) gets outermost (largest) midX.
    expect(mids[0]!).toBeGreaterThan(mids[colors.length - 1]!);
    for (let i = 1; i < mids.length; i++) {
      expect(mids[i - 1]! - mids[i]!).toBeGreaterThanOrEqual(
        SPLICE_LANE_SEP - 0.01,
      );
    }

    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const a = candidates[i]!;
        const b = candidates[j]!;
        expect(
          hvDemarcatedPathsCross(
            sourceX,
            a.sourceY,
            targetX,
            a.targetY,
            packed.get(a.id)!.midX,
            sourceX,
            b.sourceY,
            targetX,
            b.targetY,
            packed.get(b.id)!.midX,
          ),
        ).toBe(false);
      }
    }

    const trunkXs = colors
      .map((id) => packed.get(id)!.jogX)
      .filter((x): x is number => x !== undefined);
    expect(new Set(trunkXs).size).toBeLessThanOrEqual(1);
    const blLane = packed.get("bl")!;
    const { leftPath: blPath, rightPath: blRight } = buildDemarcatedSplicePaths(
      sourceX,
      candidates[0]!.sourceY,
      targetX,
      candidates[0]!.targetY,
      blLane.midX,
      blLane.jogX,
    );
    expect(blPath).toContain(`${blLane.jogX},${candidates[0]!.sourceY}`);
    expect(blRight).toContain(`${blLane.midX},${candidates[0]!.sourceY}`);
  });

  it("assignSpliceRoutingLanes spaces tube bundle lanes and shares jogX trunk", () => {
    const sourceX = 500;
    const targetX = 100;
    const bundleKey = "vc-right|BL|vc-left";
    const candidates = [
      {
        id: "bl",
        sourceX,
        sourceY: 100,
        targetX,
        targetY: 400,
        rowOffset: 0,
        tubeBundleKey: bundleKey,
      },
      {
        id: "or",
        sourceX,
        sourceY: 124,
        targetX,
        targetY: 376,
        rowOffset: 24,
        tubeBundleKey: bundleKey,
      },
    ];
    const packed = assignSpliceRoutingLanes(candidates);
    const bl = packed.get("bl")!;
    const or = packed.get("or")!;
    expect(Math.abs(or.midX - bl.midX)).toBeGreaterThanOrEqual(SPLICE_LANE_SEP - 0.01);
    const outerLane = or.jogX !== undefined ? or : bl;
    const outerMeta = or.jogX !== undefined ? candidates[1]! : candidates[0]!;
    expect(outerLane.jogX).toBeDefined();
    expect(bl.jogX ?? outerLane.jogX).toBe(or.jogX ?? outerLane.jogX);
    const { leftPath: outerPath, rightPath: outerRight } = buildDemarcatedSplicePaths(
      sourceX,
      outerMeta.sourceY,
      targetX,
      outerMeta.targetY,
      outerLane.midX,
      outerLane.jogX,
    );
    expect(outerPath).toContain(`${outerLane.jogX},${outerMeta.sourceY}`);
    expect(outerRight).toContain(`${outerLane.midX},${outerMeta.sourceY}`);
  });

  it("anchors bundle trunk at the source side so fan-out has no loop-back", () => {
    // Left source going right: trunk should be the LEAST-inward midX (= min)
    // so the source-side H and the per-strand fan-out flow in the same
    // direction (no reverse-direction loop-back past target X).
    const sourceX = 100;
    const targetX = 1100;
    const bundleKey = "vc-left|BL|vc-right";
    const candidates = [
      {
        id: "a",
        sourceX,
        sourceY: 100,
        targetX,
        targetY: 400,
        rowOffset: 0,
        tubeBundleKey: bundleKey,
      },
      {
        id: "b",
        sourceX,
        sourceY: 124,
        targetX,
        targetY: 424,
        rowOffset: 24,
        tubeBundleKey: bundleKey,
      },
      {
        id: "c",
        sourceX,
        sourceY: 148,
        targetX,
        targetY: 448,
        rowOffset: 48,
        tubeBundleKey: bundleKey,
      },
      {
        id: "d",
        sourceX,
        sourceY: 172,
        targetX,
        targetY: 472,
        rowOffset: 72,
        tubeBundleKey: bundleKey,
      },
    ];
    const packed = assignSpliceRoutingLanes(candidates);
    const lanes = candidates.map((c) => packed.get(c.id)!);
    const mids = lanes.map((l) => l.midX);
    const minMid = Math.min(...mids);
    const trunkXs = lanes
      .map((l) => l.jogX)
      .filter((x): x is number => x !== undefined);
    // All strands sharing the bundle pin to the same trunk X.
    expect(new Set(trunkXs).size).toBe(1);
    // Trunk hugs the source side (= min midX for left source).
    expect(trunkXs[0]).toBe(minMid);
    // Fan-out direction matches source→target direction (right): each fan
    // segment goes from trunk (min) rightward to its own midX. No segment
    // ever crosses BACK to the left of the trunk.
    for (const lane of lanes) {
      expect(lane.midX).toBeGreaterThanOrEqual(minMid - 0.01);
    }
  });

  it("reconcileBundleJogXForRender drops trunk when clamped midX would backtrack", () => {
    const sourceX = 100;
    const centerX = 550;
    expect(reconcileBundleJogXForRender(350, 400, sourceX, centerX)).toBeUndefined();
    expect(reconcileBundleJogXForRender(450, 400, sourceX, centerX)).toBe(400);
  });

  it("buildDemarcatedSplicePaths skips reverse fan-out when jogX exceeds midX", () => {
    const sourceX = 100;
    const sourceY = 50;
    const targetX = 900;
    const targetY = 200;
    const midX = 350;
    const sideSpans = defaultSideCircuitLabelSpan();
    const { leftPath } = buildDemarcatedSplicePaths(
      sourceX,
      sourceY,
      targetX,
      targetY,
      midX,
      400,
      undefined,
      sideSpans,
      550,
    );
    expect(leftPath).not.toMatch(/L 400,50 L 350,50/);
    expect(leftPath).not.toContain("L 400,50");
  });

  it("render path uses reconciled jogX after midX inset clamp", () => {
    const sourceX = 250;
    const targetX = 900;
    const storedMidX = 820;
    const storedJogX = 760;
    const centerX = 550;
    const sideSpans = defaultSideCircuitLabelSpan();
    const renderMidX = routingMidXForRender(
      storedMidX,
      sourceX,
      targetX,
      centerX,
      sideSpans,
    );
    const renderJogX = reconcileBundleJogXForRender(
      renderMidX,
      storedJogX,
      sourceX,
      centerX,
    );
    const { leftPath } = buildDemarcatedSplicePaths(
      sourceX,
      100,
      targetX,
      400,
      renderMidX,
      renderJogX,
      undefined,
      sideSpans,
      centerX,
    );
    const sameYHorizs = leftPath.match(/L ([\d.]+),100/g) ?? [];
    const xs = sameYHorizs.map((token) =>
      Number(token.replace("L ", "").replace(",100", "")),
    );
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]! - xs[i - 1]!).toBeGreaterThan(-0.01);
    }
  });

  it("packs same-side loop bundle with crossing source bend on downward splices", () => {
    const columnX = 200;
    const bundleKey = "vc-left|BL|vc-left-lower";
    const colors = ["bl", "or", "gr", "br", "sl", "wh"];
    const candidates = colors.map((id, index) => ({
      id,
      sourceX: columnX,
      sourceY: 100 + index * FIBER_ROW_PITCH,
      targetX: columnX,
      targetY: 400 + index * FIBER_ROW_PITCH,
      rowOffset: index * FIBER_ROW_PITCH,
      tubeBundleKey: bundleKey,
    }));

    const packed = assignSpliceRoutingLanes(candidates, { left: 66, right: 120 });
    const bl = packed.get("bl")!;
    const wh = packed.get("wh")!;

    expect(bl.midX).toBeLessThan(wh.midX);
    expect(bl.jogX).toBeUndefined();
    expect(wh.jogX).toBeUndefined();

    const sideSpans = { left: 66, right: 120 };
    const centerX = 700;
    const blSegs = spliceRouteSegments(
      columnX,
      candidates[0]!.sourceY,
      columnX,
      candidates[0]!.targetY,
      bl.midX,
      undefined,
      undefined,
      sideSpans,
      centerX,
    );
    const whSegs = spliceRouteSegments(
      columnX,
      candidates[5]!.sourceY,
      columnX,
      candidates[5]!.targetY,
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
            candidates[5]!.sourceY,
          )
        ) {
          sourceBendCrosses = true;
        }
      }
    }
    expect(sourceBendCrosses).toBe(true);
  });

  it("packs same-side loop bundle with organized source bend on upward splices", () => {
    const columnX = 200;
    const bundleKey = "vc-left|BL|vc-left-upper";
    const colors = ["bl", "or", "gr", "br", "sl", "wh"];
    const candidates = colors.map((id, index) => ({
      id,
      sourceX: columnX,
      sourceY: 400 + index * FIBER_ROW_PITCH,
      targetX: columnX,
      targetY: 100 + index * FIBER_ROW_PITCH,
      rowOffset: index * FIBER_ROW_PITCH,
      tubeBundleKey: bundleKey,
    }));

    const packed = assignSpliceRoutingLanes(candidates, { left: 66, right: 120 });
    const bl = packed.get("bl")!;
    const wh = packed.get("wh")!;

    expect(bl.midX).toBeGreaterThan(wh.midX);
    expect(bl.jogX).toBeDefined();
    expect(bl.jogX).toBe(wh.midX);
    expect(wh.jogX).toBeUndefined();
    expect(
      hvDemarcatedPathsCross(
        columnX,
        candidates[0]!.sourceY,
        columnX,
        candidates[0]!.targetY,
        bl.midX,
        columnX,
        candidates[5]!.sourceY,
        columnX,
        candidates[5]!.targetY,
        wh.midX,
        bl.jogX,
        wh.jogX,
      ),
    ).toBe(false);
  });

  it("packMidXLanes separates same-side vertical lanes toward center", () => {
    const columnX = 200;
    const candidates = [
      {
        id: "a",
        sourceX: columnX,
        sourceY: 100,
        targetX: columnX,
        targetY: 400,
        rowOffset: 0,
      },
      {
        id: "b",
        sourceX: columnX,
        sourceY: 124,
        targetX: columnX,
        targetY: 420,
        rowOffset: 24,
      },
    ];
    const packed = packMidXLanes(candidates, SPLICE_LANE_SEP, 700, {
      left: 66,
      right: 120,
    });
    const top = packed.get("a")!;
    const bottom = packed.get("b")!;
    expect(top).toBeGreaterThan(columnX);
    expect(bottom).toBeGreaterThan(columnX);
    expect(top - bottom).toBeGreaterThanOrEqual(SPLICE_LANE_SEP - 0.01);
    expect(
      horizontalInsetOkFromHandle(top, columnX, 700, {
        left: 66,
        right: 120,
      }),
    ).toBe(true);
  });

  it("packs cross-side bundle at 24px sep on wide spans (no span-stretch)", () => {
    const sourceX = 100;
    const targetX = 1100;
    const candidates = [
      { id: "a", sourceX, sourceY: 100, targetX, targetY: 400, rowOffset: 0 },
      { id: "b", sourceX, sourceY: 124, targetX, targetY: 424, rowOffset: 24 },
      { id: "c", sourceX, sourceY: 148, targetX, targetY: 448, rowOffset: 48 },
      { id: "d", sourceX, sourceY: 172, targetX, targetY: 472, rowOffset: 72 },
    ];
    const packed = packMidXLanes(candidates);
    const mids = candidates.map((c) => packed.get(c.id)!);
    const sorted = [...mids].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i]! - sorted[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(SPLICE_LANE_SEP - 0.01);
      expect(gap).toBeLessThanOrEqual(SPLICE_LANE_SEP + 0.01);
    }
    const range = Math.max(...mids) - Math.min(...mids);
    expect(range).toBeLessThanOrEqual((candidates.length - 1) * SPLICE_LANE_SEP + 1);
  });

  it("spreads bundles across the routing span by global row offset", () => {
    // Two zones (different sourceX) with very different row-offset ranges:
    // - lowZone strands sit near the top of the global row order (small rowOffset)
    // - hiZone strands sit near the bottom (rowOffset close to global max)
    // After packing, the two bundles must land at clearly different X
    // positions so the entire center span gets used (not all crammed at the
    // band midpoint).
    const targetX = 1100;
    const globalMax = 1024;
    const candidates = [
      // Upward (sourceY > targetY) so spliceMidXFromRowOffset does NOT
      // invert, and low rowOffset → ideal near source, high → near target.
      { id: "lowA", sourceX: 100, sourceY: 400, targetX, targetY: 100, rowOffset: 0 },
      { id: "lowB", sourceX: 100, sourceY: 424, targetX, targetY: 124, rowOffset: 24 },
      { id: "hiA", sourceX: 220, sourceY: 1200, targetX, targetY: 900, rowOffset: globalMax },
      { id: "hiB", sourceX: 220, sourceY: 1224, targetX, targetY: 924, rowOffset: globalMax - 24 },
    ];
    const lanes = assignSpliceMidXLanes(candidates);
    const lowCenter = (lanes.get("lowA")! + lanes.get("lowB")!) / 2;
    const hiCenter = (lanes.get("hiA")! + lanes.get("hiB")!) / 2;
    // Low-row bundle anchors clearly source-ward of the high-row bundle.
    expect(hiCenter - lowCenter).toBeGreaterThan(200);
  });

  it("anchors cross-side bundle at the band midpoint (uses center, no loop-back)", () => {
    const sourceX = 100;
    const targetX = 1100;
    const candidates = [
      { id: "a", sourceX, sourceY: 100, targetX, targetY: 400, rowOffset: 0 },
      { id: "b", sourceX, sourceY: 124, targetX, targetY: 424, rowOffset: 24 },
      { id: "c", sourceX, sourceY: 148, targetX, targetY: 448, rowOffset: 48 },
      { id: "d", sourceX, sourceY: 172, targetX, targetY: 472, rowOffset: 72 },
    ];
    const packed = packMidXLanes(candidates);
    // No loop-back: with source on left + target on right, midX must stay
    // <= targetX so the verticals never overshoot and require a reverse-H.
    for (const c of candidates) {
      const midX = packed.get(c.id)!;
      expect(midX).toBeLessThanOrEqual(c.targetX);
    }
    // Bundle uses the MIDDLE of the inset-feasible band (not crammed against
    // either cable column). Tolerance accounts for clamp/even-span snap.
    const bounds = spliceMidXInsetBounds(
      sourceX,
      targetX,
      (sourceX + targetX) / 2,
      defaultSideCircuitLabelSpan(),
    );
    const bandCenter = (bounds.lo + bounds.hi) / 2;
    const mids = candidates.map((c) => packed.get(c.id)!);
    const bundleCenter = (Math.min(...mids) + Math.max(...mids)) / 2;
    expect(Math.abs(bundleCenter - bandCenter)).toBeLessThan(2);
  });

  it("deconflicts vertical legs across zones (different sourceX/targetX)", () => {
    // Two zones whose verticals would land at the same X with overlapping Y
    // ranges. Global pass must shift one of them by SPLICE_LANE_SEP.
    const candidates = [
      {
        id: "zoneA",
        sourceX: 100,
        sourceY: 100,
        targetX: 800,
        targetY: 400,
        rowOffset: 0,
      },
      {
        id: "zoneB",
        sourceX: 140,
        sourceY: 110,
        targetX: 820,
        targetY: 410,
        rowOffset: 0,
      },
    ];
    const lanes = assignSpliceRoutingLanes(candidates);
    const a = lanes.get("zoneA")!;
    const b = lanes.get("zoneB")!;
    expect(Math.abs(a.midX - b.midX)).toBeGreaterThanOrEqual(
      SPLICE_LANE_SEP - 0.01,
    );
  });

  it("assigns distinct midX across zones on same row Y (EDGE-004 two-bend)", () => {
    const candidates = [
      {
        id: "zoneA",
        sourceX: 100,
        sourceY: 200,
        targetX: 1100,
        targetY: 200,
        rowOffset: 0,
      },
      {
        id: "zoneB",
        sourceX: 200,
        sourceY: 200,
        targetX: 1000,
        targetY: 200,
        rowOffset: 0,
      },
    ];
    const lanes = assignSpliceRoutingLanes(candidates);
    const a = lanes.get("zoneA")!;
    const b = lanes.get("zoneB")!;
    expect(Math.abs(a.midX - b.midX)).toBeGreaterThan(SPLICE_LANE_SEP - 0.01);
  });

  it("assignSpliceMidXLanes keeps zones independent", () => {
    const lanes = assignSpliceMidXLanes([
      {
        id: "a",
        sourceX: 100,
        sourceY: 100,
        targetX: 500,
        targetY: 400,
        rowOffset: 0,
      },
      {
        id: "b",
        sourceX: 100,
        sourceY: 124,
        targetX: 500,
        targetY: 136,
        rowOffset: 24,
      },
      {
        id: "c",
        sourceX: 900,
        sourceY: 100,
        targetX: 500,
        targetY: 400,
        rowOffset: 0,
      },
    ]);
    expect(lanes.get("a")).toBeDefined();
    expect(lanes.get("b")).toBeDefined();
    expect(lanes.get("c")).toBeDefined();
    expect(Math.abs(lanes.get("a")! - lanes.get("c")!)).toBeGreaterThan(0);
  });
});

function syntheticFullButtSpliceGraph() {
  const pairs: SplicePair[] = TIA_12_COLORS.map((color, index) => ({
    id: `pair-${index}`,
    endpointA: {
      device: "DEV-A",
      cable: "CABLE-A",
      fiberNumber: index + 1,
      tubeColor: "BL",
      fiberColor: color.abbrev,
      csvColumn: "from",
    },
    endpointB: {
      device: "DEV-B",
      cable: "CABLE-B",
      fiberNumber: index + 1,
      tubeColor: "OR",
      fiberColor: color.abbrev,
      csvColumn: "to",
    },
  }));

  return buildConnectionGraph({
    header: {},
    pairs,
    cableAppearances: [
      {
        device: "DEV-A",
        cable: "CABLE-A",
        left: { from: 12, to: 0 },
        right: { from: 0, to: 0 },
      },
      {
        device: "DEV-B",
        cable: "CABLE-B",
        left: { from: 0, to: 0 },
        right: { from: 0, to: 12 },
      },
    ],
  });
}

describe("collapsed full butt splice tube routing", () => {
  it("parseTubeHandleId parses striped tube handles", () => {
    expect(parseTubeHandleId("tube-CABLE-A::from|BL-BK-out")).toEqual({
      legId: "CABLE-A::from",
      tubeColor: "BL-BK",
    });
  });

  it("tubeHandlePosition Y matches breakout tube.end.y", () => {
    const graph = syntheticFullButtSpliceGraph();
    const { visualCables } = buildVisualCablesForLayout(graph);
    const leftVc = visualCables.find((vc) => vc.side === "left")!;
    const geo = computeCableBreakout(
      leftVc.tubes,
      leftVc.side,
      FIBER_ROW_PITCH,
      CABLE_LAYOUT.headerH,
      CABLE_LAYOUT.tubeLabelH,
    );
    const tube = geo.tubes.find((t) => t.tubeColor === "BL")!;
    const pos = tubeHandlePosition(leftVc, "BL", { x: 0, y: 100 });
    expect(pos.y).toBeCloseTo(100 + tube.end.y, 5);
    expect(pos.y).toBeGreaterThan(100 + CABLE_LAYOUT.headerH);
  });

  it("tubeHandlePosition includes visualShiftY and stem overhang for collapsed tubes", () => {
    const graph = syntheticFullButtSpliceGraph();
    const { visualCables } = buildVisualCablesForLayout(graph);
    const leftVc = visualCables.find((vc) => vc.side === "left")!;
    const geo = computeCableBreakout(
      leftVc.tubes,
      leftVc.side,
      FIBER_ROW_PITCH,
      CABLE_LAYOUT.headerH,
      CABLE_LAYOUT.tubeLabelH,
    );
    const tube = geo.tubes.find((t) => t.tubeColor === "BL")!;
    const blTube = leftVc.tubes.find((t) => t.tubeColor === "BL")!;
    blTube!.visualShiftY = 12;

    const pos = tubeHandlePosition(leftVc, "BL", { x: 50, y: 200 });
    expect(pos.y).toBeCloseTo(200 + tube.end.y + 12, 5);
    expect(pos.x).toBeCloseTo(50 + geo.stemX + SPLICE_HANDLE_OVERHANG, 5);
  });

  it("buildSpliceHandleEntries resolves butt edges at tube center Y", () => {
    const graph = syntheticFullButtSpliceGraph();
    const { nodes, edges } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      collapseFullButtSplices: true,
    });
    const { visualCables } = buildVisualCablesForLayout(graph);
    const entries = buildSpliceHandleEntries(nodes, edges, visualCables);
    const butt = entries.find((e) => e.id.startsWith("butt-"));
    expect(butt).toBeDefined();
    expect(butt!.fullButtSplice).toBe(true);
    expect(butt!.sourceY).toBeGreaterThan(CABLE_LAYOUT.headerH);
    expect(butt!.targetY).toBeGreaterThan(CABLE_LAYOUT.headerH);
  });

  it("cross-side butt path keeps the target leg horizontal at targetY", () => {
    const sideSpans = defaultSideCircuitLabelSpan();
    const verticalX = resolveButtSpliceMidX(100, 500, 300, sideSpans);
    const result = buildButtSplicePath(100, 50, 500, 200, 999, sideSpans, 300);
    expect(result.rightPath).toBe(`M ${verticalX},200 L 500,200`);
    expect(result.spliceX).toBe(verticalX);
    expect(result.bendCount).toBeLessThanOrEqual(MAX_SPLICE_BENDS);
  });

  it("uses straight template when tube Y aligns within half pitch", () => {
    const result = buildButtSplicePath(100, 50, 500, 60, 300);
    expect(result.template).toBe("straight");
    expect(result.bendCount).toBe(0);
  });

  it("collapsed tube import routing uses at most two bends and no Y-track offsets", () => {
    const graph = syntheticFullButtSpliceGraph();
    const { nodes, edges } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      collapseFullButtSplices: true,
    });
    const buttEdge = edges.find((e) => e.id.startsWith("butt-"));
    expect(buttEdge).toBeDefined();
    const lane = routingLaneFromData(buttEdge!.data as Record<string, unknown>);
    expect(lane?.sourceHorizY).toBeUndefined();
    expect(lane?.targetHorizY).toBeUndefined();
    expect(lane?.jogX).toBeUndefined();

    const { visualCables } = buildVisualCablesForLayout(graph);
    const [entry] = buildSpliceHandleEntries(nodes, edges, visualCables).filter(
      (e) => e.id === buttEdge!.id,
    );
    const { bendCount } = buildButtSplicePath(
      entry!.sourceX,
      entry!.sourceY,
      entry!.targetX,
      entry!.targetY,
      lane!.midX,
    );
    expect(bendCount).toBeLessThanOrEqual(MAX_SPLICE_BENDS);
  });

  it("300N_MAIN collapsed tubes keep midX between handle columns", () => {
    const examplesDir = join(process.cwd(), "docs/reference/examples");
    const legacyDir = join(examplesDir, "old csv examples");
    let csvPath = join(examplesDir, "300N_MAIN.csv");
    try {
      readFileSync(csvPath);
    } catch {
      csvPath = join(legacyDir, "300N_MAIN.csv");
    }
    const graph = buildConnectionGraph(
      parseBentleyCsv(readFileSync(csvPath, "utf8")),
    );
    const { nodes, edges } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      collapseFullButtSplices: true,
    });
    const { visualCables } = buildVisualCablesForLayout(graph);
    const entries = buildSpliceHandleEntries(nodes, edges, visualCables);

    for (const edge of edges.filter((e) => e.id.startsWith("butt-"))) {
      const entry = entries.find((en) => en.id === edge.id)!;
      const lane = routingLaneFromData(edge.data as Record<string, unknown>)!;
      const crossSide =
        Math.abs(entry.sourceX - entry.targetX) > SPLICE_ROUTING_END_MARGIN;
      if (crossSide) {
        expect(Number.isFinite(lane.midX)).toBe(true);
      }
      const result = buildButtSplicePath(
        entry.sourceX,
        entry.sourceY,
        entry.targetX,
        entry.targetY,
        lane.midX,
      );
      expect(result.bendCount).toBeLessThanOrEqual(MAX_SPLICE_BENDS);
    }
  });
});
