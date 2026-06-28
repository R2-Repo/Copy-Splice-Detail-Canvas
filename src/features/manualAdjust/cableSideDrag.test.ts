import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import {
  deriveLayoutMode,
} from "@/features/layoutSearch/layoutCandidate";
import { toLayoutCandidate } from "@/features/layoutSearch/verifyLayoutCandidate";
import { resolveReferenceCsvPath } from "@/testHelpers/layoutContractCsvPaths";
import { loadSearchCandidateSnapshot } from "@/testHelpers/searchLayoutContext";
import type { LayoutOverrides } from "@/types/splice";

import {
  applyCableSideDragCommit,
  detectSideFromDragPosition,
  moveCableInCandidate,
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
    expect(commit!.overrides.locks?.cables?.[vc.id]).toBe(true);

    const cableNode = commit!.nodes.find((n) => n.id === `cable-${vc.id}`);
    expect(cableNode).toBeDefined();
    expect((cableNode!.data as { side: string }).side).toBe("right");
  });

  it("blocks side change when cable is locked", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readContractCsv("CSV Splice Detail Example #2.csv")),
    );
    const snapshot = loadSearchCandidateSnapshot("example-2");
    const candidate = toLayoutCandidate(snapshot!);
    const cableKey = Object.keys(candidate.cableSides)[0]!;
    const { visualCables } = buildVisualCablesForLayout(graph);
    const vc = visualCables.find((c) => c.cable === cableKey)!;

    const overrides: LayoutOverrides = {
      reportKey: "locked-cable",
      positions: { [`cable-${vc.id}`]: { x: 80, y: 40 } },
      optimizedLayoutCandidate: snapshot,
      locks: { cables: { [vc.id]: true } },
    };

    const commit = applyCableSideDragCommit({
      graph,
      overrides,
      visualId: vc.id,
      nodeId: `cable-${vc.id}`,
      position: { x: 980, y: 40 },
      newSide: "right",
      bounds: { centerX: candidate.layoutWidth / 2, centerY: 400 },
      collapseFullButtSplices: false,
      autoAdjustEnabled: true,
    });

    expect(commit!.sideChanged).toBe(false);
    expect(commit!.warnings.some((w) => w.includes("locked"))).toBe(true);
    expect(commit!.candidate.cableSides[cableKey]).toBe(
      candidate.cableSides[cableKey],
    );
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
  });
});
