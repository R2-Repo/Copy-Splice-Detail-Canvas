import { DEFAULT_BEND_CLEARANCE, routeInsideZone } from "@/features/grid/routingZone";

import type { SdcRule } from "./types";
import { fail, pass, warn } from "./helpers";

/** SDC-ROUTE-001 — Fiber strand routing zone and bend clearance. */
export const sdcRoute001: SdcRule = {
  id: "SDC-ROUTE-001",
  title: "Fiber strand routing zone",
  dependencies: ["SDC-LAYOUT-002"],
  requires: ["grid"],
  check(ctx) {
    if (!ctx.grid) {
      return [warn("SDC-ROUTE-001", "No grid — routing zone validation skipped")];
    }

    const zone = ctx.grid.routingZone;
    if (!zone || zone.width <= 0 || zone.height <= 0) {
      return [fail("SDC-ROUTE-001", "Routing zone is empty or invalid")];
    }

    if (ctx.gridRoutes) {
      for (const [connId, route] of ctx.gridRoutes) {
        const inside = routeInsideZone(route.points, zone, DEFAULT_BEND_CLEARANCE);
        if (!inside.ok) {
          return [
            fail(
              "SDC-ROUTE-001",
              `Connection ${connId}: ${inside.detail}`,
              [connId],
            ),
          ];
        }
      }
    }

    return [pass("SDC-ROUTE-001")];
  },
};
