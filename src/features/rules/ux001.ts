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

    if (gridLocks?.cables?.length && ctx.overrides?.positions) {
      for (const cableId of gridLocks.cables) {
        const nodeId = `cable-${cableId}`;
        if (
          !(nodeId in ctx.overrides.positions) &&
          !(cableId in ctx.overrides.positions)
        ) {
          return [
            warn(
              "SDC-UX-001",
              `Grid-locked cable ${cableId} has no saved position`,
              [cableId],
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

    if (locks?.cables && ctx.overrides?.positions) {
      for (const cableId of Object.keys(locks.cables)) {
        const nodeId = `cable-${cableId}`;
        if (
          !(nodeId in ctx.overrides.positions) &&
          !(cableId in ctx.overrides.positions)
        ) {
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
