import type { RuleResult } from "@/features/rules/types";

import {
  debugImportCandidatesEnabled,
  debugImportOptimizerEnabled,
  debugImportRulesEnabled,
  debugImportTimingEnabled,
  debugImportTopBottomEnabled,
} from "./importSearchConfig";
import {
  candidateStableId,
  sidesUsedCount,
  type LayoutCandidate,
  type LayoutSide,
} from "./layoutCandidate";
import type { SoftScoreBreakdown } from "./layoutScorer";

export type ImportPhaseName =
  | "parse"
  | "buildGraph"
  | "importRules"
  | "topology"
  | "heuristicCandidate"
  | "heuristicPaint"
  | "candidateGeneration"
  | "t0Evaluation"
  | "t1ProxyRouting"
  | "t2FullRouting"
  | "finalRuleValidation"
  | "applyWinner"
  | "fallback";

export type CandidateTier =
  | "generated"
  | "T0"
  | "T1"
  | "T2"
  | "finalist"
  | "winner";

export type CandidateSideSummary = {
  candidateId: string;
  sidesUsed: number;
  leftCount: number;
  rightCount: number;
  topCount: number;
  bottomCount: number;
  usesTop: boolean;
  usesBottom: boolean;
  cableSides: Record<string, LayoutSide>;
  stackOrder: Record<LayoutSide, string[]>;
};

export type CandidateScoreSummary = {
  candidateId: string;
  tier: CandidateTier;
  feasible: boolean;
  score: number;
  softScore?: Partial<SoftScoreBreakdown>;
  failedRules: Array<{
    id: string;
    severity: string;
    detail: string;
    objectIds?: string[];
  }>;
  timingMs?: number;
  reason?: string;
  usesTop?: boolean;
  usesBottom?: boolean;
};

export type ImportDiagnostics = {
  importId: string;
  reportKey?: string;
  startedAt: number;
  finishedAt?: number;
  totalMs?: number;

  graphStats?: {
    cableCount: number;
    connectionCount: number;
    fiberConnectionCount: number;
    tubeBundleCount?: number;
  };

  phaseTimings: Array<{
    phase: ImportPhaseName;
    startMs: number;
    endMs: number;
    durationMs: number;
  }>;

  searchStats: {
    generated: number;
    evaluatedT0: number;
    evaluatedT1: number;
    evaluatedT2: number;
    finalists: number;

    cacheHits: number;
    cacheMisses: number;

    horizontalOnlyGenerated: number;
    topGenerated: number;
    bottomGenerated: number;
    topOrBottomGenerated: number;

    topOrBottomReachedT0: number;
    topOrBottomReachedT1: number;
    topOrBottomReachedT2: number;
    topOrBottomFinalists: number;

    bestHorizontalScore?: number;
    bestTopBottomScore?: number;
  };

  evalSubPhaseMs: {
    buildReactFlowGraph: number;
    routeAllOnGrid: number;
    runRules: number;
    scoreLayoutEvaluation: number;
    evaluateT0: number;
    evaluateT1: number;
    evaluateT2: number;
  };

  evalSubPhaseCounts: {
    buildReactFlowGraph: number;
    routeAllOnGrid: number;
    runRules: number;
    scoreLayoutEvaluation: number;
    evaluateT0: number;
    evaluateT1: number;
    evaluateT2: number;
  };

  ruleRejectCounts: Record<string, number>;

  topCandidates: CandidateScoreSummary[];
  finalists: CandidateScoreSummary[];

  selected?: CandidateScoreSummary;
  fallback?: {
    used: boolean;
    reason: string;
    failedRuleIds?: string[];
  };
  recoverableSelection?: {
    selectionKind:
      | "fully-passing"
      | "best-recoverable"
      | "heuristic-best"
      | "search-failed";
    selectedCandidateId: string;
    isHeuristic: boolean;
    reason: string;
    weightedFallbackScore: number;
    hardFailureCount: number;
    routeZoneFailures: number;
    layoutLabelFanoutFailures: number;
    routingValidityFailures: number;
    comparisonVsHeuristic?: {
      heuristicCandidateId: string;
      heuristicPenalty: number;
      pickedPenalty: number;
      heuristicHardFails: number;
      pickedHardFails: number;
      heuristicWon: boolean;
    };
    rejected: Array<{
      candidateId: string;
      source: string;
      isHeuristic: boolean;
      whyLost: string;
      weightedFallbackScore: number;
      hardFailureCount: number;
    }>;
  };

  fastPath?: {
    used: boolean;
    heuristicPassed: boolean;
    backgroundSearch: boolean;
    backgroundSearchMs?: number;
    upgradedLayout?: boolean;
  };

  performanceBudget?: {
    enabled: boolean;
    warnThresholdMs: number;
    failThresholdMs: number;
    optimizerWallMs: number;
    warn: boolean;
    exceeded: boolean;
  };

  notes: string[];
};

