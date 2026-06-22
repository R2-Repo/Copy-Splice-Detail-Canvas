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

const examples = join(process.cwd(), "docs/reference/examples");
const legacyExamples = join(examples, "old csv examples");

function graphFromExample(n: 1 | 2 | 3) {
  const csv = readFileSync(
    join(legacyExamples, `CSV Splice Detail Example #${n}.csv`),
    "utf8",
  );
  return buildConnectionGraph(parseBentleyCsv(csv));
}

describe("SDC rule registry", () => {
  it("documents every active SDC rule ID", () => {
    expect(SDC_RULES.map((r) => r.id).sort()).toEqual([...SDC_RULE_IDS].sort());
  });
});

describe("SDC import rules (post-parse, pre-layout)", () => {
  for (const n of [1, 2, 3] as const) {
    it(`Example #${n} passes DATA and ORDER rules`, () => {
      const ctx = buildSdcRuleContext(graphFromExample(n), { skipReactFlow: true });
      const results = runImportRules(ctx);
      const failed = results.filter((r) => !r.ok);
      expect(failed, failed.map((f) => `${f.id}: ${f.detail}`).join("; ")).toEqual(
        [],
      );
    });
  }
});

describe("SDC full contract (with layout)", () => {
  for (const n of [1, 2, 3] as const) {
    it(`Example #${n} passes applicable SDC rules`, () => {
      const ctx = buildSdcRuleContext(graphFromExample(n), {
        overrides: {
          reportKey: `example-${n}`,
          positions: {},
          routingEngine: "nodes",
        },
      });
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
