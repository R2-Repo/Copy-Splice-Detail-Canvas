import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { heuristicBaselineCandidate } from "./layoutCandidate";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

import {
  beginImportDiagnostics,
  beginSearchDiagnostics,
  createImportDiagnostics,
  endSearchDiagnostics,
  finishImportDiagnostics,
  getActiveSearchDiagnostics,
  importDiagnosticsEnabled,
  recordCandidateEvaluated,
  recordCandidateGenerated,
  recordPhaseTiming,
  timePhase,
} from "./importDiagnostics";

describe("importDiagnostics", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_DEBUG_IMPORT_OPTIMIZER", "1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    finishImportDiagnostics();
  });

  it("importDiagnosticsEnabled is true when master flag set", () => {
    expect(importDiagnosticsEnabled()).toBe(true);
  });

  it("importDiagnosticsEnabled is false when no flags set", () => {
    vi.stubEnv("VITE_DEBUG_IMPORT_OPTIMIZER", "");
    expect(importDiagnosticsEnabled()).toBe(false);
  });

  it("timePhase records duration", () => {
    const diag = createImportDiagnostics("test-key");
    timePhase(diag, "parse", () => {
      /* sync work */
    });
    expect(diag.phaseTimings).toHaveLength(1);
    expect(diag.phaseTimings[0]?.phase).toBe("parse");
    expect(diag.phaseTimings[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("recordCandidateGenerated tracks top/bottom counts", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #2.csv")),
    );
    const diag = createImportDiagnostics();
    const baseline = heuristicBaselineCandidate(graph);
    recordCandidateGenerated(diag, baseline);
    expect(diag.searchStats.generated).toBe(1);
    expect(diag.searchStats.horizontalOnlyGenerated).toBe(1);

    const quad = {
      ...baseline,
      stackOrder: {
        ...baseline.stackOrder,
        top: ["cable-a"],
      },
    };
    recordCandidateGenerated(diag, quad);
    expect(diag.searchStats.topOrBottomGenerated).toBe(1);
  });

  it("beginImportDiagnostics exposes session and finish clears it", () => {
    const session = beginImportDiagnostics("report-1");
    expect(session?.reportKey).toBe("report-1");
    recordPhaseTiming(session!, "parse", 0, 10);
    finishImportDiagnostics();
    vi.stubEnv("VITE_DEBUG_IMPORT_OPTIMIZER", "");
    expect(beginImportDiagnostics()).toBeNull();
    vi.stubEnv("VITE_DEBUG_IMPORT_OPTIMIZER", "1");
  });

  it("recordCandidateEvaluated increments tier counts", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #2.csv")),
    );
    const diag = createImportDiagnostics();
    const candidate = heuristicBaselineCandidate(graph);
    recordCandidateEvaluated(diag, candidate, "T0", {
      feasible: true,
      score: 1000,
    });
    expect(diag.searchStats.evaluatedT0).toBe(1);
  });

  it("endSearchDiagnostics reconciles tier counts from eval sub-phases", () => {
    beginSearchDiagnostics();
    const diag = getActiveSearchDiagnostics()!;
    diag.evalSubPhaseCounts.evaluateT0 = 12;
    diag.evalSubPhaseCounts.evaluateT1 = 4;
    const slice = endSearchDiagnostics();
    expect(slice?.searchStats.evaluatedT0).toBe(12);
    expect(slice?.searchStats.evaluatedT1).toBe(4);
  });
});