/** Serializable slice produced inside the layout-search worker. */
export type ImportSearchDiagnosticsSlice = Pick<
  ImportDiagnostics,
  | "phaseTimings"
  | "searchStats"
  | "evalSubPhaseMs"
  | "evalSubPhaseCounts"
  | "ruleRejectCounts"
  | "topCandidates"
  | "finalists"
  | "selected"
  | "notes"
>;

declare global {
  interface Window {
    __SDC_LAST_IMPORT_DIAGNOSTICS__?: ImportDiagnostics;
    __SDC_IMPORT_DIAGNOSTICS_HISTORY__?: ImportDiagnostics[];
    __SDC_PRINT_LAST_IMPORT_DIAGNOSTICS__?: () => void;
  }
}

const HISTORY_MAX = 10;
/** Shared across duplicate worker bundle copies of this module. */
const GLOBAL_ACTIVE_SEARCH_DIAG_KEY = "__SDC_ACTIVE_SEARCH_DIAG__";

let nextImportId = 1;
let activeSession: ImportDiagnostics | null = null;
let activeSearchDiag: ImportDiagnostics | null = null;

/** First T0 eval per candidate id — drives generated / top-bottom generation counts. */
const t0SeenCandidateIds = new WeakMap<ImportDiagnostics, Set<string>>();

function setActiveSearchDiag(diag: ImportDiagnostics | null): void {
  activeSearchDiag = diag;
  if (typeof globalThis === "undefined") return;
  const globalRef = globalThis as Record<string, unknown>;
  if (diag) globalRef[GLOBAL_ACTIVE_SEARCH_DIAG_KEY] = diag;
  else delete globalRef[GLOBAL_ACTIVE_SEARCH_DIAG_KEY];
}

function readActiveSearchDiag(): ImportDiagnostics | null {
  if (typeof globalThis !== "undefined") {
    const globalRef = globalThis as Record<string, unknown>;
    const shared = globalRef[GLOBAL_ACTIVE_SEARCH_DIAG_KEY];
    if (shared && typeof shared === "object") {
      return shared as ImportDiagnostics;
    }
  }
  return activeSearchDiag;
}

/** When tier counters lag sub-phase timers, align before exporting the slice. */
function reconcileSearchStatsFromEvalCounts(diag: ImportDiagnostics): void {
  const counts = diag.evalSubPhaseCounts;
  const stats = diag.searchStats;
  if (stats.evaluatedT0 === 0 && counts.evaluateT0 > 0) {
    stats.evaluatedT0 = counts.evaluateT0;
  }
  if (stats.evaluatedT1 === 0 && counts.evaluateT1 > 0) {
    stats.evaluatedT1 = counts.evaluateT1;
  }
  if (stats.evaluatedT2 === 0 && counts.evaluateT2 > 0) {
    stats.evaluatedT2 = counts.evaluateT2;
  }
  // Generation counts are recorded on first T0 eval; fall back when worker slice split module state.
  if (stats.generated === 0 && stats.evaluatedT0 > 0) {
    stats.generated = stats.evaluatedT0;
  }
  if (stats.topOrBottomGenerated === 0 && stats.topOrBottomReachedT0 > 0) {
    stats.topOrBottomGenerated = stats.topOrBottomReachedT0;
  }
}

