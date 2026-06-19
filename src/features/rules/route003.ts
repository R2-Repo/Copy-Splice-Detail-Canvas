import { checkLayoutRule } from "@/features/diagram/layoutRules";

import type { SdcRule } from "./types";
import { buildSdcContextFromLayout } from "./buildSdcContext";
import { fail, pass, warn } from "./helpers";

/** SDC-ROUTE-003 — Overlap, crossing, and collision validation. */
export const sdcRoute003: SdcRule = {
  id: "SDC-ROUTE-003",
  title: "Fiber strand overlap, crossing, and collision",
  dependencies: ["SDC-GRID-001"],
  requires: ["reactFlow"],
  check(ctx) {
    if (!ctx.reactFlow) {
      return [warn("SDC-ROUTE-003", "No React Flow graph — collision checks skipped")];
    }
    const layoutCtx = buildSdcContextFromLayout(ctx);
    if (!layoutCtx) {
      return [warn("SDC-ROUTE-003", "Could not build layout rule context")];
    }

    const collisionIds = [
      "EDGE-001",
      "EDGE-011",
      "EDGE-012",
      "EDGE-007",
    ] as const;
    const failures: string[] = [];
    for (const id of collisionIds) {
      const r = checkLayoutRule(id, layoutCtx);
      if (!r.ok) failures.push(`${id}: ${r.detail}`);
    }

    if (failures.length) {
      return [fail("SDC-ROUTE-003", failures.join("; "), failures)];
    }
    return [pass("SDC-ROUTE-003")];
  },
};
