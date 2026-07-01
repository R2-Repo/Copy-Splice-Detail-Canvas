import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { parseDiagramConfig } from "@/features/export/parseDiagramConfig";
import {
  connectionGraphFromConfig,
  layoutOverridesFromConfig,
} from "@/features/export/restoreDiagramConfig";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import {
  deriveLayoutMode,
} from "@/features/layoutSearch/layoutCandidate";
import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";
import { toLayoutCandidate } from "@/features/layoutSearch/verifyLayoutCandidate";
import { resolveReferenceCsvPath } from "@/testHelpers/layoutContractCsvPaths";
import { loadSearchCandidateSnapshot } from "@/testHelpers/searchLayoutContext";
import type { LayoutOverrides } from "@/types/splice";

import {
  applyCableSideDragCommit,
  canUseCandidateSideDrag,
  candidateFromOverrides,
  detectSideFromDragPosition,
  detectSideFromEdgeProximity,
  lockedSidesForSideDrag,
  moveCableInCandidate,
  resolveSideDragCablePosition,
  stackCoordForSide,
} from "./cableSideDrag";

function readContractCsv(name: string): string {
  return readFileSync(resolveReferenceCsvPath(name), "utf8");
}

const BOUNDS = { centerX: 530, centerY: 400 };

describe("detectSideFromDragPosition", () => {
  it("detects left and right from center X", () => {
    expect(detectSideFromDragPosition(100, 400, BOUNDS)).toBe("left");
    expect(detectSideFromDragPosition(900, 400, BOUNDS)).toBe("right");
  });

  it("detects top and bottom when closer to vertical edge", () => {
    expect(detectSideFromDragPosition(530, 40, BOUNDS)).toBe("top");
    expect(detectSideFromDragPosition(530, 760, BOUNDS)).toBe("bottom");
  });

  it("falls back to L/R when vertical sides disabled", () => {
    expect(
      detectSideFromDragPosition(530, 40, BOUNDS, { allowVertical: false }),
    ).toBe("right");
    expect(
      detectSideFromDragPosition(100, 40, BOUNDS, { allowVertical: false }),
    ).toBe("left");
  });
});

