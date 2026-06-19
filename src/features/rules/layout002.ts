import { checkLayoutRule } from "@/features/diagram/layoutRules";

import type { SdcRule } from "./types";
import { buildSdcContextFromLayout } from "./buildSdcContext";
import { fail, pass, warn } from "./helpers";

const FANOUT_LEGACY_IDS = [
  "TUB-001",
  "TUB-002",
  "TUB-005",
  "TUB-007",
  "STR-001",
] as const;

/** SDC-LAYOUT-002 — Fiber strand fan-out geometry. */
export const sdcLayout002: SdcRule = {
  id: "SDC-LAYOUT-002",
  title: "Fiber strand fan out",
  dependencies: ["SDC-ORDER-001", "SDC-ORDER-002"],
  requires: ["visualCables", "reactFlow"],
  check(ctx) {
    if (!ctx.visualCables?.length) {
      return [fail("SDC-LAYOUT-002", "No visual cables for fan-out validation")];
    }
    for (const vc of ctx.visualCables) {
      for (const tube of vc.tubes) {
        if (!tube.fibers.length) {
          return [
            fail("SDC-LAYOUT-002", `Tube ${tube.tubeColor} on ${vc.cable} has no fibers`),
          ];
        }
        for (const fiber of tube.fibers) {
          if (!fiber.handleId) {
            return [
              fail(
                "SDC-LAYOUT-002",
                `Missing handle for fiber ${fiber.fiberNumber} on ${vc.cable}`,
              ),
            ];
          }
        }
      }
    }

    if (!ctx.reactFlow) {
      return [pass("SDC-LAYOUT-002", "Visual structure ok; geometry checks deferred")];
    }

    const layoutCtx = buildSdcContextFromLayout(ctx);
    if (!layoutCtx) {
      return [warn("SDC-LAYOUT-002", "Could not build layout rule context")];
    }

    const failures: string[] = [];
    for (const legacyId of FANOUT_LEGACY_IDS) {
      const r = checkLayoutRule(legacyId, layoutCtx);
      if (!r.ok) failures.push(`${legacyId}: ${r.detail}`);
    }
    if (failures.length) {
      return [fail("SDC-LAYOUT-002", failures.join("; "), failures)];
    }
    return [pass("SDC-LAYOUT-002")];
  },
};
