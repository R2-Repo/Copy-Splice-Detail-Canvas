import type { SdcRule } from "./types";
import { fail, pass } from "./helpers";

/** SDC-CORE-001 — Glossary and diagram structure prerequisites. */
export const sdcCore001: SdcRule = {
  id: "SDC-CORE-001",
  title: "Glossary and diagram structure",
  requires: ["graph"],
  tiers: ["import-data", "candidate-screen", "proxy-route", "final-layout"],
  check(ctx) {
    const { graph } = ctx;
    if (!graph.report?.pairs?.length) {
      return [fail("SDC-CORE-001", "Splice report has no pairs")];
    }
    if (!graph.legs.length) {
      return [fail("SDC-CORE-001", "Connection graph has no cable legs")];
    }
    if (!graph.connections.length) {
      return [fail("SDC-CORE-001", "Connection graph has no connections")];
    }
    return [pass("SDC-CORE-001")];
  },
};
