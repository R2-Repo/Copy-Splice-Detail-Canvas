import { describe, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";
import { layoutSearch } from "@/features/layoutSearch/layoutSearch";

/** Opt-in perf probe — not in smoke. */
describe("import perf probe", () => {
  it("example-2 wall time", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #2.csv")),
    );
    const start = performance.now();
    const result = layoutSearch(graph, { maxRounds: 2000, plateauRounds: 128 });
    const wallMs = Math.round(performance.now() - start);
    console.info(
      `[import-perf] example-2 evals=${result.evaluations} wallMs=${wallMs}`,
    );
  }, 120_000);

  it("Left-SP-3254.5 wall time", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readLeftCsv("Left-SP-3254.5.csv")),
    );
    const start = performance.now();
    const result = layoutSearch(graph, { maxRounds: 2000, plateauRounds: 128 });
    const wallMs = Math.round(performance.now() - start);
    console.info(
      `[import-perf] Left-SP-3254.5 evals=${result.evaluations} wallMs=${wallMs}`,
    );
  }, 180_000);
});
