import { tubesInTiaOrderOk } from "@/features/diagram/tubeFiberLayout";

import type { SdcRule } from "./types";
import { fail, pass } from "./helpers";

/** SDC-ORDER-001 — Buffer tube color order (TIA solid then striped). */
export const sdcOrder001: SdcRule = {
  id: "SDC-ORDER-001",
  title: "Buffer tube color order",
  dependencies: ["SDC-DATA-001"],
  requires: ["visualCables"],
  tiers: ["import-data", "candidate-screen", "proxy-route", "final-layout"],
  check(ctx) {
    if (!ctx.visualCables?.length) {
      return [fail("SDC-ORDER-001", "No visual cables to validate")];
    }
    if (!tubesInTiaOrderOk(ctx.visualCables)) {
      return [fail("SDC-ORDER-001", "Buffer tubes not in TIA color order")];
    }
    return [pass("SDC-ORDER-001")];
  },
};
