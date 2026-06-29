import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

import { layoutSearchViaWorker } from "./layoutSearchClient";
import { seedFromReportKey } from "./layoutSearch";

describe("searchStats diagnostics slice", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_DEBUG_IMPORT_OPTIMIZER", "1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("worker importDiagnosticsSlice searchStats reflect beam search work", async () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #2.csv")),
    );
    const seed = seedFromReportKey(reportStorageKey(graph));
    const result = await layoutSearchViaWorker(
      graph,
      {
        seed,
        timeBudgetMs: 8_000,
        bruteForceMaxCables: 1,
      },
      {
        strandCount: graph.connections.length,
        cableCount: 4,
        evaluationBudget: 2000,
      },
    );
    const slice = result.importDiagnosticsSlice;

    expect(slice).toBeDefined();
    expect(result.evaluations).toBeGreaterThan(1);
    expect(slice!.searchStats.generated).toBeGreaterThan(0);
    expect(slice!.searchStats.evaluatedT0).toBeGreaterThan(0);
    expect(slice!.evalSubPhaseCounts.evaluateT0).toBeGreaterThan(0);
    expect(slice!.searchStats.evaluatedT0).toBe(
      slice!.evalSubPhaseCounts.evaluateT0,
    );
  }, 30_000);
});
