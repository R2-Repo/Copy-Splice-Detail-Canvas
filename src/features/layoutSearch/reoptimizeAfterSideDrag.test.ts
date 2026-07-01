import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import { buildCanvasFromCandidate } from "@/features/layoutSearch/candidateToGraph";
import { deriveLayoutMode } from "@/features/layoutSearch/layoutCandidate";
import { layoutSearch } from "@/features/layoutSearch/layoutSearch";
import {
  reoptimizeAfterSideDrag,
  sideDragReoptimizeBudget,
} from "@/features/layoutSearch/reoptimizeAfterSideDrag";
import { resolveReferenceCsvPath } from "@/testHelpers/layoutContractCsvPaths";
import { readFileSync } from "node:fs";

import {
  lockedSidesForSideDrag,
  moveCableInCandidate,
  needsReoptimizeAfterSideDrag,
  prepareSideDragSeedCandidate,
} from "@/features/manualAdjust/cableSideDrag";

function readCsv(name: string): string {
  return readFileSync(resolveReferenceCsvPath(name), "utf8");
}

describe("needsReoptimizeAfterSideDrag", () => {
  it("requires re-optimize for top/bottom and quad transitions", () => {
    const candidate = {
      cableSides: { A: "left" as const, B: "right" as const },
      stackOrder: { left: ["A"], right: ["B"], top: [], bottom: [] },
      layoutWidth: 1200,
      layoutExpansion: {
        centerGapPadding: 0,
        cableGapExtra: 0,
        tubeGroupGapExtra: 0,
      },
    };
    expect(needsReoptimizeAfterSideDrag("horizontal", "top", candidate)).toBe(
      true,
    );
    expect(needsReoptimizeAfterSideDrag("horizontal", "left", candidate)).toBe(
      false,
    );
    expect(
      needsReoptimizeAfterSideDrag("quad", "left", {
        ...candidate,
        cableSides: { A: "top", B: "right", C: "left", D: "bottom" },
        stackOrder: {
          left: ["C"],
          right: ["B"],
          top: ["A"],
          bottom: ["D"],
        },
      }),
    ).toBe(true);
  });
});

describe("reoptimizeAfterSideDrag", () => {
  it("returns a connected layout when one cable moves to top", async () => {
    const graph = buildConnectionGraph(parseBentleyCsv(readCsv("Left-SP-3254.5.csv")));
    const initial = layoutSearch(graph, {
      maxRounds: 48,
      timeBudgetMs: 15_000,
      searchProfile: "background",
    });
    expect(initial.bestScore).toBeLessThan(Number.MAX_SAFE_INTEGER);

    const { visualCables } = buildVisualCablesForLayout(graph);
    const leftVc = visualCables.find((v) => v.side === "left")!;
    const cableKey = cableNameKey(leftVc.cable);
    const seed = moveCableInCandidate(
      initial.best,
      cableKey,
      "top",
      400,
      visualCables,
      {},
    );
    const locked = lockedSidesForSideDrag(
      graph,
      {
        reportKey: "side-drag-test",
        positions: {},
        optimizedLayoutCandidate: seed,
      },
      leftVc.id,
      "top",
      seed,
    );

    const winner = await reoptimizeAfterSideDrag(graph, seed, locked, {
      maxRounds: 64,
      timeBudgetMs: 12_000,
    });
    expect(winner).not.toBeNull();
    expect(deriveLayoutMode(winner!)).toBe("quad");
    for (const [key, side] of Object.entries(initial.best.cableSides)) {
      if (key === cableKey) {
        expect(winner!.cableSides[key]).toBe("top");
      } else {
        expect(winner!.cableSides[key]).toBe(side);
      }
    }

    const before = buildCanvasFromCandidate(graph, initial.best, {
      reportKey: "before",
      positions: {},
    });
    const after = buildCanvasFromCandidate(graph, winner!, {
      reportKey: "after",
      positions: {},
    });
    expect(after.edges.length).toBe(before.edges.length);

    for (const le of after.edges.filter((e) => e.id.startsWith("splice-left-"))) {
      const connId = le.id.replace(/^splice-left-/, "");
      const re = after.edges.find((e) => e.id === `splice-right-${connId}`);
      expect(re).toBeDefined();
      const spliceNode =
        after.nodes.find((n) => n.id === `splice-${connId}`) ??
        after.nodes.find((n) => n.id === `splicePoint-${connId}`);
      expect(spliceNode).toBeDefined();
    }
  }, 45_000);

  it("sideDragReoptimizeBudget stays within plan range", () => {
    const budget = sideDragReoptimizeBudget(10);
    expect(budget.maxRounds).toBeGreaterThanOrEqual(256);
    expect(budget.maxRounds).toBeLessThanOrEqual(512);
    expect(budget.timeBudgetMs).toBeGreaterThanOrEqual(2000);
    expect(budget.timeBudgetMs).toBeLessThanOrEqual(5000);
  });
});

describe("prepareSideDragSeedCandidate", () => {
  it("builds seed from overrides for top flip", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readCsv("CSV Splice Detail Example #2.csv")),
    );
    const initial = layoutSearch(graph, { maxRounds: 16, timeBudgetMs: 8000 });
    const { visualCables } = buildVisualCablesForLayout(graph);
    const leftVc = visualCables.find((v) => v.side === "left")!;
    const seed = prepareSideDragSeedCandidate(
      graph,
      {
        reportKey: "seed",
        positions: {},
        optimizedLayoutCandidate: initial.best,
      },
      leftVc.id,
      "top",
      200,
      {},
    );
    expect(seed).not.toBeNull();
    expect(deriveLayoutMode(seed!)).toBe("quad");
  }, 20_000);
});
