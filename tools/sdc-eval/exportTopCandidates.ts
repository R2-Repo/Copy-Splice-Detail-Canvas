import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import {
  existingIdsFromEdges,
  positionsFromNodes,
} from "@/features/canvas/layoutStorage";
import { buildDiagramConfigFromOverrides } from "@/features/export/buildDiagramConfigFromOverrides";
import { diagramConfigToJson } from "@/features/export/serializeDiagramConfig";
import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";
import {
  buildCanvasFromCandidate,
  candidateOverridePatch,
} from "@/features/layoutSearch/candidateToGraph";
import {
  candidateStableId,
  cloneGraphForCandidate,
  compareCandidates,
  deriveLayoutMode,
  type LayoutCandidate,
} from "@/features/layoutSearch/layoutCandidate";
import { evaluateLayoutCandidate } from "@/features/layoutSearch/evaluateCandidate";
import { buildSdcRuleContext } from "@/features/rules/buildSdcContext";
import { allRulesPass, runImportRules } from "@/features/rules/runRules";
import {
  INFEASIBLE_LAYOUT_SCORE,
  layoutSearch,
  seedFromReportKey,
} from "@/features/layoutSearch/layoutSearch";
import type { SerializableLayoutSearchConfig } from "@/features/layoutSearch/layoutSearchTypes";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

import { graphSummary, loadGraphFromInput } from "./graphJson";
import { ruleRejectCounts, serializeEvaluation, serializeViolations } from "./serialize";

export type ExportTopCandidatesInput = {
  graph?: import("./graphJson").GraphJson;
  csvPath?: string;
  csvText?: string;
  outDir: string;
  top?: number;
  sourceFileName?: string;
  config?: SerializableLayoutSearchConfig;
};

export type ExportedCandidateFile = {
  rank: number;
  fileName: string;
  filePath: string;
  candidateId: string;
  score: number;
  feasible: boolean;
  failedRuleIds: string[];
};

export type ExportTopCandidatesResult = {
  ok: true;
  command: "export-top";
  summary: ReturnType<typeof graphSummary>;
  wallMs: number;
  searchWallMs: number;
  evaluations: number;
  outDir: string;
  csvPath?: string;
  exports: ExportedCandidateFile[];
  candidates: Array<{
    rank: number;
    candidateId: string;
    score: number;
    feasible: boolean;
    evaluation?: ReturnType<typeof serializeEvaluation>;
  }>;
};

type ScoredCandidate = {
  candidate: LayoutCandidate;
  score: number;
  feasible: boolean;
  failedRuleIds: string[];
};

const LAYOUT_SIDES = ["left", "right", "top", "bottom"] as const;

function mutateCandidate(
  base: LayoutCandidate,
  cableName: string,
  variant: number,
): LayoutCandidate {
  const cableSides = { ...base.cableSides };
  const current = cableSides[cableName];
  const options = LAYOUT_SIDES.filter((s) => s !== current);
  cableSides[cableName] = options[variant % Math.max(options.length, 1)] ?? current;

  const stackOrder = {
    left: [] as string[],
    right: [] as string[],
    top: [] as string[],
    bottom: [] as string[],
  };
  for (const [cable, side] of Object.entries(cableSides)) {
    stackOrder[side].push(cable);
  }
  for (const side of LAYOUT_SIDES) {
    stackOrder[side].sort();
  }

  return {
    ...base,
    cableSides,
    stackOrder,
    id: undefined,
  };
}

function supplementTopCandidates(
  graph: ConnectionGraph,
  pool: ScoredCandidate[],
  topN: number,
  seedCandidate: LayoutCandidate,
): ScoredCandidate[] {
  if (pool.length >= topN) {
    return pool.slice(0, topN);
  }

  const byId = new Map<string, ScoredCandidate>();
  for (const entry of pool) {
    byId.set(candidateStableId(entry.candidate), entry);
  }

  const cableNames = Object.keys(
    pool[0]?.candidate.cableSides ?? seedCandidate.cableSides,
  );

  let attempt = 0;
  const maxAttempts = Math.max(32, topN * cableNames.length * 4);

  while (byId.size < topN && attempt < maxAttempts) {
    attempt += 1;
    const base =
      pool[attempt % Math.max(pool.length, 1)]?.candidate ??
      pool[0]!.candidate;
    const cable = cableNames[attempt % cableNames.length]!;
    const mutant = mutateCandidate(base, cable, attempt);
    const id = candidateStableId(mutant);
    if (byId.has(id)) continue;

    const evaluation = evaluateLayoutCandidate(graph, mutant);
    if (!evaluation.feasible) continue;
    byId.set(id, {
      candidate: { ...mutant, id },
      score: evaluation.score,
      feasible: evaluation.feasible,
      failedRuleIds: evaluation.violations.filter((v) => !v.ok).map((v) => v.id),
    });
  }

  return [...byId.values()]
    .sort((a, b) =>
      compareCandidates(
        { score: a.score, candidate: a.candidate },
        { score: b.score, candidate: b.candidate },
      ),
    )
    .slice(0, topN);
}

function scoreFeasible(score: number): boolean {
  return score < INFEASIBLE_LAYOUT_SCORE;
}

