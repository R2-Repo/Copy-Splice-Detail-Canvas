import type { RuleResult, SdcRuleId } from "@/features/rules/types";

import type { LayoutEvaluationResult } from "./evaluateCandidate";
import {
  candidateStableId,
  type LayoutCandidate,
} from "./layoutCandidate";
import type { RankedFinalist } from "./layoutSearchTypes";
import type { SoftScoreBreakdown } from "./layoutScorer";
import type { ImportDiagnostics } from "./importDiagnostics";
import { recordRecoverableSelection, recordWinner } from "./importDiagnostics";

/** Weighted rule penalties for recoverable fallback ranking (lower is better). */
export const RECOVERABLE_RULE_PENALTIES: Partial<Record<SdcRuleId, number>> = {
  "SDC-LAYOUT-002": 1000,
  "SDC-LAYOUT-003": 900,
  "SDC-ROUTE-001": 800,
  "SDC-ROUTE-002": 500,
  "SDC-ROUTE-003": 300,
};

const DEFAULT_HARD_FAIL_PENALTY = 200;
const WARN_PENALTY = 10;
const INFO_PENALTY = 1;

export type RecoverableCandidateSource =
  | "heuristic"
  | "optimizer-finalist"
  | "search-best";

export type RecoverableCandidate = {
  candidate: LayoutCandidate;
  feasible: boolean;
  score: number;
  evaluation?: LayoutEvaluationResult;
  violations: RuleResult[];
  failedRuleIds: string[];
  source: RecoverableCandidateSource;
  softScore?: Partial<SoftScoreBreakdown>;
};

export type RecoverableFailureBreakdown = {
  hardFailureCount: number;
  warnCount: number;
  routeZoneFailures: number;
  layoutLabelFanoutFailures: number;
  routingValidityFailures: number;
  weightedPenalty: number;
};

export type RecoverableRejectedCandidate = {
  candidateId: string;
  source: RecoverableCandidateSource;
  isHeuristic: boolean;
  whyLost: string;
  weightedFallbackScore: number;
  hardFailureCount: number;
  routeZoneFailures: number;
  layoutLabelFanoutFailures: number;
};

export type RecoverableSelectionKind =
  | "fully-passing"
  | "best-recoverable"
  | "heuristic-best"
  | "search-failed";

export type RecoverableSelectionResult = {
  picked: RecoverableCandidate;
  reason: string;
  selectionKind: RecoverableSelectionKind;
  breakdown: RecoverableFailureBreakdown;
  comparisonVsHeuristic?: {
    heuristicCandidateId: string;
    heuristicPenalty: number;
    pickedPenalty: number;
    heuristicHardFails: number;
    pickedHardFails: number;
    heuristicWon: boolean;
  };
  rejected: RecoverableRejectedCandidate[];
};

export function rulePenaltyWeight(ruleId: SdcRuleId, severity: string): number {
  if (severity === "warn") return WARN_PENALTY;
  if (severity === "info") return INFO_PENALTY;
  return RECOVERABLE_RULE_PENALTIES[ruleId] ?? DEFAULT_HARD_FAIL_PENALTY;
}

export function breakdownRecoverableFailures(
  violations: RuleResult[],
): RecoverableFailureBreakdown {
  let hardFailureCount = 0;
  let warnCount = 0;
  let routeZoneFailures = 0;
  let layoutLabelFanoutFailures = 0;
  let routingValidityFailures = 0;
  let weightedPenalty = 0;

  for (const v of violations) {
    if (v.ok) continue;
    const weight = rulePenaltyWeight(v.id, v.severity);
    weightedPenalty += weight;
    if (v.severity === "fail") {
      hardFailureCount += 1;
      if (v.id === "SDC-ROUTE-001") routeZoneFailures += 1;
      if (v.id === "SDC-LAYOUT-002") layoutLabelFanoutFailures += 1;
      if (v.id === "SDC-ROUTE-002" || v.id === "SDC-ROUTE-003") {
        routingValidityFailures += 1;
      }
    } else if (v.severity === "warn") {
      warnCount += 1;
    }
  }

  return {
    hardFailureCount,
    warnCount,
    routeZoneFailures,
    layoutLabelFanoutFailures,
    routingValidityFailures,
    weightedPenalty,
  };
}