function noteFirstT0Generation(
  diag: ImportDiagnostics,
  candidate: LayoutCandidate,
): void {
  let seen = t0SeenCandidateIds.get(diag);
  if (!seen) {
    seen = new Set();
    t0SeenCandidateIds.set(diag, seen);
  }
  const id = candidate.id ?? candidateStableId(candidate);
  if (seen.has(id)) return;
  seen.add(id);
  recordCandidateGenerated(diag, candidate);
}

export function importDiagnosticsEnabled(): boolean {
  return (
    debugImportOptimizerEnabled() ||
    debugImportTimingEnabled() ||
    debugImportCandidatesEnabled() ||
    debugImportRulesEnabled() ||
    debugImportTopBottomEnabled()
  );
}

export function createImportDiagnostics(reportKey?: string): ImportDiagnostics {
  return {
    importId: `import-${nextImportId++}`,
    reportKey,
    startedAt: performance.now(),
    phaseTimings: [],
    searchStats: emptySearchStats(),
    evalSubPhaseMs: emptyEvalSubPhaseMs(),
    evalSubPhaseCounts: emptyEvalSubPhaseCounts(),
    ruleRejectCounts: {},
    topCandidates: [],
    finalists: [],
    notes: [],
  };
}

function emptySearchStats(): ImportDiagnostics["searchStats"] {
  return {
    generated: 0,
    evaluatedT0: 0,
    evaluatedT1: 0,
    evaluatedT2: 0,
    finalists: 0,
    cacheHits: 0,
    cacheMisses: 0,
    horizontalOnlyGenerated: 0,
    topGenerated: 0,
    bottomGenerated: 0,
    topOrBottomGenerated: 0,
    topOrBottomReachedT0: 0,
    topOrBottomReachedT1: 0,
    topOrBottomReachedT2: 0,
    topOrBottomFinalists: 0,
  };
}

function emptyEvalSubPhaseMs(): ImportDiagnostics["evalSubPhaseMs"] {
  return {
    buildReactFlowGraph: 0,
    routeAllOnGrid: 0,
    runRules: 0,
    scoreLayoutEvaluation: 0,
    evaluateT0: 0,
    evaluateT1: 0,
    evaluateT2: 0,
  };
}

function emptyEvalSubPhaseCounts(): ImportDiagnostics["evalSubPhaseCounts"] {
  return { ...emptyEvalSubPhaseMs() };
}

export function beginSearchDiagnostics(): ImportDiagnostics | null {
  if (!importDiagnosticsEnabled()) return null;
  const diag = createImportDiagnostics("layout-search");
  setActiveSearchDiag(diag);
  return diag;
}

export function getActiveSearchDiagnostics(): ImportDiagnostics | null {
  return readActiveSearchDiag();
}

export function endSearchDiagnostics(): ImportSearchDiagnosticsSlice | undefined {
  const diag = readActiveSearchDiag();
  if (!diag) return undefined;
  reconcileSearchStatsFromEvalCounts(diag);
  const slice = createSearchDiagnosticsSlice(diag);
  setActiveSearchDiag(null);
  return slice;
}

export function beginImportDiagnostics(reportKey?: string): ImportDiagnostics | null {
  if (!importDiagnosticsEnabled()) return null;
  activeSession = createImportDiagnostics(reportKey);
  return activeSession;
}

export function getActiveImportDiagnostics(): ImportDiagnostics | null {
  return activeSession;
}

export function candidateSideSummary(
  candidate: LayoutCandidate,
): CandidateSideSummary {
  const topCount = candidate.stackOrder.top.length;
  const bottomCount = candidate.stackOrder.bottom.length;
  return {
    candidateId: candidate.id ?? candidateStableId(candidate),
    sidesUsed: sidesUsedCount(candidate),
    leftCount: candidate.stackOrder.left.length,
    rightCount: candidate.stackOrder.right.length,
    topCount,
    bottomCount,
    usesTop: topCount > 0,
    usesBottom: bottomCount > 0,
    cableSides: { ...candidate.cableSides },
    stackOrder: {
      left: [...candidate.stackOrder.left],
      right: [...candidate.stackOrder.right],
      top: [...candidate.stackOrder.top],
      bottom: [...candidate.stackOrder.bottom],
    },
  };
}

