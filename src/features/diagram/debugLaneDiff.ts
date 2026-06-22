import type { SpliceRoutingLane } from "@/features/diagram/centerRouter";

/** Dev-only lane assignment diff (`VITE_DEBUG_LANE_DIFF=1` in `.env.local`). */
export function debugLaneDiffEnabled(): boolean {
  return (
    import.meta.env.DEV === true &&
    import.meta.env.VITE_DEBUG_LANE_DIFF === "1"
  );
}

export function logLaneAssignmentDiff(
  label: string,
  before: Map<string, SpliceRoutingLane>,
  after: Map<string, SpliceRoutingLane>,
): void {
  if (!debugLaneDiffEnabled()) return;
  const ids = new Set([...before.keys(), ...after.keys()]);
  const changes: string[] = [];
  for (const id of [...ids].sort()) {
    const a = before.get(id);
    const b = after.get(id);
    if (!a || !b) {
      changes.push(`${id}: ${a ? "removed" : "added"}`);
      continue;
    }
    const midDelta = Math.round(b.midX - a.midX);
    const jogDelta =
      a.jogX != null && b.jogX != null ? Math.round(b.jogX - a.jogX) : 0;
    if (midDelta !== 0 || jogDelta !== 0) {
      changes.push(`${id}: midX ${midDelta}px jogX ${jogDelta}px`);
    }
  }
  if (changes.length) {
    console.info(`[lane-diff] ${label}`, changes);
  }
}
