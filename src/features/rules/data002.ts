import { cableLegIdForEndpoint } from "@/features/diagram/buildConnectionGraph";
import type { FiberEndpoint } from "@/types/splice";

import type { SdcRule } from "./types";
import { fail, pass } from "./helpers";

function endpointsForLeg(
  pairs: { endpointA: FiberEndpoint; endpointB: FiberEndpoint }[],
  legId: string,
): FiberEndpoint[] {
  const out: FiberEndpoint[] = [];
  for (const pair of pairs) {
    for (const ep of [pair.endpointA, pair.endpointB]) {
      if (cableLegIdForEndpoint(ep) === legId) out.push(ep);
    }
  }
  return out;
}

/** SDC-DATA-002 — Buffer tube count (6 vs 12) on each cable leg. */
export const sdcData002: SdcRule = {
  id: "SDC-DATA-002",
  title: "Buffer tube count",
  dependencies: ["SDC-DATA-001"],
  requires: ["graph"],
  tiers: ["import-data", "candidate-screen", "proxy-route", "final-layout"],
  check(ctx) {
    const issues: string[] = [];
    const { pairs } = ctx.graph.report;

    for (const leg of ctx.graph.legs) {
      if (leg.fibersPerTube !== 6 && leg.fibersPerTube !== 12) {
        issues.push(`${leg.id}: invalid fibersPerTube ${leg.fibersPerTube}`);
      }

      const endpoints = endpointsForLeg(pairs, leg.id);
      if (!endpoints.length) continue;

      for (const ep of endpoints) {
        if (!Number.isFinite(ep.fiberNumber) || ep.fiberNumber < 1) {
          issues.push(`${leg.id}: invalid fiber number`);
          break;
        }
      }
    }

    if (issues.length) {
      return [fail("SDC-DATA-002", issues.slice(0, 5).join("; "), issues)];
    }
    return [pass("SDC-DATA-002")];
  },
};
