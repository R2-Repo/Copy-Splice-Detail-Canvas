import type { RuleResult } from "@/features/rules/types";

import type { LayoutCandidate } from "./layoutCandidate";

/** Side/stack/expansion identity — excludes layout width so width variants share cache. */
export function candidateGeometryKey(candidate: LayoutCandidate): string {
  const left = candidate.stackOrder.left.join(",");
  const right = candidate.stackOrder.right.join(",");
  const top = candidate.stackOrder.top.join(",");
  const bottom = candidate.stackOrder.bottom.join(",");
  const sides = Object.entries(candidate.cableSides)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cable, side]) => `${cable}:${side}`)
    .join("|");
  const exp = [
    candidate.layoutExpansion.centerGapPadding,
    candidate.layoutExpansion.cableGapExtra,
    candidate.layoutExpansion.tubeGroupGapExtra,
  ].join(",");
  return `T[${top}]B[${bottom}]L[${left}]R[${right}]S{${sides}}E{${exp}}`;
}

export type CachedRuleValidation = {
  violations: RuleResult[];
  feasible: boolean;
  predictedRules?: string[];
};

export class CandidateRuleValidationCache {
  private readonly cache = new Map<string, CachedRuleValidation>();

  cacheKey(geometryKey: string, evalTier: string, ruleTier: string): string {
    return `${geometryKey}|${evalTier}|${ruleTier}`;
  }

  get(key: string): CachedRuleValidation | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: CachedRuleValidation): void {
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
