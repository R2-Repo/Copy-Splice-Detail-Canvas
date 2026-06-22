import { evaluateSdcRouteCollisionRules } from "@/features/diagram/layoutRules";
import {
  INTRA_BUNDLE_ISOTROPIC_PITCH,
  segmentsViolateLaneSeparation,
  type OrthogonalSegment,
} from "@/features/diagram/centerRouter";
import { MAX_SPLICE_BENDS } from "@/features/canvas/edges/splicePathGeometry";
import { validateGridRoutes } from "@/features/grid/reservation";
import type { GridPoint } from "@/features/grid/gridTypes";

import type { SdcRule } from "./types";
import { buildSdcContextFromLayout } from "./buildSdcContext";
import { fail, pass, warn } from "./helpers";

function bendCountFromPoints(points: GridPoint[]): number {
  let bends = 0;
  for (let i = 2; i < points.length; i++) {
    const a = points[i - 2]!;
    const b = points[i - 1]!;
    const c = points[i]!;
    const dir1 = Math.abs(a.x - b.x) < 0.5 ? "v" : "h";
    const dir2 = Math.abs(b.x - c.x) < 0.5 ? "v" : "h";
    if (dir1 !== dir2) bends++;
  }
  return bends;
}

function orthogonalSegmentsFromRoute(points: GridPoint[]): OrthogonalSegment[] {
  const segments: OrthogonalSegment[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (Math.abs(a.x - b.x) < 0.5) {
      segments.push({
        axis: "v",
        fixed: a.x,
        start: Math.min(a.y, b.y),
        end: Math.max(a.y, b.y),
      });
    } else if (Math.abs(a.y - b.y) < 0.5) {
      segments.push({
        axis: "h",
        fixed: a.y,
        start: Math.min(a.x, b.x),
        end: Math.max(a.x, b.x),
      });
    }
  }
  return segments.filter((s) => Math.abs(s.end - s.start) > 0.5);
}

/** SDC-ROUTE-003 — Overlap, crossing, and collision validation. */
export const sdcRoute003: SdcRule = {
  id: "SDC-ROUTE-003",
  title: "Fiber strand overlap, crossing, and collision",
  dependencies: ["SDC-GRID-001"],
  requires: ["reactFlow"],
  check(ctx) {
    if (!ctx.reactFlow) {
      return [warn("SDC-ROUTE-003", "No React Flow graph — collision checks skipped")];
    }

    if (ctx.grid && ctx.gridRoutes?.size) {
      const failures: string[] = [];
      failures.push(...validateGridRoutes(ctx.grid, ctx.gridRoutes));

      const allSegments: OrthogonalSegment[] = [];
      for (const [connId, route] of ctx.gridRoutes) {
        const bends = bendCountFromPoints(route.points);
        if (bends > MAX_SPLICE_BENDS) {
          failures.push(
            `${connId}: ${bends} bends exceeds budget ${MAX_SPLICE_BENDS}`,
          );
        }
        allSegments.push(...orthogonalSegmentsFromRoute(route.points));
      }

      if (
        segmentsViolateLaneSeparation(allSegments, INTRA_BUNDLE_ISOTROPIC_PITCH)
      ) {
        failures.push("Parallel route segments closer than lane pitch");
      }

      if (failures.length) {
        return [fail("SDC-ROUTE-003", failures.slice(0, 5).join("; "), failures)];
      }
      return [pass("SDC-ROUTE-003")];
    }

    const layoutCtx = buildSdcContextFromLayout(ctx);
    if (!layoutCtx) {
      return [warn("SDC-ROUTE-003", "Could not build layout rule context")];
    }

    const collisionIds = [
      "EDGE-001",
      "EDGE-011",
      "EDGE-012",
      "EDGE-007",
    ] as const;
    const failures: string[] = [];
    for (const r of evaluateSdcRouteCollisionRules(layoutCtx)) {
      if (!r.ok && (collisionIds as readonly string[]).includes(r.id)) {
        failures.push(`${r.id}: ${r.detail}`);
      }
    }

    if (failures.length) {
      return [fail("SDC-ROUTE-003", failures.join("; "), failures)];
    }
    return [pass("SDC-ROUTE-003")];
  },
};
