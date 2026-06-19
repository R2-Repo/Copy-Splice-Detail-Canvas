import {
  checkLayoutRule,
  type LayoutRuleId,
} from "@/features/diagram/layoutRules";

import type { SdcRule } from "./types";
import { buildSdcContextFromLayout } from "./buildSdcContext";
import { fail, pass, warn } from "./helpers";

const SPACING_LEGACY_IDS: LayoutRuleId[] = [
  "CBL-001",
  "CBL-002",
  "FBR-002",
  "ROW-001",
  "ROW-002",
];

/** SDC-LAYOUT-001 — Spacing between cables, tubes, fanouts, and strands. */
export const sdcLayout001: SdcRule = {
  id: "SDC-LAYOUT-001",
  title: "Spacing",
  dependencies: ["SDC-LAYOUT-002"],
  requires: ["visualCables", "reactFlow"],
  check(ctx) {
    if (!ctx.reactFlow) {
      return [warn("SDC-LAYOUT-001", "No React Flow graph — spacing checks skipped")];
    }
    const layoutCtx = buildSdcContextFromLayout(ctx);
    if (!layoutCtx) {
      return [warn("SDC-LAYOUT-001", "Could not build layout rule context")];
    }
    const failures: string[] = [];
    for (const legacyId of SPACING_LEGACY_IDS) {
      const r = checkLayoutRule(legacyId, layoutCtx);
      if (!r.ok) failures.push(`${legacyId}: ${r.detail}`);
    }
    if (failures.length) {
      return [fail("SDC-LAYOUT-001", failures.join("; "), failures)];
    }
    return [pass("SDC-LAYOUT-001")];
  },
};