describe("detectSideFromEdgeProximity", () => {
  const EDGE_BOUNDS = {
    centerX: 530,
    centerY: 400,
    layoutWidth: 1060,
    minY: 0,
    maxY: 800,
  };
  const LEFT_START = { dragStartX: 40 };

  it("keeps current side when not near any canvas edge", () => {
    expect(
      detectSideFromEdgeProximity(400, 400, EDGE_BOUNDS, "left", LEFT_START),
    ).toBe("left");
    expect(
      detectSideFromEdgeProximity(600, 400, EDGE_BOUNDS, "right", {
        dragStartX: 1020,
      }),
    ).toBe("right");
  });

  it("switches side only when within threshold of an edge", () => {
    expect(
      detectSideFromEdgeProximity(40, 400, EDGE_BOUNDS, "right"),
    ).toBe("left");
    expect(
      detectSideFromEdgeProximity(1020, 400, EDGE_BOUNDS, "left"),
    ).toBe("right");
    expect(
      detectSideFromEdgeProximity(530, 30, EDGE_BOUNDS, "left", {
        dragStartX: 40,
      }),
    ).toBe("top");
    expect(
      detectSideFromEdgeProximity(530, 770, EDGE_BOUNDS, "left", {
        dragStartX: 40,
      }),
    ).toBe("bottom");
  });

  it("keeps side-column cable on left/right for pure vertical and fine-tune drags", () => {
    for (const y of [30, 90, 400, 710, 770]) {
      expect(
        detectSideFromEdgeProximity(40, y, EDGE_BOUNDS, "left", LEFT_START),
      ).toBe("left");
    }
    expect(
      detectSideFromEdgeProximity(200, 30, EDGE_BOUNDS, "left", LEFT_START),
    ).toBe("left");
    expect(
      detectSideFromEdgeProximity(120, 120, EDGE_BOUNDS, "left", LEFT_START),
    ).toBe("left");
    for (const y of [30, 400, 770]) {
      expect(
        detectSideFromEdgeProximity(1020, y, EDGE_BOUNDS, "right", {
          dragStartX: 1020,
        }),
      ).toBe("right");
    }
    expect(
      detectSideFromEdgeProximity(900, 120, EDGE_BOUNDS, "right", {
        dragStartX: 1020,
      }),
    ).toBe("right");
  });

  it("promotes to top/bottom only after deliberate move toward center", () => {
    expect(
      detectSideFromEdgeProximity(530, 30, EDGE_BOUNDS, "left", {
        dragStartX: 40,
      }),
    ).toBe("top");
    expect(
      detectSideFromEdgeProximity(530, 770, EDGE_BOUNDS, "left", {
        dragStartX: 40,
      }),
    ).toBe("bottom");
    expect(
      detectSideFromEdgeProximity(450, 30, EDGE_BOUNDS, "left", {
        dragStartX: 40,
      }),
    ).toBe("top");
    expect(
      detectSideFromEdgeProximity(600, 770, EDGE_BOUNDS, "right", {
        dragStartX: 1020,
      }),
    ).toBe("bottom");
  });

  it("does not promote L/R stack reorder near minY/maxY in the side column", () => {
    const stack = { ...EDGE_BOUNDS, minY: 72, maxY: 688 };
    expect(
      detectSideFromEdgeProximity(40, 82, stack, "left", LEFT_START),
    ).toBe("left");
    expect(
      detectSideFromEdgeProximity(1020, 678, stack, "right", {
        dragStartX: 1020,
      }),
    ).toBe("right");
  });

  it("does not promote on narrow layouts when still fine-tuning the side column", () => {
    const narrow = { ...EDGE_BOUNDS, layoutWidth: 500, centerX: 250 };
    expect(
      detectSideFromEdgeProximity(40, 120, narrow, "left", { dragStartX: 40 }),
    ).toBe("left");
    expect(
      detectSideFromEdgeProximity(40, 30, narrow, "left", { dragStartX: 40 }),
    ).toBe("left");
    expect(
      detectSideFromEdgeProximity(420, 30, narrow, "left", { dragStartX: 40 }),
    ).toBe("top");
  });

  it("bottom detection fails when maxY follows the dragged cable (moving target)", () => {
    const frozen = { ...EDGE_BOUNDS, minY: 72, maxY: 688 };
    expect(
      detectSideFromEdgeProximity(530, 650, frozen, "left", { dragStartX: 40 }),
    ).toBe("bottom");

    const moving = { ...EDGE_BOUNDS, minY: 72, maxY: 810 };
    expect(
      detectSideFromEdgeProximity(530, 650, moving, "left", { dragStartX: 40 }),
    ).toBe("left");
  });
});

describe("stackCoordForSide", () => {
  it("uses Y for left/right and X for top/bottom", () => {
    const pos = { x: 120, y: 340 };
    expect(stackCoordForSide("left", pos)).toBe(340);
    expect(stackCoordForSide("top", pos)).toBe(120);
  });
});

describe("moveCableInCandidate", () => {
  it("moves cable between sides and updates stack order", () => {
    const candidate = {
      cableSides: { A: "left" as const, B: "right" as const },
      stackOrder: {
        left: ["A"],
        right: ["B"],
        top: [],
        bottom: [],
      },
      layoutWidth: 1060,
      layoutExpansion: {
        centerGapPadding: 0,
        cableGapExtra: 0,
        tubeGroupGapExtra: 0,
      },
    };
    const visualCables = [
      {
        id: "vc-a",
        device: "DEV",
        cable: "A",
        side: "left" as const,
        order: 0,
        legId: "l1",
        tubes: [],
      },
      {
        id: "vc-b",
        device: "DEV",
        cable: "B",
        side: "right" as const,
        order: 0,
        legId: "l2",
        tubes: [],
      },
    ];
    const positions = {
      "cable-vc-a": { x: 80, y: 200 },
      "cable-vc-b": { x: 900, y: 100 },
    };

    const next = moveCableInCandidate(
      candidate,
      "A",
      "right",
      150,
      visualCables,
      positions,
    );

    expect(next.cableSides.A).toBe("right");
    expect(next.stackOrder.left).toEqual([]);
    expect(next.stackOrder.right).toEqual(["B", "A"]);
  });
});

