import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import {
  evaluateSdcRouteNestingRules,
  evaluateSdcRouteNestingRulesForGrid,
} from "@/features/diagram/layoutRules";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { buildSdcRuleContext, runRules } from "@/features/rules";
import { buildSdcContextFromLayout } from "@/features/rules/buildSdcContext";
import { sdcRoute002 } from "@/features/rules/route002";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

describe("SDC-ROUTE-002 grid path", () => {
  for (const file of [
    "Left-SP-3254.5.csv",
    "Left-STATE_OFFICE.csv",
    "Left-SPI-215_I-80.csv",
  ] as const) {
    it(`${file}: grid nesting passes`, () => {
      const graph = buildConnectionGraph(parseBentleyCsv(readReferenceCsv(file)));
      const ctx = buildSdcRuleContext(graph, {
        overrides: { reportKey: file, positions: {}, routingEngine: "grid" },
      });
      const [result] = sdcRoute002.check(ctx);
      expect(result?.ok, result?.detail).toBe(true);
    });
  }

  it("grid and nodes nesting evaluators agree on STATE_OFFICE", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("Left-STATE_OFFICE.csv")),
    );
    const ctx = buildSdcRuleContext(graph, {
      overrides: {
        reportKey: "grid-route002",
        positions: {},
        routingEngine: "grid",
      },
    });
    const layoutCtx = buildSdcContextFromLayout(ctx);
    expect(layoutCtx).toBeDefined();
    const gridResults = evaluateSdcRouteNestingRulesForGrid(layoutCtx!);
    const nodesResults = evaluateSdcRouteNestingRules(layoutCtx!);
    expect(gridResults.map((r) => [r.id, r.ok])).toEqual(
      nodesResults.map((r) => [r.id, r.ok]),
    );
  });

  it("legacy examples use nodes nesting when routingEngine is nodes", () => {
    const csv = readFileSync(
      join(
        process.cwd(),
        "docs/reference/examples/old csv examples/CSV Splice Detail Example #1.csv",
      ),
      "utf8",
    );
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const ctx = buildSdcRuleContext(graph, {
      overrides: {
        reportKey: "example-1",
        positions: {},
        routingEngine: "nodes",
      },
    });
    const results = runRules(ctx, { only: ["SDC-ROUTE-002"] });
    expect(results.every((r) => r.ok)).toBe(true);
  });
});
