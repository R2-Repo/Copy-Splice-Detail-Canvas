import { evaluateSdcLayoutFanoutRules } from "@/features/diagram/layoutRules";

import type { SdcRule } from "./types";
import { buildSdcContextFromLayout } from "./buildSdcContext";
import { formatSdcFailureMessage } from "./ruleFailureMessages";
import { fail, pass, warn } from "./helpers";

/** SDC-LAYOUT-002 — Fiber strand fan-out geometry. */
export const sdcLayout002: SdcRule = {
  id: "SDC-LAYOUT-002",
  title: "Fiber strand fan out",
  dependencies: ["SDC-ORDER-001", "SDC-ORDER-002"],
  requires: ["visualCables", "reactFlow"],
  tiers: ["candidate-screen", "proxy-route", "final-layout"],
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

    const results = evaluateSdcLayoutFanoutRules(layoutCtx);
    const failures = results
      .filter((r) => !r.ok)
      .map((r) => formatSdcFailureMessage("SDC-LAYOUT-002", `${r.id}: ${r.detail}`));
    if (failures.length) {
      return [fail("SDC-LAYOUT-002", failures.join("; "), failures)];
    }
    return [pass("SDC-LAYOUT-002")];
  },
};
