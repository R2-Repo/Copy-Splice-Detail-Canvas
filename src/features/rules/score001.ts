import {
  computeSoftScore,
  DEFAULT_SOFT_SCORE_WEIGHTS,
} from "@/features/layoutSearch/layoutScorer";
import { toLayoutCandidate } from "@/features/layoutSearch/verifyLayoutCandidate";

import type { SdcRule } from "./types";
import { pass } from "./helpers";

/** SDC-SCORE-001 — Composite soft score (Tier 2 optimization; never hard-fails). */
export const sdcScore001: SdcRule = {
  id: "SDC-SCORE-001",
  title: "Composite layout soft score",
  dependencies: ["SDC-ROUTE-003"],
  requires: ["grid", "visualCables", "reactFlow"],
  check(ctx) {
    const snapshot = ctx.overrides?.optimizedLayoutCandidate;
    if (!snapshot || !ctx.gridRoutes?.size) {
      return [pass("SDC-SCORE-001", "skipped — no search candidate or grid routes")];
    }

    const candidate = toLayoutCandidate(snapshot);
    const centerX = (ctx.layoutWidth ?? 1920) / 2;
    const soft = computeSoftScore(
      candidate,
      ctx.gridRoutes,
      ctx.grid,
      ctx.visualCables,
      ctx.graph,
      centerX,
      DEFAULT_SOFT_SCORE_WEIGHTS,
    );

    return [
      pass(
        "SDC-SCORE-001",
        `soft=${soft.total} crossings=${soft.crossings} bendsOver=${soft.bendsOverBudget} loopbacks=${soft.sameSideLoopbacks} sides=${soft.sidesUsed} centerW=${soft.centerWidth} imbalance=${soft.heightImbalance} pathLen=${soft.pathLength}`,
      ),
    ];
  },
};