function softScoreTotal(entry: RecoverableCandidate): number {
  return entry.evaluation?.softScore?.total ?? entry.softScore?.total ?? Number.POSITIVE_INFINITY;
}

function candidateId(entry: RecoverableCandidate): string {
  return entry.candidate.id ?? candidateStableId(entry.candidate);
}

/** Lower return value = better candidate. */
export function compareRecoverableCandidates(
  a: RecoverableCandidate,
  b: RecoverableCandidate,
): number {
  if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;

  const aBreak = breakdownRecoverableFailures(a.violations);
  const bBreak = breakdownRecoverableFailures(b.violations);

  if (aBreak.hardFailureCount !== bBreak.hardFailureCount) {
    return aBreak.hardFailureCount - bBreak.hardFailureCount;
  }
  if (aBreak.weightedPenalty !== bBreak.weightedPenalty) {
    return aBreak.weightedPenalty - bBreak.weightedPenalty;
  }
  if (aBreak.routeZoneFailures !== bBreak.routeZoneFailures) {
    return aBreak.routeZoneFailures - bBreak.routeZoneFailures;
  }
  if (aBreak.layoutLabelFanoutFailures !== bBreak.layoutLabelFanoutFailures) {
    return aBreak.layoutLabelFanoutFailures - bBreak.layoutLabelFanoutFailures;
  }
  if (aBreak.routingValidityFailures !== bBreak.routingValidityFailures) {
    return aBreak.routingValidityFailures - bBreak.routingValidityFailures;
  }

  const softDiff = softScoreTotal(a) - softScoreTotal(b);
  if (softDiff !== 0) return softDiff;

  return candidateId(a).localeCompare(candidateId(b));
}

function whyCandidateLost(
  loser: RecoverableCandidate,
  winner: RecoverableCandidate,
): string {
  if (winner.feasible && !loser.feasible) return "winner fully passes rules";
  const l = breakdownRecoverableFailures(loser.violations);
  const w = breakdownRecoverableFailures(winner.violations);
  if (l.hardFailureCount > w.hardFailureCount) {
    return `more hard failures (${l.hardFailureCount} vs ${w.hardFailureCount})`;
  }
  if (l.weightedPenalty > w.weightedPenalty) {
    return `higher weighted penalty (${l.weightedPenalty} vs ${w.weightedPenalty})`;
  }
  if (l.routeZoneFailures > w.routeZoneFailures) {
    return `more route-zone failures (${l.routeZoneFailures} vs ${w.routeZoneFailures})`;
  }
  if (l.layoutLabelFanoutFailures > w.layoutLabelFanoutFailures) {
    return `more layout/label/fan-out failures (${l.layoutLabelFanoutFailures} vs ${w.layoutLabelFanoutFailures})`;
  }
  if (l.routingValidityFailures > w.routingValidityFailures) {
    return `more routing validity failures (${l.routingValidityFailures} vs ${w.routingValidityFailures})`;
  }
  const lSoft = softScoreTotal(loser);
  const wSoft = softScoreTotal(winner);
  if (lSoft > wSoft) return `worse soft score (${lSoft} vs ${wSoft})`;
  return "deterministic tie-breaker";
}

