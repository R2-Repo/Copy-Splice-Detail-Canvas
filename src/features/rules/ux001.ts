import type { SdcRule } from "./types";
import { fail, pass, warn } from "./helpers";

/** SDC-UX-001 — Always-on auto layout with locked manual overrides. */
export const sdcUx001: SdcRule = {
  id: "SDC-UX-001",
  title: "Auto layout and manual locks",
  dependencies: ["SDC-GRID-001"],
  check(ctx) {
    const locks = ctx.overrides?.locks ?? ctx.locks;
    const gridLocks = ctx.overrides?.gridLocks;

    if (!locks && !gridLocks) {
      return [pass("SDC-UX-001")];
    }

    if (ctx.grid && gridLocks?.segments?.length) {
      for (const segId of gridLocks.segments) {
        const seg = ctx.grid.segments.get(segId);
        if (seg && seg.status !== "manual-locked" && seg.status !== "blocked") {
          return [
            fail(
              "SDC-UX-001",
              `Locked segment ${segId} not marked manual-locked on grid`,
              [segId],
            ),
          ];
        }
      }
    }

    if (locks?.cables && ctx.overrides?.positions) {
      for (const cableId of Object.keys(locks.cables)) {
        if (!(cableId in ctx.overrides.positions)) {
          return [
            warn(
              "SDC-UX-001",
              `Locked cable ${cableId} has no saved position`,
              [cableId],
            ),
          ];
        }
      }
    }

    return [pass("SDC-UX-001")];
  },
};
