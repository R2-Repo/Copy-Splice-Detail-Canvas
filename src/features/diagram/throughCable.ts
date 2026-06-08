import { cableNameKey } from "@/features/import/cableLegIdentity";
import type { ConnectionGraph, FiberEndpoint } from "@/types/splice";

/** @deprecated Last-resort fallback — prefer `CableLeg.role` or `isThroughCable`. */
export function isThroughCableName(cable: string): boolean {
  if (/DROP|DK-/i.test(cable)) return false;
  if (/\bDIST\b/i.test(cable)) return true;
  return /\b(144|288|96|48|24)\b/.test(cable);
}

/** True when any leg for this cable has role through (falls back to name regex). */
export function isThroughCable(
  cable: string,
  graph?: ConnectionGraph,
): boolean {
  if (graph) {
    const legs = graph.legs.filter(
      (leg) => cableNameKey(leg.cable) === cableNameKey(cable),
    );
    if (legs.length > 0) {
      return legs.some((leg) => leg.role === "through");
    }
  }
  return isThroughCableName(cable);
}

/** Prefer through-cable fiber # for row layout (crossover pairs keep slot 7–8, etc.). */
export function canonicalLayoutEndpoint(
  left: FiberEndpoint,
  right: FiberEndpoint,
  graph?: ConnectionGraph,
): FiberEndpoint {
  if (isThroughCable(left.cable, graph)) return left;
  if (isThroughCable(right.cable, graph)) return right;
  return left;
}