function selectionReason(
  picked: RecoverableCandidate,
  breakdown: RecoverableFailureBreakdown,
  heuristicEntry: RecoverableCandidate | undefined,
): { reason: string; selectionKind: RecoverableSelectionKind } {
  if (picked.feasible) {
    if (picked.source === "heuristic") {
      return {
        reason: "heuristic baseline fully passes rules",
        selectionKind: "fully-passing",
      };
    }
    if (picked.source === "optimizer-finalist") {
      return {
        reason: "optimizer finalist fully passes rules",
        selectionKind: "fully-passing",
      };
    }
    return {
      reason: "search candidate fully passes rules",
      selectionKind: "fully-passing",
    };
  }

  if (picked.source === "heuristic") {
    return {
      reason: "heuristic ranked best among failed candidates by weighted rule scoring",
      selectionKind: "heuristic-best",
    };
  }

  if (heuristicEntry && compareRecoverableCandidates(picked, heuristicEntry) <= 0) {
    const vsHeuristic = breakdownRecoverableFailures(heuristicEntry.violations);
    const parts: string[] = [
      `fewer hard failures (${breakdown.hardFailureCount} vs ${vsHeuristic.hardFailureCount})`,
    ];
    if (breakdown.weightedPenalty !== vsHeuristic.weightedPenalty) {
      parts.push(
        `lower weighted penalty (${breakdown.weightedPenalty} vs ${vsHeuristic.weightedPenalty})`,
      );
    }
    return {
      reason: `best recoverable optimizer candidate beat heuristic: ${parts.join("; ")}`,
      selectionKind: "best-recoverable",
    };
  }

  return {
    reason: `best recoverable candidate (${breakdown.hardFailureCount} hard failures, penalty ${breakdown.weightedPenalty})`,
    selectionKind: "best-recoverable",
  };
}

/**
 * Rank candidates for import finalization when no finalist fully passes.
 * Fully rule-passing candidates win first; otherwise least-bad by weighted scoring.
 */
export function pickBestRecoverableCandidate(
  candidates: RecoverableCandidate[],
): RecoverableSelectionResult | undefined {
  if (candidates.length === 0) return undefined;

  const ranked = [...candidates].sort(compareRecoverableCandidates);
  const picked = ranked[0]!;
  const breakdown = breakdownRecoverableFailures(picked.violations);
  const heuristicEntry = candidates.find((c) => c.source === "heuristic");

  const { reason, selectionKind } = selectionReason(
    picked,
    breakdown,
    heuristicEntry,
  );

  const rejected: RecoverableRejectedCandidate[] = ranked.slice(1, 6).map((loser) => {
    const loserBreak = breakdownRecoverableFailures(loser.violations);
    return {
      candidateId: candidateId(loser),
      source: loser.source,
      isHeuristic: loser.source === "heuristic",
      whyLost: whyCandidateLost(loser, picked),
      weightedFallbackScore: loserBreak.weightedPenalty,
      hardFailureCount: loserBreak.hardFailureCount,
      routeZoneFailures: loserBreak.routeZoneFailures,
      layoutLabelFanoutFailures: loserBreak.layoutLabelFanoutFailures,
    };
  });

  let comparisonVsHeuristic: RecoverableSelectionResult["comparisonVsHeuristic"];
  if (heuristicEntry && picked.source !== "heuristic") {
    const hBreak = breakdownRecoverableFailures(heuristicEntry.violations);
    comparisonVsHeuristic = {
      heuristicCandidateId: candidateId(heuristicEntry),
      heuristicPenalty: hBreak.weightedPenalty,
      pickedPenalty: breakdown.weightedPenalty,
      heuristicHardFails: hBreak.hardFailureCount,
      pickedHardFails: breakdown.hardFailureCount,
      heuristicWon: compareRecoverableCandidates(heuristicEntry, picked) < 0,
    };
  } else if (heuristicEntry && picked.source === "heuristic") {
    const hBreak = breakdownRecoverableFailures(heuristicEntry.violations);
    comparisonVsHeuristic = {
      heuristicCandidateId: candidateId(heuristicEntry),
      heuristicPenalty: hBreak.weightedPenalty,
      pickedPenalty: breakdown.weightedPenalty,
      heuristicHardFails: hBreak.hardFailureCount,
      pickedHardFails: breakdown.hardFailureCount,
      heuristicWon: true,
    };
  }

  return {
    picked,
    reason,
    selectionKind,
    breakdown,
    comparisonVsHeuristic,
    rejected,
  };
}

