import { cableLegIdForEndpoint } from "@/features/diagram/buildConnectionGraph";
import { orderedFiberConnections } from "@/features/diagram/buildConnectionGraph";

import type { SdcRule } from "./types";
import { fail, pass } from "./helpers";

/** SDC-DATA-001 — Fiber optic cable hierarchy after CSV import. */
export const sdcData001: SdcRule = {
  id: "SDC-DATA-001",
  title: "Fiber optic cable hierarchy",
  dependencies: ["SDC-CORE-001"],
  requires: ["graph"],
  check(ctx) {
    const issues: string[] = [];
    const legIds = new Set(ctx.graph.legs.map((l) => l.id));

    for (const conn of orderedFiberConnections(ctx.graph)) {
      for (const ep of [conn.pair.endpointA, conn.pair.endpointB]) {
        const legId = cableLegIdForEndpoint(ep);
        if (!legIds.has(legId)) {
          issues.push(`orphan endpoint ${ep.cable} (${ep.csvColumn})`);
        }
        if (!ep.cable?.trim()) {
          issues.push(`empty cable name on connection ${conn.id}`);
        }
        if (!ep.tubeColor) {
          issues.push(`missing tube color on ${conn.id}`);
        }
      }
    }

    for (const leg of ctx.graph.legs) {
      if (!leg.cable?.trim()) {
        issues.push(`empty cable on leg ${leg.id}`);
      }
    }

    if (issues.length) {
      return [fail("SDC-DATA-001", issues.slice(0, 5).join("; "), issues)];
    }
    return [pass("SDC-DATA-001")];
  },
};
