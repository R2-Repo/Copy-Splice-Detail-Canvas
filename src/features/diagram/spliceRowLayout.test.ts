import { describe, expect, it } from "vitest";

import {
  FIBER_ROW_PITCH,
  fiberRowOffsetInCable,
} from "./cableLayoutMetrics";
import { buildConnectionGraph } from "./buildConnectionGraph";
import { computeCanvasPlacement, type CablePlacement } from "./canvasPlacement";
import { connectionRowIndexMap } from "./connectionRowOrder";
import {
  computeAlignedLayout,
  computeCableXBounds,
} from "./spliceRowLayout";
import { buildVisualCablesForLayout, type VisualCable } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";
import type { ConnectionGraph } from "@/types/splice";

function layoutFromGraph(graph: ConnectionGraph) {
  const { visualCables } = buildVisualCablesForLayout(graph);
  const rowIndex = connectionRowIndexMap(graph, visualCables);
  const placement = computeCanvasPlacement(
    graph, visualCables, rowIndex,
  );
  const layout = computeAlignedLayout(
    graph, visualCables, placement,  );
  return { visualCables, placement, layout, rowIndex };
}

function cableBoxesOverlap(
  a: { y: number; height: number },
  b: { y: number; height: number },
): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

function placementFor(cables: VisualCable[]): Map<string, CablePlacement> {
  const placement = new Map<string, CablePlacement>();
  cables.forEach((vc, index) => {
    placement.set(vc.id, { side: vc.side, order: index });
  });
  return placement;
}

describe("computeAlignedLayout", () => {
  it("Example #2: drop cable fibers are compact and in strand order", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(
        readReferenceCsv("CSV Splice Detail Example #2.csv"),
      ),
    );
    const { visualCables: visual, placement, layout } = layoutFromGraph(graph);

    const conn = graph.connections.find((c) => c.kind === "fiber")!;
    const rowY = layout.rowYs.get(conn.id)!;
    const sideOf = (vc: (typeof visual)[0]) =>
      placement.get(vc.id)?.side ?? vc.side;
    const orderOf = (vc: (typeof visual)[0]) =>
      placement.get(vc.id)?.order ?? vc.order;

    for (const side of ["left", "right"] as const) {
      const first = visual
        .filter((vc) => sideOf(vc) === side)
        .sort((a, b) => orderOf(a) - orderOf(b))[0];
      if (!first) continue;
      for (const fiber of first.tubes.flatMap((t) => t.fibers)) {
        if (fiber.connectionId !== conn.id) continue;
        const pos = layout.cablePositions.get(first.id)!;
        const absY = pos.y + fiberRowOffsetInCable(first, fiber.connectionId);
        expect(Math.abs(absY - rowY)).toBeLessThan(2);
      }
    }

    const drop = visual.find(
      (v) => v.side === "left" && /DROP/i.test(v.cable),
    )!;
    const fibers = drop.tubes.flatMap((t) => t.fibers);
    expect(fibers.map((f) => f.fiberColor)).toEqual(["BL", "OR", "GR", "BR"]);
    expect(fibers.map((f) => f.fiberNumber)).toEqual([1, 2, 3, 4]);
    const byOffset = [...fibers].sort((a, b) => a.rowYOffset - b.rowYOffset);
    const steps = byOffset
      .slice(1)
      .map((f, i) => f.rowYOffset - byOffset[i]!.rowYOffset);
    expect(steps.every((s) => s === FIBER_ROW_PITCH)).toBe(true);

    const dk = visual.find(
      (v) => v.side === "right" && /DK-/i.test(v.cable),
    )!;
    const dkFibers = dk.tubes.flatMap((t) => t.fibers);
    expect(dkFibers.map((f) => f.fiberColor)).toEqual(["BL", "OR", "GR", "BR"]);
  });

  it("Example #2: same-side cables stack without vertical overlap", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(
        readReferenceCsv("CSV Splice Detail Example #2.csv"),
      ),
    );
    const { visualCables: visual, placement, layout } = layoutFromGraph(graph);

    for (const side of ["left", "right"] as const) {
      const boxes = visual
        .filter((vc) => (placement.get(vc.id)?.side ?? vc.side) === side)
        .map((vc) => layout.cablePositions.get(vc.id)!);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect(cableBoxesOverlap(boxes[i]!, boxes[j]!)).toBe(false);
        }
      }
    }
  });

  it("Example #1: ring-cut 144 cables on right do not overlap", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(
        readReferenceCsv("CSV Splice Detail Example #1.csv"),
      ),
    );
    const { visualCables: visual, placement, layout } = layoutFromGraph(graph);

    const right = visual.filter(
      (vc) => (placement.get(vc.id)?.side ?? vc.side) === "right",
    );
    expect(right).toHaveLength(2);
    const boxes = right.map((vc) => layout.cablePositions.get(vc.id)!);
    expect(cableBoxesOverlap(boxes[0]!, boxes[1]!)).toBe(false);
  });

  it("Example #3: multi-tube cables keep distinct fiber row offsets", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(
        readReferenceCsv("CSV Splice Detail Example #3.csv"),
      ),
    );
    const { visualCables: visual, placement } = layoutFromGraph(graph);
    computeAlignedLayout(graph, visual, placement);

    const multiTube = visual.filter((vc) => vc.tubes.length > 1);
    expect(multiTube.length).toBeGreaterThan(0);
    for (const vc of multiTube) {
      const offsets = vc.tubes.flatMap((t) => t.fibers.map((f) => f.rowYOffset));
      expect(new Set(offsets).size).toBe(offsets.length);
    }
  });

  it("pushes cable columns toward canvas edges for wide layouts", () => {
    const makeCable = (id: number, side: "left" | "right"): VisualCable => ({
      id: `mock-${side}-${id}`,
      legId: `${side}-${id}`,
      device: "",
      cable: `mock-${side}-${id}`,
      side,
      order: id,
      tubes: [{ tubeColor: "BL", fibers: [] }],
    });

    const cables = [makeCable(0, "left"), makeCable(0, "right")];
    const wideWidth = 2400;
    const bounds = computeCableXBounds(
      cables,
      placementFor(cables),
      wideWidth,
    );

    expect(bounds.leftX).toBe(24);
    expect(bounds.rightX).toBeGreaterThan(bounds.leftX + 400);
    expect(bounds.rightX).toBeLessThan(wideWidth);
  });
});
