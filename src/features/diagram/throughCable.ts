import type { FiberEndpoint } from "@/types/splice";

/** Main distribution cable (not drop / DK stub). */
export function isThroughCableName(cable: string): boolean {
  if (/DROP|DK-/i.test(cable)) return false;
  if (/\bDIST\b/i.test(cable)) return true;
  return /\b(144|288|96|48|24)\b/.test(cable);
}

/** Prefer through-cable fiber # for row layout (crossover pairs keep slot 7–8, etc.). */
export function canonicalLayoutEndpoint(
  left: FiberEndpoint,
  right: FiberEndpoint,
): FiberEndpoint {
  if (isThroughCableName(left.cable)) return left;
  if (isThroughCableName(right.cable)) return right;
  return left;
}