function collectTopCandidates(
  searchResult: ReturnType<typeof layoutSearch>,
  topN: number,
): ScoredCandidate[] {
  const byId = new Map<string, ScoredCandidate>();

  const add = (entry: {
    candidate: LayoutCandidate;
    score: number;
    feasible?: boolean;
    failedRuleIds?: string[];
  }) => {
    const id = candidateStableId(entry.candidate);
    const feasible = entry.feasible ?? scoreFeasible(entry.score);
    const existing = byId.get(id);
    if (
      existing &&
      compareCandidates(
        { score: existing.score, candidate: existing.candidate },
        { score: entry.score, candidate: entry.candidate },
      ) <= 0
    ) {
      return;
    }
    byId.set(id, {
      candidate: entry.candidate,
      score: entry.score,
      feasible,
      failedRuleIds: entry.failedRuleIds ?? [],
    });
  };

  for (const finalist of searchResult.finalists ?? []) {
    add(finalist);
  }

  add({
    candidate: searchResult.best,
    score: searchResult.bestScore,
    feasible: scoreFeasible(searchResult.bestScore),
    failedRuleIds:
      searchResult.winnerEvaluation?.violations
        ?.filter((v) => !v.ok)
        .map((v) => v.id) ?? [],
  });

  const pool = [...byId.values()].sort((a, b) =>
    compareCandidates(
      { score: a.score, candidate: a.candidate },
      { score: b.score, candidate: b.candidate },
    ),
  );

  return pool.slice(0, topN);
}

function paintCandidateConfig(
  graph: ConnectionGraph,
  candidate: ScoredCandidate,
  sourceFileName?: string,
): ReturnType<typeof buildDiagramConfigFromOverrides> {
  const reportKey = reportStorageKey(graph);
  const appliedGraph = cloneGraphForCandidate(graph, candidate.candidate);
  const baseOverrides: LayoutOverrides = {
    reportKey,
    positions: {},
    autoAdjustEnabled: true,
    collapseFullButtSplices: false,
    calloutsVisible: false,
    ...candidateOverridePatch(graph, candidate.candidate, reportKey),
  };

  const built = buildCanvasFromCandidate(
    graph,
    candidate.candidate,
    baseOverrides,
  );

  const layoutOverrides: LayoutOverrides = {
    ...baseOverrides,
    positions: positionsFromNodes(built.nodes),
    existingEdgeIds: existingIdsFromEdges(built.edges),
    layoutMode: deriveLayoutMode(candidate.candidate),
  };

  return buildDiagramConfigFromOverrides({
    graph: appliedGraph,
    nodes: built.nodes,
    edges: built.edges,
    layoutOverrides,
    sourceFileName,
    appVersion: "0.0.1",
  });
}

export function exportTopCandidates(
  input: ExportTopCandidatesInput,
): ExportTopCandidatesResult {
  const topN = Math.max(1, input.top ?? 5);
  const outDir = resolve(input.outDir);
  mkdirSync(outDir, { recursive: true });

  const graph = loadGraphFromInput(input);
  const importCtx = buildSdcRuleContext(graph, { skipReactFlow: true });
  const importViolations = runImportRules(importCtx);
  const importRules = {
    feasible: allRulesPass(importViolations),
    violations: serializeViolations(importViolations),
    ruleRejectCounts: ruleRejectCounts(importViolations),
  };
  const seed =
    input.config?.seed ?? seedFromReportKey(reportStorageKey(graph));
  const sourceFileName =
    input.sourceFileName ??
    (input.csvPath ? basename(input.csvPath) : undefined);

  const searchStart = performance.now();
  const searchResult = layoutSearch(graph, {
    ...input.config,
    seed,
  });
  const searchWallMs = performance.now() - searchStart;

  let ranked = collectTopCandidates(searchResult, topN);
  ranked = ranked.filter((r) => r.feasible);
  ranked = supplementTopCandidates(graph, ranked, topN, searchResult.best);
  ranked = ranked.filter((r) => r.feasible).slice(0, topN);

  const exports: ExportedCandidateFile[] = [];
  const candidateSummaries: ExportTopCandidatesResult["candidates"] = [];

  for (let i = 0; i < ranked.length; i++) {
    const entry = ranked[i]!;
    const rank = i + 1;
    const evaluation = evaluateLayoutCandidate(graph, entry.candidate);
    const config = paintCandidateConfig(graph, entry, sourceFileName);
    const fileName = `rank-${rank}.sdc.json`;
    const filePath = join(outDir, fileName);
    writeFileSync(filePath, `${diagramConfigToJson(config)}\n`, "utf8");

    exports.push({
      rank,
      fileName,
      filePath,
      candidateId: candidateStableId(entry.candidate),
      score: entry.score,
      feasible: evaluation.feasible,
      failedRuleIds: evaluation.violations.filter((v) => !v.ok).map((v) => v.id),
    });

    candidateSummaries.push({
      rank,
      candidateId: candidateStableId(entry.candidate),
      score: entry.score,
      feasible: evaluation.feasible,
      evaluation: serializeEvaluation(evaluation),
    });
  }

  const summaryPayload = {
    exportedAt: new Date().toISOString(),
    mode: "export-top",
    rulesEngine: "src/features/rules (TS)",
    csvPath: input.csvPath,
    sourceFileName,
    top: topN,
    timeBudgetMs: input.config?.timeBudgetMs ?? null,
    maxRounds: input.config?.maxRounds ?? null,
    importRules,
    searchWallMs,
    evaluations: searchResult.evaluations,
    bestScore: searchResult.bestScore,
    exports,
  };
  writeFileSync(
    join(outDir, "search-summary.json"),
    `${JSON.stringify(summaryPayload, null, 2)}\n`,
    "utf8",
  );

  return {
    ok: true,
    command: "export-top",
    summary: graphSummary(graph),
    wallMs: searchWallMs,
    searchWallMs,
    evaluations: searchResult.evaluations,
    outDir,
    csvPath: input.csvPath,
    exports,
    candidates: candidateSummaries,
  };
}