function candidateUsesTopOrBottom(candidate: LayoutCandidate): boolean {
  return (
    candidate.stackOrder.top.length > 0 ||
    candidate.stackOrder.bottom.length > 0
  );
}

function isHorizontalOnly(candidate: LayoutCandidate): boolean {
  return (
    candidate.stackOrder.top.length === 0 &&
    candidate.stackOrder.bottom.length === 0
  );
}

function failedRulesFromResults(
  violations: RuleResult[],
): CandidateScoreSummary["failedRules"] {
  return violations
    .filter((r) => !r.ok)
    .map((r) => ({
      id: r.id,
      severity: r.severity,
      detail: r.detail ?? "",
      objectIds: r.objectIds,
    }));
}

export function recordPhaseTiming(
  diag: ImportDiagnostics,
  phase: ImportPhaseName,
  startMs: number,
  endMs: number,
): void {
  diag.phaseTimings.push({
    phase,
    startMs,
    endMs,
    durationMs: Math.round(endMs - startMs),
  });
}

export function timePhase<T>(
  diag: ImportDiagnostics | null | undefined,
  phase: ImportPhaseName,
  fn: () => T,
): T {
  if (!diag) return fn();
  const startMs = performance.now();
  try {
    return fn();
  } finally {
    recordPhaseTiming(diag, phase, startMs, performance.now());
  }
}

export async function timePhaseAsync<T>(
  diag: ImportDiagnostics | null | undefined,
  phase: ImportPhaseName,
  fn: () => Promise<T>,
): Promise<T> {
  if (!diag) return fn();
  const startMs = performance.now();
  try {
    return await fn();
  } finally {
    recordPhaseTiming(diag, phase, startMs, performance.now());
  }
}

export function recordGraphStats(
  diag: ImportDiagnostics,
  stats: {
    cableCount: number;
    connectionCount: number;
    fiberConnectionCount: number;
  },
): void {
  diag.graphStats = stats;
}

export function recordCandidateGenerated(
  diag: ImportDiagnostics,
  candidate: LayoutCandidate,
): void {
  diag.searchStats.generated += 1;
  const usesTop = candidate.stackOrder.top.length > 0;
  const usesBottom = candidate.stackOrder.bottom.length > 0;
  if (usesTop) diag.searchStats.topGenerated += 1;
  if (usesBottom) diag.searchStats.bottomGenerated += 1;
  if (usesTop || usesBottom) {
    diag.searchStats.topOrBottomGenerated += 1;
  } else {
    diag.searchStats.horizontalOnlyGenerated += 1;
  }
}

export function recordCacheAccess(
  diag: ImportDiagnostics,
  hit: boolean,
): void {
  if (hit) diag.searchStats.cacheHits += 1;
  else diag.searchStats.cacheMisses += 1;
}

export function recordRuleFailures(
  diag: ImportDiagnostics,
  violations: RuleResult[],
): void {
  if (!debugImportRulesEnabled() && !debugImportOptimizerEnabled()) return;

  for (const r of violations) {
    if (r.ok || r.severity !== "fail") continue;
    diag.ruleRejectCounts[r.id] = (diag.ruleRejectCounts[r.id] ?? 0) + 1;
  }
}

export function recordRuleReject(diag: ImportDiagnostics, ruleId: string): void {
  diag.ruleRejectCounts[ruleId] = (diag.ruleRejectCounts[ruleId] ?? 0) + 1;
}

export function recordFastPath(
  diag: ImportDiagnostics,
  partial: Partial<NonNullable<ImportDiagnostics["fastPath"]>>,
): void {
  diag.fastPath = {
    used: false,
    heuristicPassed: false,
    backgroundSearch: false,
    ...diag.fastPath,
    ...partial,
  };
}

export function recordPerformanceBudget(
  diag: ImportDiagnostics,
  result: NonNullable<ImportDiagnostics["performanceBudget"]>,
): void {
  diag.performanceBudget = result;
}

