import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";
import type { LayoutOverrides } from "@/types/splice";

/** SP GR→SL pair — wrong endpoint order inverts midX nest and stacks on SL/WH. */
const GR_SL_CONN =
  "6 DROP (TSC): I-15 NB & 1600 S|3|BL|GR::72-SMF 4800 S DIST: MAIN ST - I-15|5|BL|SL";

function spliceEdge(
  edges: ReturnType<typeof buildReactFlowGraph>["edges"],
  connId: string,
) {
  return edges.find(
    (e) =>
      e.id === `splice-${connId}` ||
      e.id === `splice-left-${connId}` ||
      e.id === `splice-right-${connId}`,
  );
}

describe("cable side flip routing", () => {
  it("canvas-orders stacked right-column splices so upper cable is source", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readLeftCsv("Left-SP-3254.5.csv")),
    );
    const overrides: LayoutOverrides = {
      reportKey: "sp-stacked-right",
      layoutVersion: 14,
      positions: {
        "cable-72-SMF 4800 S DIST: MAIN ST - I-15": { x: 1380, y: 40 },
        "cable-6 DROP (TSC): I-15 NB & 1600 S": { x: 1380, y: 120 },
      },
      cableSides: {
        "72-SMF 4800 S DIST: MAIN ST - I-15": "right",
        "6 DROP (TSC): I-15 NB & 1600 S": "right",
      },
      layoutWidth: 1770,
      autoAdjustEnabled: true,
      routingEngine: "grid",
    };

    const { edges } = buildReactFlowGraph(
      graph,
      overrides,
      overrides.layoutWidth,
      { refreshColumnX: true },
    );

    const edge = spliceEdge(edges, GR_SL_CONN);
    expect(edge).toBeDefined();
    expect(edge!.source).toContain("72-SMF 4800 S DIST: MAIN ST - I-15");
    expect(edge!.target).toContain("6 DROP (TSC): I-15 NB & 1600 S");
  });

  it("swaps endpoints when one cable crosses to the opposite side", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readLeftCsv("Left-SP-3254.5.csv")),
    );
    const overrides: LayoutOverrides = {
      reportKey: "sp-cross-flip",
      layoutVersion: 14,
      positions: {
        "cable-72-SMF 4800 S DIST: MAIN ST - I-15": { x: 80, y: 40 },
        "cable-6 DROP (TSC): I-15 NB & 1600 S": { x: 1380, y: 120 },
      },
      cableSides: {
        "72-SMF 4800 S DIST: MAIN ST - I-15": "left",
        "6 DROP (TSC): I-15 NB & 1600 S": "right",
      },
      layoutWidth: 1770,
      autoAdjustEnabled: true,
      routingEngine: "grid",
    };

    const { edges } = buildReactFlowGraph(
      graph,
      overrides,
      overrides.layoutWidth,
      { refreshColumnX: true },
    );

    const edge = spliceEdge(edges, GR_SL_CONN);
    expect(edge).toBeDefined();
    expect(edge!.source).toContain("72-SMF 4800 S DIST: MAIN ST - I-15");
    expect(edge!.target).toContain("6 DROP (TSC): I-15 NB & 1600 S");
  });
});
