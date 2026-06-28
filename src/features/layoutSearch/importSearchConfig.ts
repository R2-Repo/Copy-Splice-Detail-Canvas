/** Wall-clock cap for import search — scales with strand count, capped at 5 min. */
export function importTimeBudgetMs(strandCount: number): number {
  return Math.min(300_000, 90_000 + strandCount * 2_500);
}