describe("resolveSideDragCablePosition", () => {
  it("keeps drag X when flipping to top", () => {
    expect(
      resolveSideDragCablePosition(
        "top",
        true,
        { x: 515, y: 472 },
        { x: 500, y: 72 },
      ),
    ).toEqual({ x: 515, y: 72 });
  });

  it("keeps drag X when flipping to bottom", () => {
    expect(
      resolveSideDragCablePosition(
        "bottom",
        true,
        { x: 420, y: 680 },
        { x: 400, y: 700 },
      ),
    ).toEqual({ x: 420, y: 700 });
  });

  it("uses built X when flipping to right", () => {
    expect(
      resolveSideDragCablePosition(
        "right",
        true,
        { x: 40, y: 200 },
        { x: 900, y: 210 },
      ),
    ).toEqual({ x: 900, y: 200 });
  });
});

describe("applyCableSideDragCommit", () => {
  it("mirrors geometry on L↔R flip and updates optimizedLayoutCandidate", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readContractCsv("CSV Splice Detail Example #2.csv")),
    );
    const snapshot = loadSearchCandidateSnapshot("example-2");
    expect(snapshot).toBeDefined();

    const candidate = toLayoutCandidate(snapshot!);
    const cableKey = Object.keys(candidate.cableSides).find(
      (k) => candidate.cableSides[k] === "left",
    )!;
    const { visualCables } = buildVisualCablesForLayout(graph);
    const vc = visualCables.find((c) => c.cable === cableKey)!;

    const overrides: LayoutOverrides = {
      reportKey: "example-2-side-drag",
      positions: {},
      optimizedLayoutCandidate: snapshot,
      layoutWidth: candidate.layoutWidth,
      autoAdjustEnabled: true,
      routingEngine: "grid",
    };

    const commit = applyCableSideDragCommit({
      graph,
      overrides,
      visualId: vc.id,
      nodeId: `cable-${vc.id}`,
      position: { x: 980, y: 120 },
      newSide: "right",
      bounds: {
        centerX: candidate.layoutWidth / 2,
        centerY: 400,
      },
      collapseFullButtSplices: false,
      autoAdjustEnabled: true,
    });

    expect(commit).not.toBeNull();
    expect(commit!.sideChanged).toBe(true);
    expect(commit!.candidate.cableSides[cableKey]).toBe("right");
    expect(commit!.overrides.optimizedLayoutCandidate?.cableSides[cableKey]).toBe(
      "right",
    );

    const cableNode = commit!.nodes.find((n) => n.id === `cable-${vc.id}`);
    expect(cableNode).toBeDefined();
    expect((cableNode!.data as { side: string }).side).toBe("right");
  });

  it("switches to quad layoutMode when cable moves to top", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readContractCsv("CSV Splice Detail Example #2.csv")),
    );
    const snapshot = loadSearchCandidateSnapshot("example-2");
    const candidate = toLayoutCandidate(snapshot!);
    const cableKey = Object.keys(candidate.cableSides).find(
      (k) => candidate.cableSides[k] === "left",
    )!;
    const { visualCables } = buildVisualCablesForLayout(graph);
    const vc = visualCables.find((c) => c.cable === cableKey)!;

    const commit = applyCableSideDragCommit({
      graph,
      overrides: {
        reportKey: "quad-top",
        positions: {},
        optimizedLayoutCandidate: snapshot,
      },
      visualId: vc.id,
      nodeId: `cable-${vc.id}`,
      position: { x: 400, y: 40 },
      newSide: "top",
      bounds: { centerX: candidate.layoutWidth / 2, centerY: 400 },
      collapseFullButtSplices: false,
      autoAdjustEnabled: true,
    });

    expect(commit!.layoutMode).toBe("quad");
    expect(deriveLayoutMode(commit!.candidate)).toBe("quad");
    expect(commit!.candidate.cableSides[cableKey]).toBe("top");
    const cableNode = commit!.nodes.find((n) => n.id === `cable-${vc.id}`);
    expect((cableNode!.data as { quadSide?: string }).quadSide).toBe("top");
    expect(commit!.overrides.quadCableSides?.[vc.id]).toBe("top");
  });

  it("promotes L/R-only import to quad when first cable moves to bottom", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readContractCsv("CSV Splice Detail Example #2.csv")),
    );
    const snapshot = loadSearchCandidateSnapshot("example-2");
    const candidate = toLayoutCandidate(snapshot!);
    const cableKey = Object.keys(candidate.cableSides).find(
      (k) => candidate.cableSides[k] === "left",
    )!;
    const { visualCables } = buildVisualCablesForLayout(graph);
    const vc = visualCables.find((c) => c.cable === cableKey)!;

    const commit = applyCableSideDragCommit({
      graph,
      overrides: {
        reportKey: "quad-bottom",
        positions: {},
        optimizedLayoutCandidate: snapshot,
      },
      visualId: vc.id,
      nodeId: `cable-${vc.id}`,
      position: { x: 400, y: 680 },
      newSide: "bottom",
      bounds: { centerX: candidate.layoutWidth / 2, centerY: 400 },
      collapseFullButtSplices: false,
      autoAdjustEnabled: true,
    });

    expect(commit!.layoutMode).toBe("quad");
    expect(commit!.candidate.cableSides[cableKey]).toBe("bottom");
    const cableNode = commit!.nodes.find((n) => n.id === `cable-${vc.id}`);
    expect((cableNode!.data as { quadSide?: string }).quadSide).toBe("bottom");
    expect(cableNode!.position.y).toBeGreaterThan(400);
    expect(cableNode!.position.y).toBeLessThan(900);

    for (const node of commit!.nodes) {
      if (node.type !== "cable") continue;
      expect(node.position.y).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeLessThan(900);
    }
  });

  it("quad side flip clears stale horizontal positions so cables stay grouped", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readContractCsv("Left-SP-3254.5.csv")),
    );
    const { visualCables } = buildVisualCablesForLayout(graph);
    const cableSides: Record<string, import("@/features/layoutSearch/layoutCandidate").LayoutSide> = {};
    const stackOrder = {
      left: [] as string[],
      right: [] as string[],
      top: [] as string[],
      bottom: [] as string[],
    };
    for (const vc of visualCables) {
      const key = cableNameKey(vc.cable);
      const side = vc.side as import("@/features/layoutSearch/layoutCandidate").LayoutSide;
      cableSides[key] = side;
      stackOrder[side].push(key);
    }
    const snapshot = {
      cableSides,
      stackOrder,
      layoutWidth: 1400,
      layoutExpansion: {
        centerGapPadding: 0,
        cableGapExtra: 0,
        tubeGroupGapExtra: 0,
      },
    };
    const stalePositions: Record<string, { x: number; y: number }> = {};
    for (const vc of visualCables) {
      stalePositions[`cable-${vc.id}`] = {
        x: vc.side === "left" ? 115 : 997,
        y: 300 + stackOrder[vc.side as "left" | "right"].indexOf(cableNameKey(vc.cable)) * 180,
      };
    }
    const leftVc = visualCables.find((v) => v.side === "left")!;

    const commit = applyCableSideDragCommit({
      graph,
      overrides: {
        reportKey: "left-sp-quad",
        positions: stalePositions,
        optimizedLayoutCandidate: snapshot,
      },
      visualId: leftVc.id,
      nodeId: `cable-${leftVc.id}`,
      position: { x: 400, y: 40 },
      newSide: "top",
      bounds: { centerX: 700, centerY: 400 },
      collapseFullButtSplices: false,
      autoAdjustEnabled: true,
    });

    expect(commit!.layoutMode).toBe("quad");
    const cables = commit!.nodes.filter((n) => n.type === "cable");
    expect(cables.length).toBe(visualCables.length);
    const xs = cables.map((n) => n.position.x);
    const ys = cables.map((n) => n.position.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1100);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(700);
    expect(commit!.edges.length).toBeGreaterThan(10);
    expect(cables.some((n) => (n.data as { quadSide?: string }).quadSide === "top")).toBe(
      true,
    );
    const topCable = cables.find((n) => (n.data as { quadSide?: string }).quadSide === "top")!;
    expect(topCable.position.y).toBeLessThan(200);
    expect(topCable.position.x).toBe(400);
    expect(
      commit!.overrides.positions?.[`cable-${leftVc.id}`]?.x,
    ).toBe(400);
    for (const n of cables) {
      if ((n.data as { quadSide?: string }).quadSide === "right") {
        expect(n.position.x).toBeGreaterThan(600);
        expect(n.position.x).toBeLessThan(1100);
      }
    }
    for (const vc of visualCables) {
      if (vc.id === leftVc.id) continue;
      expect(
        commit!.overrides.positions?.[`cable-${vc.id}`],
      ).toBeUndefined();
    }
  });

  it("promotes L/R-only import to quad when first cable moves to top", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readContractCsv("CSV Splice Detail Example #2.csv")),
    );
    const snapshot = loadSearchCandidateSnapshot("example-2");
    const candidate = toLayoutCandidate(snapshot!);
    expect(deriveLayoutMode(candidate)).toBe("horizontal");

    const cableKey = Object.keys(candidate.cableSides).find(
      (k) => candidate.cableSides[k] === "left",
    )!;
    const { visualCables } = buildVisualCablesForLayout(graph);
    const vc = visualCables.find((c) => c.cable === cableKey)!;

    const commit = applyCableSideDragCommit({
      graph,
      overrides: {
        reportKey: "lr-promote",
        positions: {},
        optimizedLayoutCandidate: snapshot,
      },
      visualId: vc.id,
      nodeId: `cable-${vc.id}`,
      position: { x: 400, y: 40 },
      newSide: "top",
      bounds: { centerX: candidate.layoutWidth / 2, centerY: 400 },
      collapseFullButtSplices: false,
      autoAdjustEnabled: true,
    });

    expect(commit!.layoutMode).toBe("quad");
    expect(commit!.overrides.layoutMode).toBe("quad");
  });

  it("demotes to horizontal when last top/bottom cable moves to left/right", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readContractCsv("CSV Splice Detail Example #2.csv")),
    );
    const snapshot = loadSearchCandidateSnapshot("example-2");
    const candidate = toLayoutCandidate(snapshot!);
    const cableKey = Object.keys(candidate.cableSides).find(
      (k) => candidate.cableSides[k] === "left",
    )!;
    const { visualCables } = buildVisualCablesForLayout(graph);
    const vc = visualCables.find((c) => c.cable === cableKey)!;

    const toTop = applyCableSideDragCommit({
      graph,
      overrides: {
        reportKey: "demote",
        positions: {},
        optimizedLayoutCandidate: snapshot,
        autoAdjustEnabled: false,
      },
      visualId: vc.id,
      nodeId: `cable-${vc.id}`,
      position: { x: 400, y: 40 },
      newSide: "top",
      bounds: { centerX: candidate.layoutWidth / 2, centerY: 400 },
      collapseFullButtSplices: false,
      autoAdjustEnabled: false,
    });
    expect(toTop!.layoutMode).toBe("quad");

    const backLeft = applyCableSideDragCommit({
      graph,
      overrides: toTop!.overrides,
      visualId: vc.id,
      nodeId: `cable-${vc.id}`,
      position: { x: 80, y: 200 },
      newSide: "left",
      bounds: { centerX: candidate.layoutWidth / 2, centerY: 400 },
      collapseFullButtSplices: false,
      autoAdjustEnabled: false,
    });

    expect(backLeft!.layoutMode).toBe("horizontal");
    expect(backLeft!.overrides.layoutMode).toBe("horizontal");
    expect(backLeft!.overrides.quadCableSides).toBeUndefined();
  });

  it("preview commit persists side change without extra lock state", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readContractCsv("CSV Splice Detail Example #2.csv")),
    );
    const snapshot = loadSearchCandidateSnapshot("example-2");
    const candidate = toLayoutCandidate(snapshot!);
    const cableKey = Object.keys(candidate.cableSides).find(
      (k) => candidate.cableSides[k] === "left",
    )!;
    const { visualCables } = buildVisualCablesForLayout(graph);
    const vc = visualCables.find((c) => c.cable === cableKey)!;

    const commit = applyCableSideDragCommit({
      graph,
      overrides: {
        reportKey: "preview",
        positions: {},
        optimizedLayoutCandidate: snapshot,
      },
      visualId: vc.id,
      nodeId: `cable-${vc.id}`,
      position: { x: 980, y: 120 },
      newSide: "right",
      bounds: { centerX: candidate.layoutWidth / 2, centerY: 400 },
      collapseFullButtSplices: false,
      autoAdjustEnabled: true,
      preview: true,
    });

    expect(commit!.sideChanged).toBe(true);
    expect(commit!.overrides.locks).toBeUndefined();
  });

  it("manual mode commit persists position without locks", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readContractCsv("CSV Splice Detail Example #2.csv")),
    );
    const snapshot = loadSearchCandidateSnapshot("example-2");
    const candidate = toLayoutCandidate(snapshot!);
    const cableKey = Object.keys(candidate.cableSides).find(
      (k) => candidate.cableSides[k] === "left",
    )!;
    const { visualCables } = buildVisualCablesForLayout(graph);
    const vc = visualCables.find((c) => c.cable === cableKey)!;

    const commit = applyCableSideDragCommit({
      graph,
      overrides: {
        reportKey: "manual",
        positions: {},
        optimizedLayoutCandidate: snapshot,
        autoAdjustEnabled: false,
      },
      visualId: vc.id,
      nodeId: `cable-${vc.id}`,
      position: { x: 980, y: 120 },
      newSide: "right",
      bounds: { centerX: candidate.layoutWidth / 2, centerY: 400 },
      collapseFullButtSplices: false,
      autoAdjustEnabled: false,
    });

    expect(commit!.sideChanged).toBe(true);
    expect(commit!.overrides.locks).toBeUndefined();
    expect(commit!.overrides.positions[`cable-${vc.id}`]).toBeDefined();
  });

  it("bottom cable to top stays on canvas (not stale bottom Y)", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readContractCsv("CSV Splice Detail Example #2.csv")),
    );
    const snapshot = loadSearchCandidateSnapshot("example-2");
    const candidate = toLayoutCandidate(snapshot!);
    const cableKey = Object.keys(candidate.cableSides).find(
      (k) => candidate.cableSides[k] === "left",
    )!;
    const { visualCables } = buildVisualCablesForLayout(graph);
    const vc = visualCables.find((c) => c.cable === cableKey)!;

    const staleBottomY = 472;
    const overrides: LayoutOverrides = {
      reportKey: "stale-bottom-y",
      positions: { [`cable-${vc.id}`]: { x: 515, y: staleBottomY } },
      optimizedLayoutCandidate: {
        ...snapshot!,
        cableSides: { ...candidate.cableSides, [cableKey]: "bottom" },
        stackOrder: {
          left: candidate.stackOrder.left.filter((k) => k !== cableKey),
          right: candidate.stackOrder.right,
          top: candidate.stackOrder.top,
          bottom: [...candidate.stackOrder.bottom, cableKey],
        },
      },
      layoutMode: "quad",
      quadCableSides: { [vc.id]: "bottom" },
      layoutWidth: candidate.layoutWidth,
    };

    const commit = applyCableSideDragCommit({
      graph,
      overrides,
      visualId: vc.id,
      nodeId: `cable-${vc.id}`,
      position: { x: 515, y: 40 },
      newSide: "top",
      bounds: {
        centerX: candidate.layoutWidth / 2,
        centerY: 400,
      },
      collapseFullButtSplices: false,
      autoAdjustEnabled: true,
    });

    expect(commit).not.toBeNull();
    expect(commit!.sideChanged).toBe(true);
    const dragged = commit!.nodes.find((n) => n.id === `cable-${vc.id}`);
    expect(dragged).toBeDefined();
    expect((dragged!.data as { quadSide?: string }).quadSide).toBe("top");
    expect(dragged!.position.y).toBeLessThan(200);
    expect(dragged!.position.y).not.toBe(staleBottomY);

    for (const node of commit!.nodes) {
      if (node.type !== "cable") continue;
      expect(node.position.y).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeLessThan(900);
    }
  });

  it.skipIf(
    !existsSync(
      join(process.cwd(), "sdc-workspace/output/rank-1.sdc.json"),
    ),
  )("rank-1 bottom cable to top stays on canvas (fixture file)", () => {
    const configPath = join(
      process.cwd(),
      "sdc-workspace/output/rank-1.sdc.json",
    );
    const config = parseDiagramConfig(readFileSync(configPath, "utf8"));
    const graph = connectionGraphFromConfig(config);
    const reportKey = reportStorageKey(graph);
    const overrides = layoutOverridesFromConfig(config, reportKey);
    const { visualCables } = buildVisualCablesForLayout(graph);
    const candidate = toLayoutCandidate(overrides.optimizedLayoutCandidate!);
    const bottomKey = Object.keys(candidate.cableSides).find(
      (k) => candidate.cableSides[k] === "bottom",
    )!;
    const bottomVc = visualCables.find((vc) => vc.cable === bottomKey);
    expect(bottomVc).toBeDefined();

    const staleBottomY =
      overrides.positions[`cable-${bottomVc!.id}`]?.y ?? 472;
    expect(staleBottomY).toBeGreaterThan(400);

    const commit = applyCableSideDragCommit({
      graph,
      overrides,
      visualId: bottomVc!.id,
      nodeId: `cable-${bottomVc!.id}`,
      position: { x: 515, y: 40 },
      newSide: "top",
      bounds: {
        centerX: overrides.layoutWidth! / 2,
        centerY: 400,
      },
      collapseFullButtSplices: false,
      autoAdjustEnabled: true,
    });

    expect(commit).not.toBeNull();
    expect(commit!.sideChanged).toBe(true);
    const dragged = commit!.nodes.find((n) => n.id === `cable-${bottomVc!.id}`);
    expect(dragged).toBeDefined();
    expect((dragged!.data as { quadSide?: string }).quadSide).toBe("top");
    expect(dragged!.position.y).toBeLessThan(200);
    expect(dragged!.position.y).not.toBe(staleBottomY);

    for (const node of commit!.nodes) {
      if (node.type !== "cable") continue;
      expect(node.position.y).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeLessThan(900);
      expect(node.position.x).toBeGreaterThanOrEqual(0);
      expect(node.position.x).toBeLessThan(1200);
    }
  });
});

