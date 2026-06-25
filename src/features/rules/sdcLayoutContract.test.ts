import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import {
  allRulesPass,
  buildSdcRuleContext,
  runImportRules,
  runRules,
  SDC_RULE_IDS,
  SDC_RULES,
} from "@/features/rules";
import {
  LAYOUT_CONTRACT_CSVS,
  readReferenceCsv,
} from "@/testHelpers/layoutContractCsvPaths";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";

const legacyExamples = join(process.cwd(), "docs/reference/examples/old csv examples");

function graphFromCsv(text: string) {
  return buildConnectionGraph(parseBentleyCsv(text));
}

function gridContext(reportKey: string, text: string) {
  return buildSdcRuleContext(graphFromCsv(text), {
    overrides: { reportKey, positions: {}, routingEngine: "grid" },
    layoutWidth: 1920,
  });
}

describe("SDC layout contract (grid engine)", () => {
  it("documents every active SDC rule ID", () => {
    expect(SDC_RULES.map((r) => r.id).sort()).toEqual([...SDC_RULE_IDS].sort());
  });

  const fixtures: Array<{ label: string; load: () => string; importOnly?: boolean }> = [
    {
      label: "example-1",
      load: () => readReferenceCsv(LAYOUT_CONTRACT_CSVS.ringCut),
    },
    {
      label: "example-2",
      load: () => readReferenceCsv(LAYOUT_CONTRACT_CSVS.dominantPair),
    },
    {
      label: "example-3",
      load: () => readReferenceCsv(LAYOUT_CONTRACT_CSVS.multiCable),
    },
    {
      label: "left-sp-3254.5",
      load: () => readLeftCsv("Left-SP-3254.5.csv"),
    },
    {
      label: "300n_main",
      load: () =>
        readFileSync(join(legacyExamples, "300N_MAIN.csv"), "utf8"),
      importOnly: true,
    },
  ];

  for (const fixture of fixtures) {
    describe(fixture.label, () => {
      it("passes import rules (DATA + ORDER)", () => {
        const ctx = buildSdcRuleContext(graphFromCsv(fixture.load()), {
          skipReactFlow: true,
        });
        const failed = runImportRules(ctx).filter((r) => !r.ok);
        expect(
          failed,
          failed.map((f) => `${f.id}: ${f.detail}`).join("; "),
        ).toEqual([]);
      });

      if (!fixture.importOnly) {
        it("passes all applicable SDC rules on grid routing", () => {
          const ctx = gridContext(fixture.label, fixture.load());
          const results = runRules(ctx);
          const failed = results.filter((r) => !r.ok && r.severity === "fail");
          expect(
            failed,
            failed.map((f) => `${f.id}: ${f.detail}`).join("; "),
          ).toEqual([]);
          expect(allRulesPass(results)).toBe(true);
        });
      }
    });
  }
});