function updateBestScores(
  diag: ImportDiagnostics,
  candidate: LayoutCandidate,
  score: number,
  feasible: boolean,
): void {
  if (!feasible || score >= Number.MAX_SAFE_INTEGER) return;
  if (isHorizontalOnly(candidate)) {
    if (
      diag.searchStats.bestHorizontalScore === undefined ||
      score < diag.searchStats.bestHorizontalScore
    ) {
      diag.searchStats.bestHorizontalScore = score;
    }
  } else if (candidateUsesTopOrBottom(candidate)) {
    if (
      diag.searchStats.bestTopBottomScore === undefined ||
      score < diag.searchStats.bestTopBottomScore
    ) {
      diag.searchStats.bestTopBottomScore = score;
    }
  }
}

function maybeTrackTopCandidate(
  diag: ImportDiagnostics,
  summary: CandidateScoreSummary,
): void {
  const limit = 8;
  diag.topCandidates.push(summary);
  diag.topCandidates.sort((a, b) => a.score - b.score);
  if (diag.topCandidates.length > limit) {
    diag.topCandidates.length = limit;
  }
}

export function recordCandidateEvaluated(
  diag: ImportDiagnostics,
  candidate: LayoutCandidate,
  tier: CandidateTier,
  result: {
    feasible: boolean;
    score: number;
    violations?: RuleResult[];
    softScore?: Partial<SoftScoreBreakdown>;
    timingMs?: number;
    reason?: string;
  },
): void {
  const usesTb = candidateUsesTopOrBottom(candidate);

  if (tier === "T0") {
    noteFirstT0Generation(diag, candidate);
    diag.searchStats.evaluatedT0 += 1;
    if (usesTb) diag.searchStats.topOrBottomReachedT0 += 1;
  } else if (tier === "T1") {
    diag.searchStats.evaluatedT1 += 1;
    if (usesTb) diag.searchStats.topOrBottomReachedT1 += 1;
  } else if (tier === "T2") {
    diag.searchStats.evaluatedT2 += 1;
    if (usesTb) diag.searchStats.topOrBottomReachedT2 += 1;
  }

  updateBestScores(diag, candidate, result.score, result.feasible);

  const violations = result.violations ?? [];
  if (violations.length > 0) {
    recordRuleFailures(diag, violations);
  }

  const summary: CandidateScoreSummary = {
    candidateId: candidate.id ?? candidateStableId(candidate),
    tier,
    feasible: result.feasible,
    score: result.score,
    softScore: result.softScore,
    failedRules: failedRulesFromResults(violations),
    timingMs: result.timingMs,
    reason: result.reason,
    usesTop: candidate.stackOrder.top.length > 0,
    usesBottom: candidate.stackOrder.bottom.length > 0,
  };

  if (
    debugImportCandidatesEnabled() ||
    debugImportOptimizerEnabled() ||
    tier === "T2" ||
    tier === "finalist"
  ) {
    maybeTrackTopCandidate(diag, summary);
  }
}

export function recordFinalist(
  diag: ImportDiagnostics,
  candidate: LayoutCandidate,
  result: {
    feasible: boolean;
    score: number;
    violations?: RuleResult[];
    softScore?: Partial<SoftScoreBreakdown>;
  },
): void {
  diag.searchStats.finalists += 1;
  if (candidateUsesTopOrBottom(candidate)) {
    diag.searchStats.topOrBottomFinalists += 1;
  }

  const summary: CandidateScoreSummary = {
    candidateId: candidate.id ?? candidateStableId(candidate),
    tier: "finalist",
    feasible: result.feasible,
    score: result.score,
    softScore: result.softScore,
    failedRules: failedRulesFromResults(result.violations ?? []),
    usesTop: candidate.stackOrder.top.length > 0,
    usesBottom: candidate.stackOrder.bottom.length > 0,
  };
  diag.finalists.push(summary);
}

export function recordWinner(
  diag: ImportDiagnostics,
  candidate: LayoutCandidate,
  result: {
    feasible: boolean;
    score: number;
    violations?: RuleResult[];
    softScore?: Partial<SoftScoreBreakdown>;
    reason?: string;
  },
): void {
  diag.selected = {
    candidateId: candidate.id ?? candidateStableId(candidate),
    tier: "winner",
    feasible: result.feasible,
    score: result.score,
    softScore: result.softScore,
    failedRules: failedRulesFromResults(result.violations ?? []),
    reason: result.reason,
    usesTop: candidate.stackOrder.top.length > 0,
    usesBottom: candidate.stackOrder.bottom.length > 0,
  };
}

