import type { GridPoint, RoutingZoneBounds } from "./gridTypes";
import { DEFAULT_BEND_CLEARANCE } from "./gridMap";

export { DEFAULT_BEND_CLEARANCE };

export function pointInsideZone(
  p: GridPoint,
  zone: RoutingZoneBounds,
  margin = 0,
): boolean {
  return (
    p.x >= zone.leftX + margin &&
    p.x <= zone.rightX - margin &&
    p.y >= zone.topY + margin &&
    p.y <= zone.bottomY - margin
  );
}

export function routeInsideZone(
  points: GridPoint[],
  zone: RoutingZoneBounds,
  bendClearance = DEFAULT_BEND_CLEARANCE,
): { ok: boolean; detail?: string } {
  if (points.length < 2) {
    return { ok: true };
  }

  for (const p of points) {
    if (!pointInsideZone(p, zone)) {
      return { ok: false, detail: `Point (${p.x},${p.y}) outside routing zone` };
    }
  }

  const start = points[0]!;
  const fromLeft = start.x <= zone.leftX + zone.width * 0.25;
  const fromRight = start.x >= zone.rightX - zone.width * 0.25;
  const fromTop = start.y <= zone.topY + zone.height * 0.25;
  const fromBottom = start.y >= zone.bottomY - zone.height * 0.25;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const isBend = prev.x !== cur.x && prev.y !== cur.y;

    if (isBend) {
      if (fromLeft && cur.x < zone.leftX + bendClearance) {
        return {
          ok: false,
          detail: `Left-side bend too close to zone edge (x=${cur.x})`,
        };
      }
      if (fromRight && cur.x > zone.rightX - bendClearance) {
        return {
          ok: false,
          detail: `Right-side bend too close to zone edge (x=${cur.x})`,
        };
      }
      if (fromTop && cur.y < zone.topY + bendClearance) {
        return {
          ok: false,
          detail: `Top-side bend too close to zone edge (y=${cur.y})`,
        };
      }
      if (fromBottom && cur.y > zone.bottomY - bendClearance) {
        return {
          ok: false,
          detail: `Bottom-side bend too close to zone edge (y=${cur.y})`,
        };
      }
    }
  }

  return { ok: true };
}
