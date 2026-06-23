import {
  evaluateSdcRouteNestingRules,
  evaluateSdcRouteNestingRulesForGrid,
} from "@/features/diagram/layoutRules";
import { routingEngineMode } from "@/features/diagram/routingEngine";

import type { SdcRule } from "./types";
import { buildSdcContextFromLayout } from "./buildSdcContext";
import { formatSdcFailureMessage } from "./legacyBridge";
import { fail, pass, warn } from "./helpers";

/** SDC-ROUTE-002 — Hierarchy-aware nesting and lane bands. */
export const sdcRoute002: SdcRule = {
  id: "SDC-ROUTE-002",
  title: "Fiber strand nesting",
  dependencies: ["SDC-ROUTE-001"],
  requires: ["reactFlow"],
  check(ctx) {
    if (!ctx.reactFlow) {
      return [warn("SDC-ROUTE-002", "No React Flow graph — nesting checks skipped")];
    }
    const layoutCtx = buildSdcContextFromLayout(ctx);
    if (!layoutCtx) {
      return [warn("SDC-ROUTE-002", "Could not build layout rule context")];
    }

    const useGridNesting =
      routingEngineMode(ctx.overrides) === "grid" &&
      Boolean(ctx.grid && ctx.gridRoutes?.size);
    const results = useGridNesting
      ? evaluateSdcRouteNestingRulesForGrid(layoutCtx)
      : evaluateSdcRouteNestingRules(layoutCtx);
    const failures = results
      .filter((r) => !r.ok)
      .map((r) => formatSdcFailureMessage("SDC-ROUTE-002", `${r.id}: ${r.detail}`));

    if (failures.length) {
      return [fail("SDC-ROUTE-002", failures.join("; "), failures)];
    }
    return [pass("SDC-ROUTE-002")];
  },
};
