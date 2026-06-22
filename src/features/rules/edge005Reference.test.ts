import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import {
  evaluateSdcRouteNestingRules,
  packedMidXViolationsForContext,
} from "@/features/diagram/layoutRules";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { buildSdcRuleContext } from "@/features/rules/buildSdcContext";
import { buildSdcContextFromLayout } from "@/features/rules/buildSdcContext";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

const REFERENCE_FILES = [
  "Left-SP-3254.5.csv",
  "Left-STATE_OFFICE.csv",
  "Left-SPI-215_I-80.csv",
] as const;

/** Reference CSV EDGE-005 — grid and nodes engines agree. */
describe("reference CSV EDGE-005 contract", () => {
  for (const file of REFERENCE_FILES) {
    it(`${file}: passes EDGE-005 on grid and nodes`, () => {
      const graph = buildConnectionGraph(parseBentleyCsv(readReferenceCsv(file)));
      for (const routingEngine of ["grid", "nodes"] as const) {
        const ctx = buildSdcRuleContext(graph, {
          overrides: { reportKey: file, positions: {}, routingEngine },
        });
        const layoutCtx = buildSdcContextFromLayout(ctx)!;
        const edge005 = evaluateSdcRouteNestingRules(layoutCtx).find(
          (r) => r.id === "EDGE-005",
        );
        expect(
          edge005?.ok,
          `${routingEngine}: ${packedMidXViolationsForContext(layoutCtx).join("; ")}`,
        ).toBe(true);
      }
    });
  }
});
