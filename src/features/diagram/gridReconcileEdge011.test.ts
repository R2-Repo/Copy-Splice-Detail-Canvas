import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import {
  buildLayoutRuleContext,
  findSpliceOverlapPair,
} from "@/features/diagram/layoutRules";
import { routingLaneFromData } from "@/features/canvas/edges/splicePathGeometry";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import {
  LAYOUT_CONTRACT_CSVS,
  readReferenceCsv,
} from "@/testHelpers/layoutContractCsvPaths";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";

const STAGE_WIDTH = 1920;

function gridContext(label: string, csv: string) {
  const graph = buildConnectionGraph(parseBentleyCsv(csv));
  return buildLayoutRuleContext(
    graph,
    undefined,
    { reportKey: label, positions: {}, routingEngine: "grid" } as never,
    { stageWidth: STAGE_WIDTH },
  );
}

function laneDebugForOverlap(ctx: ReturnType<typeof buildLayoutRuleContext>) {
  const overlap = findSpliceOverlapPair(ctx);
  if (!overlap) return null;

  const pair = overlap.split(" :: ")[0]!;
  const [leftId, rightId] = pair.split(" vs ");
  const rows: unknown[] = [];

  for (const edge of ctx.reactFlow.edges) {
    if (edge.type !== "splice" || edge.id.startsWith("splice-right-")) continue;
    const connId = edge.id.replace(/^splice-left-/, "").replace(/^splice-/, "");
    if (connId !== leftId && connId !== rightId) continue;

    const lane = routingLaneFromData(edge.data as never);
    if (!lane) continue;

    rows.push({
      connId,
      lane,
      routingSourceHorizY: (edge.data as { routingSourceHorizY?: number })
        .routingSourceHorizY,
      routingTargetHorizY: (edge.data as { routingTargetHorizY?: number })
        .routingTargetHorizY,
    });
  }

  return { overlap, rows };
}

describe("grid reconcile EDGE-011 (example-3 + SPI)", () => {
  it("example-3: findSpliceOverlapPair is null after grid import", () => {
    const ctx = gridContext(
      "example-3",
      readReferenceCsv(LAYOUT_CONTRACT_CSVS.multiCable),
    );
    const debug = laneDebugForOverlap(ctx);
    expect(debug, JSON.stringify(debug, null, 2)).toBeNull();
  });

  it("SPI: findSpliceOverlapPair is null after grid import", () => {
    const ctx = gridContext(
      "left-spi-215_i-80",
      readLeftCsv("Left-SPI-215_I-80.csv"),
    );
    const debug = laneDebugForOverlap(ctx);
    expect(debug, JSON.stringify(debug, null, 2)).toBeNull();
  });

  it("overlap pairs carry routing Y offsets when stacked at natural Y", () => {
    for (const [label, load] of [
      ["example-3", () => readReferenceCsv(LAYOUT_CONTRACT_CSVS.multiCable)],
      ["left-spi-215_i-80", () => readLeftCsv("Left-SPI-215_I-80.csv")],
    ] as const) {
      const ctx = gridContext(label, load());
      const overlap = findSpliceOverlapPair(ctx);
      expect(overlap, label).toBeNull();
    }
  });
});
