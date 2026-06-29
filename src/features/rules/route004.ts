import { MAX_SPLICE_BENDS } from "@/features/canvas/edges/splicePathGeometry";
import { evaluateSdcRouteCollisionRules } from "@/features/diagram/layoutRules";
import type { GridPoint } from "@/features/grid/gridTypes";

import type { SdcRule } from "./types";
import { buildSdcContextFromLayout } from "./buildSdcContext";
import { formatSdcFailureMessage } from "./ruleFailureMessages";
import { fail, pass, warn } from "./helpers";

function bendCountFromPoints(points: GridPoint[]): number {
  let bends = 0;
  for (let i = 2; i < points.length; i++) {
    const a = points[i - 2]!;
    const b = points[i - 1]!;
    const c = points[i]!;
    const dir1 = Math.abs(a.x - b.x) < 0.5 ? "v" : "h";
    const dir2 = Math.abs(b.x - c.x) < 0.5 ? "v" : "h";
    if (dir1 !== dir2) bends++;
  }
  return bends;
}

/** SDC-ROUTE-004 — Max 2 corners per splice path (both legs combined). */
export const sdcRoute004: SdcRule = {
  id: "SDC-ROUTE-004",
  title: "Splice bend budget",
  dependencies: ["SDC-GRID-001"],
  requires: ["reactFlow"],
  tiers: ["proxy-route", "final-layout"],
  check(ctx) {
    if (ctx.grid && ctx.gridRoutes?.size) {
      const failures: string[] = [];
      for (const [connId, route] of ctx.gridRoutes) {
        const bends = bendCountFromPoints(route.points);
        if (bends > MAX_SPLICE_BENDS) {
          failures.push(
            `${connId}: ${bends} bends exceeds budget ${MAX_SPLICE_BENDS}`,
          );
        }
      }
      if (failures.length) {
        return [
          fail(
            "SDC-ROUTE-004",
            failures
              .slice(0, 5)
              .map((f) => formatSdcFailureMessage("SDC-ROUTE-004", f))
              .join("; "),
            failures,
          ),
        ];
      }
      return [pass("SDC-ROUTE-004")];
    }

    const layoutCtx = buildSdcContextFromLayout(ctx);
    if (!layoutCtx) {
      return [warn("SDC-ROUTE-004", "Could not build layout rule context")];
    }

    const failures: string[] = [];
    for (const r of evaluateSdcRouteCollisionRules(layoutCtx)) {
      if (!r.ok && r.id === "SDC-ROUTE-004-A") {
        failures.push(
          formatSdcFailureMessage("SDC-ROUTE-004", `${r.id}: ${r.detail}`),
        );
      }
    }

    if (failures.length) {
      return [fail("SDC-ROUTE-004", failures.join("; "), failures)];
    }
    return [pass("SDC-ROUTE-004")];
  },
};
