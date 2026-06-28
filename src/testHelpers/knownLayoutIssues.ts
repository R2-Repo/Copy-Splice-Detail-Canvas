/**
 * Machine-readable manifest for deferred layout/routing failures.
 * See docs/agent/KNOWN_ISSUES.md for human-readable details.
 */
export type KnownLayoutIssue = {
  id: string;
  skipGridRules: boolean;
  skipEdge011?: boolean;
};

export const KNOWN_LAYOUT_ISSUES: Record<string, KnownLayoutIssue> = {
  "left-spi-215_i-80": { id: "KI-003", skipGridRules: true, skipEdge011: true },
};

/** When true, known-issue skips are disabled (full hardening run). */
export function runKnownIssuesTests(): boolean {
  return process.env.RUN_KNOWN_ISSUES === "1";
}

export function knownIssueForFixture(label: string): KnownLayoutIssue | undefined {
  return KNOWN_LAYOUT_ISSUES[label];
}

export function shouldSkipGridRulesForFixture(label: string): boolean {
  if (runKnownIssuesTests()) return false;
  return KNOWN_LAYOUT_ISSUES[label]?.skipGridRules === true;
}

export function shouldSkipEdge011ForFixture(label: string): boolean {
  if (runKnownIssuesTests()) return false;
  return KNOWN_LAYOUT_ISSUES[label]?.skipEdge011 === true;
}

export function skipReasonForFixture(label: string): string {
  const issue = KNOWN_LAYOUT_ISSUES[label];
  if (!issue) return "";
  return `${issue.id} — see docs/agent/KNOWN_ISSUES.md (${label})`;
}
