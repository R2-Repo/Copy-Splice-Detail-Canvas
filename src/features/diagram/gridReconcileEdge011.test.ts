import { describe, expect, it } from "vitest";

import { routingLaneFromData } from "@/features/canvas/edges/splicePathGeometry";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import {
  buildLayoutRuleContext,
  findSpliceOverlapPair,
} from "@/features/diagram/layoutRules";
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

describe("grid reconcile EDGE-011 (example-3 + SPI)", () => {
  it("example-3: findSpliceOverlapPair is null after grid import", () => {
    const ctx = gridContext(
      "example-3",
      readReferenceCsv(LAYOUT_CONTRACT_CSVS.multiCable),
    );
    expect(findSpliceOverlapPair(ctx)).toBeNull();
  });

  it("SPI: findSpliceOverlapPair is null after grid import", () => {
    const ctx = gridContext(
      "left-spi-215_i-80",
      readLeftCsv("Left-SPI-215_I-80.csv"),
    );
    expect(findSpliceOverlapPair(ctx)).toBeNull();
  }, 600_000);

  it("SPI plain strand with source offset carries routing horiz Y on edge", () => {
    const ctx = gridContext(
      "left-spi-215_i-80",
      readLeftCsv("Left-SPI-215_I-80.csv"),
    );
    expect(findSpliceOverlapPair(ctx)).toBeNull();

    const plainConn =
      "288-SMF I-215 DIST: 500 S - I-80|44|BR|BK::288-SMF I-215 DIST: SR-201 - N TEMPLE NB|32|GR|BK";
    const edge = ctx.reactFlow.edges.find(
      (e) =>
        e.type === "splice" &&
        !e.id.startsWith("splice-right-") &&
        e.id.endsWith(plainConn),
    );
    const lane = routingLaneFromData(edge?.data as never);
    const data = edge?.data as {
      routingTargetHorizY?: number;
      routingSourceHorizY?: number;
    };
    expect(
      lane?.sourceHorizY ??
        lane?.targetHorizY ??
        data.routingSourceHorizY ??
        data.routingTargetHorizY,
    ).toBeDefined();
  }, 600_000);
});