export function recordFallback(
  diag: ImportDiagnostics,
  reason: string,
  failedRuleIds?: string[],
): void {
  diag.fallback = { used: true, reason, failedRuleIds };
}

export function recordRecoverableSelection(
  diag: ImportDiagnostics,
  result: NonNullable<ImportDiagnostics["recoverableSelection"]>,
): void {
  diag.recoverableSelection = result;
  if (
    result.selectionKind === "best-recoverable" ||
    result.selectionKind === "heuristic-best"
  ) {
    diag.fallback = {
      used: true,
      reason: result.reason,
      failedRuleIds: result.hardFailureCount > 0
        ? [`${result.hardFailureCount} hard failure(s)`]
        : undefined,
    };
  }
}

export function recordEvalSubPhase(
  diag: ImportDiagnostics,
  phase: keyof ImportDiagnostics["evalSubPhaseMs"],
  durationMs: number,
): void {
  diag.evalSubPhaseMs[phase] += durationMs;
  diag.evalSubPhaseCounts[phase] += 1;
}

export function mergeSearchDiagnosticsSlice(
  diag: ImportDiagnostics,
  slice: ImportSearchDiagnosticsSlice,
): void {
  diag.phaseTimings.push(...slice.phaseTimings);
  mergeSearchStats(diag.searchStats, slice.searchStats);
  mergeEvalSubPhase(diag.evalSubPhaseMs, slice.evalSubPhaseMs);
  mergeEvalSubPhase(diag.evalSubPhaseCounts, slice.evalSubPhaseCounts);
  for (const [id, count] of Object.entries(slice.ruleRejectCounts)) {
    diag.ruleRejectCounts[id] = (diag.ruleRejectCounts[id] ?? 0) + count;
  }
  diag.topCandidates.push(...slice.topCandidates);
  diag.topCandidates.sort((a, b) => a.score - b.score);
  if (diag.topCandidates.length > 8) diag.topCandidates.length = 8;
  diag.finalists.push(...slice.finalists);
  if (slice.selected) diag.selected = slice.selected;
  diag.notes.push(...slice.notes);
}

function mergeSearchStats(
  target: ImportDiagnostics["searchStats"],
  source: ImportDiagnostics["searchStats"],
): void {
  target.generated += source.generated;
  target.evaluatedT0 += source.evaluatedT0;
  target.evaluatedT1 += source.evaluatedT1;
  target.evaluatedT2 += source.evaluatedT2;
  target.finalists += source.finalists;
  target.cacheHits += source.cacheHits;
  target.cacheMisses += source.cacheMisses;
  target.horizontalOnlyGenerated += source.horizontalOnlyGenerated;
  target.topGenerated += source.topGenerated;
  target.bottomGenerated += source.bottomGenerated;
  target.topOrBottomGenerated += source.topOrBottomGenerated;
  target.topOrBottomReachedT0 += source.topOrBottomReachedT0;
  target.topOrBottomReachedT1 += source.topOrBottomReachedT1;
  target.topOrBottomReachedT2 += source.topOrBottomReachedT2;
  target.topOrBottomFinalists += source.topOrBottomFinalists;

  if (source.bestHorizontalScore !== undefined) {
    if (
      target.bestHorizontalScore === undefined ||
      source.bestHorizontalScore < target.bestHorizontalScore
    ) {
      target.bestHorizontalScore = source.bestHorizontalScore;
    }
  }
  if (source.bestTopBottomScore !== undefined) {
    if (
      target.bestTopBottomScore === undefined ||
      source.bestTopBottomScore < target.bestTopBottomScore
    ) {
      target.bestTopBottomScore = source.bestTopBottomScore;
    }
  }
}

function mergeEvalSubPhase(
  target: ImportDiagnostics["evalSubPhaseMs"],
  source: ImportDiagnostics["evalSubPhaseMs"],
): void {
  for (const key of Object.keys(source) as Array<keyof ImportDiagnostics["evalSubPhaseMs"]>) {
    target[key] += source[key];
  }
}

