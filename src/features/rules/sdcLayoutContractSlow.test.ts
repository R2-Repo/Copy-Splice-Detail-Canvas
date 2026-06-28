import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { allRulesPass, runImportRules } from "@/features/rules";
import { buildSdcRuleContext } from "@/features/rules/buildSdcContext";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";
import {
  shouldSkipGridRulesForFixture,
  skipReasonForFixture,
} from "@/testHelpers/knownLayoutIssues";
import { evaluateSearchLayoutForFixture } from "@/testHelpers/searchLayoutContext";

function graphFromLeftCsv(name: "Left-SPI-215_I-80.csv") {
  return buildConnectionGraph(parseBentleyCsv(readLeftCsv(name)));
}

describe("SDC layout contract — slow production CSVs (search-produced)", () => {
  it("Left-SPI-215_I-80 passes import rules (DATA + ORDER)", () => {
    const ctx = buildSdcRuleContext(graphFromLeftCsv("Left-SPI-215_I-80.csv"), {
      skipReactFlow: true,
    });
    const failed = runImportRules(ctx).filter((r) => !r.ok);
    expect(
      failed,
      failed.map((f) => `${f.id}: ${f.detail}`).join("; "),
    ).toEqual([]);
  });

  const label = "left-spi-215_i-80";
  const skipGrid = shouldSkipGridRulesForFixture(label);
  const gridTest = skipGrid ? it.skip : it;

  gridTest(
    `Left-SPI-215_I-80 passes all applicable SDC rules on search-produced layout${skipGrid ? ` (${skipReasonForFixture(label)})` : ""}`,
    () => {
      const graph = graphFromLeftCsv("Left-SPI-215_I-80.csv");
      const { evaluation } = evaluateSearchLayoutForFixture(graph, label, {
        maxRounds: 500,
        plateauRounds: 64,
        timeBudgetMs: 180_000,
      });
      const failed = evaluation.violations.filter(
        (r) => !r.ok && r.severity === "fail",
      );
      expect(
        failed,
        failed.map((f) => `${f.id}: ${f.detail}`).join("; "),
      ).toEqual([]);
      expect(evaluation.feasible).toBe(true);
      expect(allRulesPass(evaluation.violations)).toBe(true);

      const scoreRule = evaluation.violations.find((r) => r.id === "SDC-SCORE-001");
      expect(scoreRule?.ok).toBe(true);
      expect(scoreRule?.detail).toMatch(/^soft=/);
    },
    600_000,
  );
});
