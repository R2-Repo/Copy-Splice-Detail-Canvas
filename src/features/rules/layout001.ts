import { evaluateSdcLayoutSpacingRules } from "@/features/diagram/layoutRules";

import type { SdcRule } from "./types";
import { buildSdcContextFromLayout } from "./buildSdcContext";
import { formatSdcFailureMessage } from "./ruleFailureMessages";
import { fail, pass, warn } from "./helpers";

/** SDC-LAYOUT-001 — Spacing between cables, tubes, fanouts, and strands. */
export const sdcLayout001: SdcRule = {
  id: "SDC-LAYOUT-001",
  title: "Spacing",
  dependencies: ["SDC-LAYOUT-002"],
  requires: ["visualCables", "reactFlow"],
  tiers: ["candidate-screen", "proxy-route", "final-layout"],
  check(ctx) {
    if (!ctx.reactFlow) {
      return [warn("SDC-LAYOUT-001", "No React Flow graph — spacing checks skipped")];
    }
    const layoutCtx = buildSdcContextFromLayout(ctx);
    if (!layoutCtx) {
      return [warn("SDC-LAYOUT-001", "Could not build layout rule context")];
    }
    const results = evaluateSdcLayoutSpacingRules(layoutCtx);
    const failures = results
      .filter((r) => !r.ok)
      .map((r) => formatSdcFailureMessage("SDC-LAYOUT-001", `${r.id}: ${r.detail}`));
    if (failures.length) {
      return [fail("SDC-LAYOUT-001", failures.join("; "), failures)];
    }
    return [pass("SDC-LAYOUT-001")];
  },
};