export function createSearchDiagnosticsSlice(
  diag: ImportDiagnostics,
): ImportSearchDiagnosticsSlice {
  return {
    phaseTimings: [...diag.phaseTimings],
    searchStats: { ...diag.searchStats },
    evalSubPhaseMs: { ...diag.evalSubPhaseMs },
    evalSubPhaseCounts: { ...diag.evalSubPhaseCounts },
    ruleRejectCounts: { ...diag.ruleRejectCounts },
    topCandidates: [...diag.topCandidates],
    finalists: [...diag.finalists],
    selected: diag.selected ? { ...diag.selected } : undefined,
    notes: [...diag.notes],
  };
}

function appendTopBottomNotes(diag: ImportDiagnostics): void {
  if (!debugImportTopBottomEnabled() && !debugImportOptimizerEnabled()) return;

  const s = diag.searchStats;
  const triedTopBottom =
    s.topOrBottomReachedT0 > 0 || s.topOrBottomGenerated > 0;
  if (!triedTopBottom) {
    diag.notes.push("WARNING: no top/bottom candidates tried at T0.");
    return;
  }
  if (s.topOrBottomReachedT1 === 0 && s.topOrBottomReachedT0 > 0) {
    const topReasons = Object.entries(diag.ruleRejectCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => `${id} (${count})`)
      .join(", ");
    diag.notes.push(
      `WARNING: top/bottom candidates generated but rejected before T1.${topReasons ? ` Top rejections: ${topReasons}` : ""}`,
    );
  }
  if (s.topOrBottomReachedT2 > 0 && s.topOrBottomFinalists === 0) {
    diag.notes.push(
      "INFO: top/bottom reached final routing but lost on score.",
    );
  }
}

function phaseTimingRows(diag: ImportDiagnostics): Record<string, number> {
  const rows: Record<string, number> = {};
  for (const p of diag.phaseTimings) {
    rows[p.phase] = (rows[p.phase] ?? 0) + p.durationMs;
  }
  return rows;
}

function evalCostRows(diag: ImportDiagnostics): Record<string, string> {
  const rows: Record<string, string> = {};
  const tiers: Array<keyof ImportDiagnostics["evalSubPhaseMs"]> = [
    "evaluateT0",
    "evaluateT1",
    "evaluateT2",
    "buildReactFlowGraph",
    "routeAllOnGrid",
    "runRules",
    "scoreLayoutEvaluation",
  ];
  for (const tier of tiers) {
    const total = diag.evalSubPhaseMs[tier];
    const count = diag.evalSubPhaseCounts[tier];
    if (count > 0) {
      rows[tier] = `${Math.round(total)}ms total, avg ${(total / count).toFixed(1)}ms (n=${count})`;
    }
  }
  return rows;
}

function topBottomSummaryRows(diag: ImportDiagnostics): Record<string, number | string> {
  const s = diag.searchStats;
  return {
    "horizontal only generated": s.horizontalOnlyGenerated,
    "uses top generated": s.topGenerated,
    "uses bottom generated": s.bottomGenerated,
    "uses top or bottom generated": s.topOrBottomGenerated,
    "top/bottom reached T0": s.topOrBottomReachedT0,
    "top/bottom reached T1": s.topOrBottomReachedT1,
    "top/bottom reached T2": s.topOrBottomReachedT2,
    "top/bottom finalists": s.topOrBottomFinalists,
    "best horizontal score": s.bestHorizontalScore ?? "—",
    "best top/bottom score": s.bestTopBottomScore ?? "—",
    "winner uses top":
      diag.selected?.usesTop === undefined ? "—" : String(diag.selected.usesTop),
    "winner uses bottom":
      diag.selected?.usesBottom === undefined
        ? "—"
        : String(diag.selected.usesBottom),
    "winner reason": diag.selected?.reason ?? "—",
  };
}

