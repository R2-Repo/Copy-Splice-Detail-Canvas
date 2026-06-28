import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";
import { evaluateLayoutCandidate } from "@/features/layoutSearch/evaluateCandidate";
import type { LayoutCandidate } from "@/features/layoutSearch/layoutCandidate";
import { layoutSearch, seedFromReportKey } from "@/features/layoutSearch/layoutSearch";
import { toLayoutCandidate } from "@/features/layoutSearch/verifyLayoutCandidate";
import type { ConnectionGraph, OptimizedLayoutCandidate } from "@/types/splice";

const FIXTURE_DIR = join(
  process.cwd(),
  "src/testHelpers/fixtures/searchCandidates",
);

export type SearchLayoutOptions = {
  maxRounds?: number;
  plateauRounds?: number;
  timeBudgetMs?: number;
  /** Use cached snapshot when present (default true). */
  useSnapshot?: boolean;
};

export function loadSearchCandidateSnapshot(
  label: string,
): OptimizedLayoutCandidate | undefined {
  const path = join(FIXTURE_DIR, `${label}.json`);
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as OptimizedLayoutCandidate;
}

export function resolveSearchCandidate(
  graph: ConnectionGraph,
  label: string,
  options?: SearchLayoutOptions,
): { candidate: LayoutCandidate; fromSnapshot: boolean } {
  if (options?.useSnapshot !== false) {
    const snapshot = loadSearchCandidateSnapshot(label);
    if (snapshot) {
      return { candidate: toLayoutCandidate(snapshot), fromSnapshot: true };
    }
  }

  const seed = seedFromReportKey(reportStorageKey(graph));
  const result = layoutSearch(graph, {
    seed,
    maxRounds: options?.maxRounds ?? 2000,
    plateauRounds: options?.plateauRounds ?? 128,
    timeBudgetMs: options?.timeBudgetMs,
  });
  return { candidate: result.best, fromSnapshot: false };
}

export function evaluateSearchLayoutForFixture(
  graph: ConnectionGraph,
  label: string,
  options?: SearchLayoutOptions,
) {
  const { candidate, fromSnapshot } = resolveSearchCandidate(graph, label, options);
  const evaluation = evaluateLayoutCandidate(graph, candidate);
  return { candidate, evaluation, fromSnapshot };
}
