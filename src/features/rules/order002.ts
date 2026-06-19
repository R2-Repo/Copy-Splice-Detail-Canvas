import {
  cableFiberTopToBottomOk,
  compactTubeFiberLayoutOk,
} from "@/features/diagram/tubeFiberLayout";

import type { SdcRule } from "./types";
import { fail, pass } from "./helpers";

/** SDC-ORDER-002 — Fiber strand color order within buffer tubes. */
export const sdcOrder002: SdcRule = {
  id: "SDC-ORDER-002",
  title: "Fiber strand color order",
  dependencies: ["SDC-DATA-001"],
  requires: ["visualCables"],
  check(ctx) {
    if (!ctx.visualCables?.length) {
      return [fail("SDC-ORDER-002", "No visual cables to validate")];
    }
    if (!compactTubeFiberLayoutOk(ctx.visualCables)) {
      return [
        fail(
          "SDC-ORDER-002",
          "Fibers not in TIA order or 24px pitch within a buffer tube",
        ),
      ];
    }
    if (!cableFiberTopToBottomOk(ctx.visualCables)) {
      return [
        fail("SDC-ORDER-002", "rowYOffset does not increase top-to-bottom per cable"),
      ];
    }
    return [pass("SDC-ORDER-002")];
  },
};
