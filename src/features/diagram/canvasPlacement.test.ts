import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import {
  computeCanvasPlacement,
  stackOrderCrossingCount,
} from "./canvasPlacement";
import { connectionRowIndexMap } from "./connectionRowOrder";
import { parentVisualGroupKey } from "./dominantCablePair";
import { buildVisualCablesForLayout } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

const examples = join(process.cwd(), "docs/reference/examples");

describe("computeCanvasPlacement", () => {
  it("Example #2: dominant pair cables stack first on each side", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(
        readFileSync(join(examples, "CSV Splice Detail Example #2.csv"), "utf8"),
      ),
    );
    const { visualCables, dominant } = buildVisualCablesForLayout(graph);
    expect(dominant).not.toBeNull();
    const rowIndex = connectionRowIndexMap(graph, visualCables, dominant);
    const placement = computeCanvasPlacement(
      graph,
      visualCables,
      dominant,
      rowIndex,
    );

    const orderOf = (side: "left" | "right") =>
      visualCables
        .filter((vc) => (placement.get(vc.id)?.side ?? vc.side) === side)
        .sort(
          (a, b) =>
            (placement.get(a.id)?.order ?? 0) - (placement.get(b.id)?.order ?? 0),
        );

    const leftFirst = orderOf("left")[0]!;
    const rightFirst = orderOf("right")[0]!;
    expect(parentVisualGroupKey(leftFirst.id)).toBe(dominant!.leftGroupKey);
    expect(parentVisualGroupKey(rightFirst.id)).toBe(dominant!.rightGroupKey);
  });

  it("Example #3: optimized stack order has no strand crossings", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(
        readFileSync(join(examples, "CSV Splice Detail Example #3.csv"), "utf8"),
      ),
    );
    const { visualCables, dominant } = buildVisualCablesForLayout(graph);
    const rowIndex = connectionRowIndexMap(graph, visualCables, dominant);
    const placement = computeCanvasPlacement(
      graph,
      visualCables,
      dominant,
      rowIndex,
    );

    const leftOrder = visualCables
      .filter((vc) => (placement.get(vc.id)?.side ?? vc.side) === "left")
      .sort(
        (a, b) =>
          (placement.get(a.id)?.order ?? 0) - (placement.get(b.id)?.order ?? 0),
      );
    const rightOrder = visualCables
      .filter((vc) => (placement.get(vc.id)?.side ?? vc.side) === "right")
      .sort(
        (a, b) =>
          (placement.get(a.id)?.order ?? 0) - (placement.get(b.id)?.order ?? 0),
      );

    const naiveLeft = [...visualCables]
      .filter((vc) => vc.side === "left")
      .sort((a, b) => a.order - b.order);
    const naiveRight = [...visualCables]
      .filter((vc) => vc.side === "right")
      .sort((a, b) => a.order - b.order);
    const naiveCrossings = stackOrderCrossingCount(
      naiveLeft,
      naiveRight,
      graph,
      rowIndex,
      visualCables,
    );
    const optimizedCrossings = stackOrderCrossingCount(
      leftOrder,
      rightOrder,
      graph,
      rowIndex,
      visualCables,
    );

    expect(optimizedCrossings).toBeLessThanOrEqual(naiveCrossings);
  });
});