export function printImportDiagnostics(diag: ImportDiagnostics): void {
  const label = diag.reportKey ?? diag.importId;
  const totalMs = diag.totalMs ?? Math.round(performance.now() - diag.startedAt);

  console.groupCollapsed(`[import optimizer] ${label} ${totalMs}ms`);

  console.log("Phase timings:");
  console.table(phaseTimingRows(diag));

  console.log("Search stats:");
  console.table(diag.searchStats);

  console.log("Evaluation cost:");
  console.table(evalCostRows(diag));

  if (debugImportTopBottomEnabled() || debugImportOptimizerEnabled()) {
    console.log("[import optimizer] top/bottom summary");
    console.table(topBottomSummaryRows(diag));
  }

  if (Object.keys(diag.ruleRejectCounts).length > 0) {
    console.log("Rule reject counts:");
    console.table(diag.ruleRejectCounts);
  }

  if (diag.finalists.length > 0) {
    console.log("Finalists:");
    console.table(
      diag.finalists.map((f, i) => ({
        rank: i + 1,
        id: f.candidateId,
        score: f.score,
        feasible: f.feasible,
        usesTop: f.usesTop,
        usesBottom: f.usesBottom,
        failed: f.failedRules.map((r) => r.id).join(", ") || "—",
      })),
    );
  }

  if (diag.topCandidates.length > 0 && debugImportCandidatesEnabled()) {
    console.log("Best-scoring candidates (not top-edge only):");
    console.table(
      diag.topCandidates.map((c) => ({
        id: c.candidateId,
        tier: c.tier,
        score: c.score,
        feasible: c.feasible,
        usesTop: c.usesTop,
        usesBottom: c.usesBottom,
        crossings: c.softScore?.crossings,
        loopbacks: c.softScore?.sameSideLoopbacks,
        failed: c.failedRules.map((r) => r.id).join(", ") || "—",
      })),
    );
  }

  if (diag.fallback?.used) {
    console.log("Fallback:", diag.fallback);
  }

  if (diag.recoverableSelection) {
    console.log("[import optimizer] recoverable selection:");
    console.table({
      kind: diag.recoverableSelection.selectionKind,
      candidate: diag.recoverableSelection.selectedCandidateId,
      heuristic: diag.recoverableSelection.isHeuristic,
      reason: diag.recoverableSelection.reason,
      penalty: diag.recoverableSelection.weightedFallbackScore,
      hardFails: diag.recoverableSelection.hardFailureCount,
    });
    if (diag.recoverableSelection.comparisonVsHeuristic) {
      console.log("vs heuristic:", diag.recoverableSelection.comparisonVsHeuristic);
    }
    if (diag.recoverableSelection.rejected.length > 0) {
      console.log("Rejected candidates:");
      console.table(diag.recoverableSelection.rejected);
    }
  }

  for (const note of diag.notes) {
    console.log(note);
  }

  console.log("Full diagnostics:", diag);
  console.groupEnd();
}

export function installDiagnosticsWindowApi(): void {
  if (typeof window === "undefined") return;
  window.__SDC_PRINT_LAST_IMPORT_DIAGNOSTICS__ = () => {
    const diag = window.__SDC_LAST_IMPORT_DIAGNOSTICS__;
    if (!diag) {
      console.warn("[import optimizer] no diagnostics recorded yet");
      return;
    }
    printImportDiagnostics(diag);
  };
}

export function flushImportDiagnostics(diag: ImportDiagnostics): void {
  appendTopBottomNotes(diag);
  diag.finishedAt = performance.now();
  diag.totalMs = Math.round(diag.finishedAt - diag.startedAt);

  if (typeof window !== "undefined") {
    installDiagnosticsWindowApi();
    window.__SDC_LAST_IMPORT_DIAGNOSTICS__ = diag;
    const history = window.__SDC_IMPORT_DIAGNOSTICS_HISTORY__ ?? [];
    history.push(diag);
    if (history.length > HISTORY_MAX) history.shift();
    window.__SDC_IMPORT_DIAGNOSTICS_HISTORY__ = history;
  }

  if (debugImportOptimizerEnabled() || debugImportTimingEnabled()) {
    printImportDiagnostics(diag);
  }
}

export function finishImportDiagnostics(): void {
  if (!activeSession) return;
  flushImportDiagnostics(activeSession);
  activeSession = null;
}
