import type { LayoutEvaluationResult } from "@/features/layoutSearch/evaluateCandidate";
import type { LayoutCandidate } from "@/features/layoutSearch/layoutCandidate";
import type { LayoutSearchResult } from "@/features/layoutSearch/layoutSearch";
import type { TieredEvalResult } from "@/features/layoutSearch/tieredEvaluate";
import type { TopologyAnalysis } from "@/features/layoutSearch/topology/topologyTypes";
import type { RuleResult } from "@/features/rules/types";

export function serializeViolations(violations: RuleResult[]) {
  return violations.map((v) => ({
    id: v.id,
    severity: v.severity,
    ok: v.ok,
    detail: v.detail,
    objectIds: v.objectIds,
  }));
}

export function ruleRejectCounts(violations: RuleResult[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of violations) {
    if (v.ok) continue;
    counts[v.id] = (counts[v.id] ?? 0) + 1;
  }
  return counts;
}

export function serializeCandidate(candidate: LayoutCandidate) {
  return {
    cableSides: candidate.cableSides,
    stackOrder: candidate.stackOrder,
    layoutWidth: candidate.layoutWidth,
    layoutExpansion: candidate.layoutExpansion,
    id: candidate.id,
  };
}

export function serializeEvaluation(result: LayoutEvaluationResult) {
  return {
    feasible: result.feasible,
    score: result.score,
    softScore: result.softScore,
    tieBreak: result.tieBreak,
    violations: serializeViolations(result.violations),
    ruleRejectCounts: ruleRejectCounts(result.violations),
    failedRuleIds: result.violations.filter((v) => !v.ok).map((v) => v.id),
  };
}

export function serializeSearchResult(
  result: LayoutSearchResult,
  wallMs: number,
) {
  return {
    wallMs,
    best: serializeCandidate(result.best),
    bestScore: result.bestScore,
    feasible: result.bestScore < Number.MAX_SAFE_INTEGER,
    evaluations: result.evaluations,
    diagnostics: result.diagnostics ?? null,
    finalists: result.finalists?.map((f) => ({
      candidateId: f.candidate.id ?? "",
      score: f.score,
      feasible: f.feasible,
      failedRuleIds: f.failedRuleIds,
    })),
    winnerEvaluation: result.winnerEvaluation
      ? serializeEvaluation(result.winnerEvaluation)
      : undefined,
  };
}

export function serializeTopologyAnalysis(analysis: TopologyAnalysis) {
  return {
    cableKeys: analysis.cableKeys,
    affinities: analysis.affinities,
    constraints: analysis.constraints,
    throughCableConfidence: analysis.throughCableConfidence,
  };
}

export function serializeTieredResult(result: TieredEvalResult) {
  const base = {
    tier: result.tier,
    feasible: result.feasible,
    score: result.score,
    softScore: result.softScore,
    tieBreak: result.tieBreak,
    violations: serializeViolations(result.violations),
    ruleRejectCounts: ruleRejectCounts(result.violations),
    failedRuleIds: result.violations.filter((v) => !v.ok).map((v) => v.id),
  };
  if (result.fullResult) {
    return {
      ...base,
      evaluation: serializeEvaluation(result.fullResult),
    };
  }
  return base;
}

export type SerializedBatchItem = {
  candidateId: string | undefined;
  wallMs: number;
  result: ReturnType<typeof serializeTieredResult>;
};

export function serializeEvaluateBatchResult(
  results: SerializedBatchItem[],
  wallMs: number,
) {
  return {
    wallMs,
    count: results.length,
    results,
  };
}
