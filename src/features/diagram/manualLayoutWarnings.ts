import type { Edge } from "@xyflow/react";

import {
  buildButtSplicePath,
  buildSplicePath,
} from "@/features/canvas/edges/spliceEdgeRouting";
import type { SpliceHandleEntry } from "@/features/diagram/centerRouter";

const MAX_SPLICE_BENDS = 2;
const MIN_LANE_SEPARATION = 24;

export type ManualLayoutWarning = {
  edgeId: string;
  code: "EDGE-004" | "EDGE-012";
  message: string;
};

function bendCountForEdge(
  entry: SpliceHandleEntry,
  edge: Edge,
  diagramCenterX: number,
): number {
  const data = (edge.data ?? {}) as Record<string, unknown>;
  if (entry.fullButtSplice) {
    return buildButtSplicePath(
      entry.sourceX,
      entry.sourceY,
      entry.targetX,
      entry.targetY,
      (data.routingMidX as number | undefined) ?? diagramCenterX,
      undefined,
      diagramCenterX,
    ).bendCount;
  }
  const midX = (data.routingMidX as number) ?? diagramCenterX;
  return buildSplicePath(
    entry.sourceX,
    entry.sourceY,
    entry.targetX,
    entry.targetY,
    midX,
    data.routingJogX as number | undefined,
    {
      sourceHorizY: data.routingSourceHorizY as number | undefined,
      targetHorizY: data.routingTargetHorizY as number | undefined,
      sourceBendX: data.routingSourceBendX as number | undefined,
      targetBendX: data.routingTargetBendX as number | undefined,
    },
    undefined,
    diagramCenterX,
  ).bendCount;
}

/** Advisory checks for touched splice edges after manual edits. */
export function manualLayoutWarningsForEdges(
  entries: SpliceHandleEntry[],
  edges: Edge[],
  touchedEdgeIds: Set<string>,
  diagramCenterX: number,
): ManualLayoutWarning[] {
  const edgeById = new Map(edges.map((e) => [e.id, e]));
  const warnings: ManualLayoutWarning[] = [];
  const mids: { edgeId: string; midX: number }[] = [];

  for (const entry of entries) {
    if (!touchedEdgeIds.has(entry.id)) continue;
    const edge = edgeById.get(entry.id);
    if (!edge || edge.type !== "splice") continue;

    const bends = bendCountForEdge(entry, edge, diagramCenterX);
    if (bends > MAX_SPLICE_BENDS) {
      warnings.push({
        edgeId: entry.id,
        code: "EDGE-004",
        message: `${entry.id}: ${bends} bends (max ${MAX_SPLICE_BENDS})`,
      });
    }

    const data = (edge.data ?? {}) as Record<string, unknown>;
    const midX = (data.routingMidX as number) ?? diagramCenterX;
    mids.push({ edgeId: entry.id, midX });
  }

  for (let i = 0; i < mids.length; i++) {
    for (let j = i + 1; j < mids.length; j++) {
      const a = mids[i]!;
      const b = mids[j]!;
      if (Math.abs(a.midX - b.midX) < MIN_LANE_SEPARATION) {
        warnings.push({
          edgeId: a.edgeId,
          code: "EDGE-012",
          message: `Lanes ${a.edgeId} and ${b.edgeId} within ${MIN_LANE_SEPARATION}px`,
        });
      }
    }
  }

  return warnings;
}

export function formatManualLayoutWarningBanner(
  warnings: ManualLayoutWarning[],
): string | null {
  if (warnings.length === 0) return null;
  const edge004 = warnings.filter((w) => w.code === "EDGE-004").length;
  const edge012 = warnings.filter((w) => w.code === "EDGE-012").length;
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
  return `${parts.join("; ")} — manual override kept`;
}
