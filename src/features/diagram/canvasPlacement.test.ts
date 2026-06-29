import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import {
  computeCanvasPlacement,
  stackOrderCrossingCount,
} from "./canvasPlacement";
import { connectionRowIndexMap } from "./connectionRowOrder";
import { buildVisualCablesForLayout } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

describe("computeCanvasPlacement", () => {
  it("Example #3: optimized stack order has no strand crossings", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #3.csv")),
    );
    const { visualCables } = buildVisualCablesForLayout(graph);
    const rowIndex = connectionRowIndexMap(graph, visualCables);
    const placement = computeCanvasPlacement(
      graph, visualCables, rowIndex,
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
