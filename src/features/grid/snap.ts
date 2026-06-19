import { FIBER_ROW_PITCH, SPLICE_LANE_SEP } from "@/features/diagram/cableLayoutMetrics";

import { nearestGridLine, snapPointToGrid } from "./gridMap";
import type { GridMap, GridPoint } from "./gridTypes";

export function snapToPitch(value: number, pitch = FIBER_ROW_PITCH): number {
  return Math.round(value / pitch) * pitch;
}

export function snapToLaneSep(value: number, sep = SPLICE_LANE_SEP): number {
  return Math.round(value / sep) * sep;
}

export function snapPoint(map: GridMap, point: GridPoint): GridPoint {
  return snapPointToGrid(map, point);
}

export function snapX(map: GridMap, x: number): number {
  return nearestGridLine(x, map.verticalLines, map.laneSep);
}

export function snapY(map: GridMap, y: number): number {
  return nearestGridLine(y, map.horizontalLines, map.pitch);
}
