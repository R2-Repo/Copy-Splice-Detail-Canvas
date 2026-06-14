import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";

import { handleCoordsForConnection } from "./handleCoords";

describe("handleCoordsForConnection uses the rendered cable side", () => {
  it("ignores a stale graph.cableSides — node.data.side is the source of truth", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readLeftCsv("Left-SP-3254.5.csv")),
    );
    const { nodes, edges } = buildReactFlowGraph(graph);

    const left = edges.find((e) => e.id.startsWith("splice-left-"));
    expect(left).toBeDefined();
    const connId = left!.id.replace(/^splice-left-/, "");

    const baseline = handleCoordsForConnection(connId, nodes, graph);
    expect(baseline).not.toBeNull();

    // Corrupt the persisted side map (simulates the side persisted out of sync
    // with the dragged position). Handles must NOT move — the legs follow the
    // rendered node side, so a stale map can no longer detach them.
    for (const [cable, side] of [...graph.cableSides.entries()]) {
      graph.cableSides.set(cable, side === "left" ? "right" : "left");
    }
    const afterCorruption = handleCoordsForConnection(connId, nodes, graph);

    expect(afterCorruption).toEqual(baseline);
  });
});
