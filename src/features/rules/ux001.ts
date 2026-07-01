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

    if (ctx.overrides?.quadCableSides && ctx.overrides?.cableSides) {
      for (const [vcId, quadSide] of Object.entries(
        ctx.overrides.quadCableSides,
      )) {
        const proxy = ctx.overrides.cableSides[vcId];
        const expected = quadSide === "right" ? "right" : "left";
        if (proxy && proxy !== expected) {
          return [
            warn(
              "SDC-UX-001",
              `Cable ${vcId} horizontal proxy side disagrees with quad side ${quadSide}`,
              [vcId],
            ),
          ];
        }
      }
    }

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

    if (gridLocks?.tubeGroups?.length && locks?.tubeGroups) {
      for (const tubeKey of gridLocks.tubeGroups) {
        if (!locks.tubeGroups[tubeKey as keyof typeof locks.tubeGroups]) {
          return [
            warn(
              "SDC-UX-001",
              `Grid tube lock ${tubeKey} missing from locks.tubeGroups`,
              [tubeKey],
            ),
          ];
        }
      }
    }

    if (gridLocks?.dots?.length && ctx.overrides?.legOverrides) {
      for (const dotId of gridLocks.dots) {
        const leg = ctx.overrides.legOverrides[dotId];
        if (
          leg?.dotShiftX != null &&
          Math.abs(leg.dotShiftX) <= 0.5 &&
          Object.keys(leg.leftSegments ?? {}).length === 0 &&
          Object.keys(leg.rightSegments ?? {}).length === 0
        ) {
          return [
            warn(
              "SDC-UX-001",
              `Grid fusion-dot lock ${dotId} has negligible dotShiftX`,
              [dotId],
            ),
          ];
        }
      }
    }

    return [pass("SDC-UX-001")];
  },
};
