import { describe, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";
import { LEFT_REFERENCE_CSVS, readLeftCsv } from "@/testHelpers/leftCsvPaths";
import {
  adaptiveMaxRounds,
  DEFAULT_MAX_ROUNDS,
  layoutSearch,
} from "@/features/layoutSearch/layoutSearch";
import { importTimeBudgetMs } from "@/features/layoutSearch/importSearchConfig";
import { analyzeTopology } from "@/features/layoutSearch/topology/analyzeTopology";
import type { ConnectionGraph } from "@/types/splice";

function probeImportSearch(graph: ConnectionGraph) {
  const strandCount = graph.connections.length;
  const constraints = analyzeTopology(graph).constraints;
  return layoutSearch(graph, {
    maxRounds: adaptiveMaxRounds(constraints, DEFAULT_MAX_ROUNDS),
    plateauRounds: 128,
    timeBudgetMs: importTimeBudgetMs(strandCount),
  });
}

/** Opt-in perf probe — mirrors production import budgets; not in smoke. */
describe("import perf probe", () => {
  it("example-2 wall time", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #2.csv")),
    );
    const start = performance.now();
    const result = probeImportSearch(graph);
    const wallMs = Math.round(performance.now() - start);
    console.info(
      `[import-perf] example-2 evals=${result.evaluations} wallMs=${wallMs} feasible=${result.bestScore < Number.MAX_SAFE_INTEGER}`,
    );
  }, 180_000);

  for (const file of LEFT_REFERENCE_CSVS) {
    const probe = file.includes("SPI-215") ? it.skip : it;
    probe(`${file} wall time`, () => {
      const graph = buildConnectionGraph(parseBentleyCsv(readLeftCsv(file)));
      const start = performance.now();
      const result = probeImportSearch(graph);
      const wallMs = Math.round(performance.now() - start);
      console.info(
        `[import-perf] ${file} evals=${result.evaluations} wallMs=${wallMs} feasible=${result.bestScore < Number.MAX_SAFE_INTEGER}`,
      );
    }, 300_000);
  }
});