describe("lockedSidesForSideDrag", () => {
  it("locks every cable side so re-optimize cannot flip unrelated cables", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readContractCsv("CSV Splice Detail Example #2.csv")),
    );
    const snapshot = loadSearchCandidateSnapshot("example-2");
    const candidate = toLayoutCandidate(snapshot!);
    const { visualCables } = buildVisualCablesForLayout(graph);
    const leftVc = visualCables.find((v) => v.side === "left")!;
    const cableKey = cableNameKey(leftVc.cable);
    const seed = moveCableInCandidate(
      candidate,
      cableKey,
      "top",
      400,
      visualCables,
      {},
    );

    const locked = lockedSidesForSideDrag(
      graph,
      {
        reportKey: "example-2",
        positions: {},
        optimizedLayoutCandidate: snapshot,
      },
      leftVc.id,
      "top",
      seed,
    );

    expect(Object.keys(locked).sort()).toEqual(
      Object.keys(candidate.cableSides).sort(),
    );
    expect(locked[cableKey]).toBe("top");
    for (const [key, side] of Object.entries(candidate.cableSides)) {
      if (key === cableKey) continue;
      expect(locked[key]).toBe(side);
    }
  });
});

describe("canUseCandidateSideDrag", () => {
  it("returns true when optimizedLayoutCandidate exists", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readContractCsv("CSV Splice Detail Example #2.csv")),
    );
    const snapshot = loadSearchCandidateSnapshot("example-2");
    const overrides: LayoutOverrides = {
      reportKey: "example-2",
      positions: {},
      optimizedLayoutCandidate: snapshot,
    };
    expect(canUseCandidateSideDrag(graph, overrides)).toBe(true);
  });

  it("synthesizes candidate from cableSides when snapshot missing", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readContractCsv("CSV Splice Detail Example #2.csv")),
    );
    const { visualCables } = buildVisualCablesForLayout(graph);
    const cableSides: Record<string, "left" | "right"> = {};
    for (const vc of visualCables) {
      cableSides[vc.id] = vc.side;
    }
    const overrides: LayoutOverrides = {
      reportKey: "restored",
      positions: {},
      cableSides,
      layoutWidth: 1200,
    };
    expect(canUseCandidateSideDrag(graph, overrides)).toBe(true);
    expect(candidateFromOverrides(graph, overrides)).toBeDefined();
  });
});
