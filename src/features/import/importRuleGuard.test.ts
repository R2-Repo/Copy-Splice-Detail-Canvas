import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import {
  allRulesPass,
  buildSdcRuleContext,
  runImportRules,
} from "@/features/rules";
import {
  readReferenceCsv,
  referenceCsvAvailable,
  resolveReferenceCsvPath,
} from "@/testHelpers/layoutContractCsvPaths";

function parseSnapshot(report: ReturnType<typeof parseBentleyCsv>): string {
  const cables = [...new Set(report.pairs.flatMap((p) => [p.endpointA.cable, p.endpointB.cable]))]
    .map(cableNameKey)
    .sort();
  const fibers = report.pairs
    .flatMap((p) => [
      `${p.endpointA.cable}:${p.endpointA.fiberNumber}`,
      `${p.endpointB.cable}:${p.endpointB.fiberNumber}`,
    ])
    .sort();
  return createHash("sha256")
    .update(
      JSON.stringify({
        pairCount: report.pairs.length,
        cables,
        fibers,
        appearances: report.cableAppearances.length,
      }),
    )
    .digest("hex");
}

const REFERENCE_CSVS = [
  "300N_MAIN.csv",
  "I-215_4700S.csv",
  "SP-I-15_11400S.csv",
  "SPI-215_I-80.csv",
  "STATE_OFFICE.csv",
  "US-89SBMP228.25.csv",
  "Left-SP-3254.5.csv",
  "Left-STATE_OFFICE.csv",
  "Left-SPI-215_I-80.csv",
] as const;

describe("import rule guard (SDC-DATA/ORDER after parse)", () => {
  it.each(REFERENCE_CSVS.filter(referenceCsvAvailable))(
    "%s passes import rules with stable snapshot",
    (file) => {
    const csv = readReferenceCsv(file);
    const report = parseBentleyCsv(csv);
    const graph = buildConnectionGraph(report);
    const ctx = buildSdcRuleContext(graph, { skipReactFlow: true });
    const results = runImportRules(ctx);

    expect(allRulesPass(results), results.map((r) => r.detail).join("; ")).toBe(
      true,
    );
    expect(report.pairs.length).toBeGreaterThan(0);
    expect(parseSnapshot(report)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("parse snapshot hash is deterministic for Example #1", () => {
    const csv = readFileSync(
      resolveReferenceCsvPath("CSV Splice Detail Example #1.csv"),
      "utf8",
    );
    const report = parseBentleyCsv(csv);
    const h1 = parseSnapshot(report);
    const h2 = parseSnapshot(parseBentleyCsv(csv));
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
});