export function toRecoverableCandidate(
  candidate: LayoutCandidate,
  evaluation: LayoutEvaluationResult,
  source: RecoverableCandidateSource,
): RecoverableCandidate {
  const violations = evaluation.violations;
  return {
    candidate,
    feasible: evaluation.feasible,
    score: evaluation.score,
    evaluation,
    violations,
    failedRuleIds: violations
      .filter((r) => !r.ok && r.severity === "fail")
      .map((r) => r.id),
    source,
    softScore: evaluation.softScore,
  };
}

export function buildRecoverablePool(
  finalists: RankedFinalist[],
  heuristic: RecoverableCandidate,
  searchBest?: RecoverableCandidate,
): RecoverableCandidate[] {
  const pool: RecoverableCandidate[] = [];
  const seen = new Set<string>();

  const push = (entry: RecoverableCandidate) => {
    const id = candidateId(entry);
    if (seen.has(id)) return;
    seen.add(id);
    pool.push(entry);
  };

  for (const finalist of finalists) {
    if (!finalist.evaluation) continue;
    push(
      toRecoverableCandidate(
        finalist.candidate,
        finalist.evaluation,
        "optimizer-finalist",
      ),
    );
  }

  if (searchBest) push(searchBest);
  push(heuristic);
  return pool;
}

export function recoverableSelectionToDiagnostics(
  result: RecoverableSelectionResult,
): NonNullable<ImportDiagnostics["recoverableSelection"]> {
  const pickedId = candidateId(result.picked);
  return {
    selectionKind: result.selectionKind,
    selectedCandidateId: pickedId,
    isHeuristic: result.picked.source === "heuristic",
    reason: result.reason,
    weightedFallbackScore: result.breakdown.weightedPenalty,
    hardFailureCount: result.breakdown.hardFailureCount,
    routeZoneFailures: result.breakdown.routeZoneFailures,
    layoutLabelFanoutFailures: result.breakdown.layoutLabelFanoutFailures,
    routingValidityFailures: result.breakdown.routingValidityFailures,
    comparisonVsHeuristic: result.comparisonVsHeuristic,
    rejected: result.rejected,
  };
}

export function applyRecoverableSelectionDiagnostics(
  diag: ImportDiagnostics | null,
  result: RecoverableSelectionResult,
): void {
  if (!diag) return;
  recordRecoverableSelection(diag, recoverableSelectionToDiagnostics(result));
  recordWinner(diag, result.picked.candidate, {
    feasible: result.picked.feasible,
    score: result.picked.score,
    violations: result.picked.violations,
    softScore: result.picked.softScore,
    reason: result.reason,
  });
}

export function recoverableSelectionBanner(
  result: RecoverableSelectionResult,
): string | null {
  if (result.selectionKind === "fully-passing") return null;

  const failedIds = result.picked.failedRuleIds;
  const failedSuffix =
    failedIds.length > 0 ? ` Remaining failures: ${failedIds.join(", ")}.` : "";

  if (result.selectionKind === "heuristic-best") {
    return `Layout optimizer found no rule-passing layout; heuristic ranked best among failed candidates.${failedSuffix}`;
  }

  if (result.picked.source === "heuristic") {
    return `Layout optimizer found no rule-passing layout; applied heuristic (${result.reason}).${failedSuffix}`;
  }

  const vs = result.comparisonVsHeuristic;
  const beatHeuristic =
    vs && !vs.heuristicWon
      ? ` Beat heuristic (${vs.pickedPenalty} vs ${vs.heuristicPenalty} weighted penalty).`
      : "";

  return `Layout optimizer found no rule-passing layout; applied best recoverable candidate.${beatHeuristic} ${result.reason}.${failedSuffix}`;
}
