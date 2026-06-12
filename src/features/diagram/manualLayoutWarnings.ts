import type { Edge } from "@xyflow/react";

import { countOrthogonalBends } from "@/features/canvas/edges/splicePathGeometry";
import { SPLICE_LANE_SEP } from "@/features/diagram/cableLayoutMetrics";
import {
  fusionDotCornerClearanceOk,
  fusionDotOnHorizontalSegment,
  fusionDotVerticalLaneClearanceOk,
  pathsWithinBendBudget,
} from "@/features/manualAdjust/constraints";
import { pathToLegSegments } from "@/features/manualAdjust/legSegments";

const MIN_LANE_SEPARATION = SPLICE_LANE_SEP;

export type ManualLayoutWarningCode =
  | "EDGE-004"
  | "EDGE-012"
  | "DOT-001"
  | "DOT-003"
  | "DOT-004";

export type ManualLayoutWarning = {
  connectionId: string;
  code: ManualLayoutWarningCode;
  message: string;
};

export function connectionIdFromSpliceEdgeId(edgeId: string): string | null {
  if (edgeId.startsWith("splice-left-")) {
    return edgeId.slice("splice-left-".length);
  }
  if (edgeId.startsWith("splice-right-")) {
    return edgeId.slice("splice-right-".length);
  }
  if (edgeId.startsWith("splice-")) {
    return edgeId.slice("splice-".length);
  }
  return null;
}

export function touchedConnectionIdsFromEdgeIds(
  touchedEdgeIds: Set<string>,
): Set<string> {
  const ids = new Set<string>();
  for (const edgeId of touchedEdgeIds) {
    const connId = connectionIdFromSpliceEdgeId(edgeId);
    if (connId) ids.add(connId);
  }
  return ids;
}

function legPathsForConnection(
  edges: Edge[],
  connectionId: string,
): {
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
} | null {
  const leftEdge = edges.find((e) => e.id === `splice-left-${connectionId}`);
  if (!leftEdge) return null;
  const data = (leftEdge.data ?? {}) as {
    leftPath?: string;
    rightPath?: string;
    spliceX?: number;
    spliceY?: number;
  };
  const leftPath = String(data.leftPath ?? "");
  const rightPath = String(data.rightPath ?? "");
  if (!leftPath || !rightPath) return null;
  return {
    leftPath,
    rightPath,
    spliceX: Number(data.spliceX ?? 0),
    spliceY: Number(data.spliceY ?? 0),
  };
}

function verticalLaneXsFromPaths(leftPath: string, rightPath: string): number[] {
  const xs: number[] = [];
  for (const path of [leftPath, rightPath]) {
    for (const seg of pathToLegSegments(path)) {
      if (seg.kind === "v" && Math.abs(seg.y1 - seg.y0) > 8) {
        xs.push(seg.x);
      }
    }
  }
  return xs;
}

/** Path-based advisory checks for touched splice connections (nodes engine split edges). */
export function manualLayoutWarningsForConnections(
  edges: Edge[],
  touchedConnectionIds: Set<string>,
): ManualLayoutWarning[] {
  const warnings: ManualLayoutWarning[] = [];
  const laneXsByConnection: Array<{ connectionId: string; xs: number[] }> = [];

  for (const connectionId of touchedConnectionIds) {
    const paths = legPathsForConnection(edges, connectionId);
    if (!paths) continue;

    const { leftPath, rightPath, spliceX, spliceY } = paths;

    if (!pathsWithinBendBudget(leftPath, rightPath)) {
      const bends = countOrthogonalBends(leftPath, rightPath);
      warnings.push({
        connectionId,
        code: "EDGE-004",
        message: `${connectionId}: ${bends} bends (max 2)`,
      });
    }

    if (!fusionDotOnHorizontalSegment(spliceX, spliceY, leftPath, rightPath)) {
      warnings.push({
        connectionId,
        code: "DOT-001",
        message: `${connectionId}: fusion dot not on horizontal segment`,
      });
    }

    if (
      !fusionDotCornerClearanceOk(spliceX, spliceY, leftPath, rightPath)
    ) {
      warnings.push({
        connectionId,
        code: "DOT-003",
        message: `${connectionId}: fusion dot within 48px of leg corner`,
      });
    }

    if (
      !fusionDotVerticalLaneClearanceOk(spliceX, spliceY, leftPath, rightPath)
    ) {
      warnings.push({
        connectionId,
        code: "DOT-004",
        message: `${connectionId}: vertical leg within 48px of fusion dot`,
      });
    }

    laneXsByConnection.push({
      connectionId,
      xs: verticalLaneXsFromPaths(leftPath, rightPath),
    });
  }

  for (let i = 0; i < laneXsByConnection.length; i++) {
    for (let j = i + 1; j < laneXsByConnection.length; j++) {
      const a = laneXsByConnection[i]!;
      const b = laneXsByConnection[j]!;
      for (const xA of a.xs) {
        for (const xB of b.xs) {
          if (Math.abs(xA - xB) < MIN_LANE_SEPARATION) {
            warnings.push({
              connectionId: a.connectionId,
              code: "EDGE-012",
              message: `Lanes ${a.connectionId} and ${b.connectionId} within ${MIN_LANE_SEPARATION}px`,
            });
          }
        }
      }
    }
  }

  return warnings;
}

/** @deprecated Use manualLayoutWarningsForConnections — kept for import stability. */
export function manualLayoutWarningsForEdges(
  _entries: unknown[],
  edges: Edge[],
  touchedEdgeIds: Set<string>,
  _diagramCenterX: number,
): ManualLayoutWarning[] {
  return manualLayoutWarningsForConnections(
    edges,
    touchedConnectionIdsFromEdgeIds(touchedEdgeIds),
  );
}

export function formatManualLayoutWarningBanner(
  warnings: ManualLayoutWarning[],
): string | null {
  if (warnings.length === 0) return null;
  const edge004 = warnings.filter((w) => w.code === "EDGE-004").length;
  const edge012 = warnings.filter((w) => w.code === "EDGE-012").length;
  const dot001 = warnings.filter((w) => w.code === "DOT-001").length;
  const dot003 = warnings.filter((w) => w.code === "DOT-003").length;
  const dot004 = warnings.filter((w) => w.code === "DOT-004").length;
  const parts: string[] = [];
  if (edge004 > 0) {
    parts.push(
      `${edge004} strand${edge004 === 1 ? "" : "s"} exceed 2-bend limit`,
    );
  }
  if (edge012 > 0) {
    parts.push(
      `${edge012} lane overlap${edge012 === 1 ? "" : "s"} (<24px)`,
    );
  }
  if (dot001 > 0) {
    parts.push(
      `${dot001} fusion dot${dot001 === 1 ? "" : "s"} off horizontal leg`,
    );
  }
  if (dot003 > 0) {
    parts.push(
      `${dot003} fusion dot${dot003 === 1 ? "" : "s"} too close to corner`,
    );
  }
  if (dot004 > 0) {
    parts.push(
      `${dot004} vertical leg${dot004 === 1 ? "" : "s"} too close to fusion dot`,
    );
  }
  return `${parts.join("; ")} — manual override kept`;
}
