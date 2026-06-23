import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import {
  connectionIdsForVisualCable,
  rerouteConnectionIdsForVisualCableDrag,
} from "@/features/diagram/connectionIdsForCable";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";

describe("rerouteConnectionIdsForVisualCableDrag", () => {
  it("includes partner source cable fibers when dragging one right-side target", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readLeftCsv("Left-SP-3254.5.csv")),
    );
    const { visualCables } = buildVisualCablesForLayout(graph);
    const draggedId = "144-SMF I-15 DIST: MP 258.96 - 4800 S";
    const sourceId = "72-SMF 4800 S DIST: MAIN ST - I-15";

    const draggedOnly = connectionIdsForVisualCable(visualCables, draggedId);
    const expanded = rerouteConnectionIdsForVisualCableDrag(
      visualCables,
      draggedId,
    );
    const sourceConns = connectionIdsForVisualCable(visualCables, sourceId);

    expect(expanded.length).toBeGreaterThan(draggedOnly.length);
    for (const connId of sourceConns) {
      expect(expanded).toContain(connId);
    }
    expect(expanded).toContain(
      "144-SMF I-15 DIST: 4800 S - MP 259.46|117|VI|YL::72-SMF 4800 S DIST: MAIN ST - I-15|3|BL|GR",
    );
  });
});
