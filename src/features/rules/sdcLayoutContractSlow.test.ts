import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import {
  allRulesPass,
  buildSdcRuleContext,
  runRules,
} from "@/features/rules";

const legacyExamples = join(process.cwd(), "docs/reference/examples/old csv examples");

describe("SDC layout contract — slow production CSVs", () => {
  it("300N_MAIN passes all applicable SDC rules on grid routing", () => {
    const text = readFileSync(join(legacyExamples, "300N_MAIN.csv"), "utf8");
    const ctx = buildSdcRuleContext(buildConnectionGraph(parseBentleyCsv(text)), {
      overrides: { reportKey: "300n_main", positions: {}, routingEngine: "grid" },
      layoutWidth: 1920,
    });
    const results = runRules(ctx);
    const failed = results.filter((r) => !r.ok && r.severity === "fail");
    expect(
      failed,
      failed.map((f) => `${f.id}: ${f.detail}`).join("; "),
    ).toEqual([]);
    expect(allRulesPass(results)).toBe(true);
  }, 180_000);
});
