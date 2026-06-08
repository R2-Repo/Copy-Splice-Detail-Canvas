import { parseLeftSectionRows } from "@/features/import/parseBentleyCsv";

export function analyzeLeftSectionFailures(csvText: string): {
  total: number;
  parsed: number;
  failed: number;
  failureBreakdown: { reason: string; count: number }[];
} {
  const results = parseLeftSectionRows(csvText);
  const parsed = results.filter((r) => r.ok).length;
  const failed = results.length - parsed;

  const counts = new Map<string, number>();
  for (const r of results) {
    if (r.ok) continue;
    counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
  }

  return {
    total: results.length,
    parsed,
    failed,
    failureBreakdown: [...counts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}
