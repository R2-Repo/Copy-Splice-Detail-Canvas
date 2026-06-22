import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { buildSdcRuleContext, runRules } from "@/features/rules";
import type { SdcRuleId } from "@/features/rules/types";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

const REFERENCE_FILES = [
  "Left-SP-3254.5.csv",
  "Left-STATE_OFFICE.csv",
  "Left-SPI-215_I-80.csv",
] as const;

/** Grid routing + layout invariants for reference CSVs (automated D4 slice). */
const GRID_D4_RULE_IDS = [
  "SDC-GRID-001",
  "SDC-ROUTE-002",
  "SDC-ROUTE-003",
  "SDC-LAYOUT-001",
  "SDC-LAYOUT-002",
  "SDC-UX-001",
] as const satisfies readonly SdcRuleId[];

/** Automated D4 slice: reference CSVs pass grid-specific SDC rules. */
describe("grid reference D4 contract", () => {
  for (const file of REFERENCE_FILES) {
    it(`${file}: grid routing SDC rules pass`, () => {
      const graph = buildConnectionGraph(parseBentleyCsv(readReferenceCsv(file)));
      const ctx = buildSdcRuleContext(graph, {
        overrides: { reportKey: file, positions: {} },
      });

      expect(ctx.grid).toBeDefined();
      expect(ctx.gridRoutes?.size).toBeGreaterThan(0);

      const results = runRules(ctx, { only: [...GRID_D4_RULE_IDS] });
      const failed = results.filter((r) => !r.ok && r.severity === "fail");
      expect(
        failed,
        failed.map((f) => `${f.id}: ${f.detail}`).join("; "),
      ).toEqual([]);
    });
  }
});
