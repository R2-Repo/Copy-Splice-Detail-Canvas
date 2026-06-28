import { segmentOnGrid, validateGridRoutes } from "@/features/grid/reservation";

import type { SdcRule } from "./types";
import { fail, pass, warn } from "./helpers";

/** SDC-GRID-001 — Canvas grid system and lane segment reservation. */
export const sdcGrid001: SdcRule = {
  id: "SDC-GRID-001",
  title: "Canvas grid system",
  dependencies: ["SDC-ROUTE-001"],
  requires: ["grid"],
  tiers: ["proxy-route", "final-layout"],
  check(ctx) {
    if (!ctx.grid) {
      return [warn("SDC-GRID-001", "No grid map — grid validation skipped")];
    }

    const routeIssues = validateGridRoutes(ctx.grid, ctx.gridRoutes);
    if (routeIssues.length) {
      return [fail("SDC-GRID-001", routeIssues.slice(0, 5).join("; "), routeIssues)];
    }

    if (ctx.gridRoutes) {
      for (const [connId, route] of ctx.gridRoutes) {
        for (let i = 1; i < route.points.length; i++) {
          const a = route.points[i - 1]!;
          const b = route.points[i]!;
          if (!segmentOnGrid(ctx.grid, a, b)) {
            return [
              fail(
                "SDC-GRID-001",
                `Route ${connId} segment off-grid: (${a.x},${a.y})→(${b.x},${b.y})`,
              ),
            ];
          }
        }
      }
    }

    return [pass("SDC-GRID-001")];
  },
};
