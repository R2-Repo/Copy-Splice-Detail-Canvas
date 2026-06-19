import { checkLayoutRule } from "@/features/diagram/layoutRules";

import type { SdcRule } from "./types";
import { buildSdcContextFromLayout } from "./buildSdcContext";
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

    const nestingIds = ["EDGE-005", "EDGE-010"] as const;
    const failures: string[] = [];
    for (const id of nestingIds) {
      const r = checkLayoutRule(id, layoutCtx);
      if (!r.ok) failures.push(`${id}: ${r.detail}`);
    }

    if (failures.length) {
      return [fail("SDC-ROUTE-002", failures.join("; "), failures)];
    }
    return [pass("SDC-ROUTE-002")];
  },
};
