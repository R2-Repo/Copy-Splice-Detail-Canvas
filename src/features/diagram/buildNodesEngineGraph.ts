import type { Edge, Node } from "@xyflow/react";

import {
  fiberHandlePosition,
} from "@/features/canvas/edges/spliceEdgeRouting";
import { colorHex } from "@/features/diagram/colorCode";
import { computeSpliceEdgeLayout } from "@/features/diagram/computeSpliceLayout";
import type { VisualCable } from "@/features/diagram/visualCables";
import type { FiberColorAbbrev } from "@/types/splice";

import type {
  FiberAnchorNodeData,
  SplicePointNodeData,
} from "@/features/canvas/nodes/types";

const ANCHOR_DOT = 6;
const SPLICE_DOT = 8;

export function augmentNodesEngineGraph(
  cableNodes: Node[],
  edges: Edge[],
  visualCables: VisualCable[],
  diagramCenterX: number,
): { nodes: Node[]; edges: Edge[] } {
  const slimCables = cableNodes.map((node) =>
    node.type === "cable"
      ? {
          ...node,
          data: { ...(node.data as object), slim: true },
        }
      : node,
  );

  const { handleEntries, edges: routedEdges } = computeSpliceEdgeLayout(
    slimCables,
    edges,
    visualCables,
    diagramCenterX,
  );

  const cableById = new Map(slimCables.map((n) => [n.id, n]));
  const anchorNodes: Node[] = [];
  const spliceNodes: Node[] = [];
  const seenAnchors = new Set<string>();
  const seenSplices = new Set<string>();

  for (const vc of visualCables) {
    const cableNode = cableById.get(`cable-${vc.id}`);
    if (!cableNode) continue;
    const scale =
      (cableNode.data as { diagramScale?: number }).diagramScale ?? 1;
    const alignedStemX = (cableNode.data as { alignedStemX?: number })
      .alignedStemX;

    for (const fiber of vc.tubes.flatMap((t) => t.fibers)) {
      const anchorId = `fiberAnchor-${vc.id}::${fiber.connectionId}`;
      if (seenAnchors.has(anchorId)) continue;
      seenAnchors.add(anchorId);

      const pos = fiberHandlePosition(
        vc,
        fiber.connectionId,
        cableNode.position,
        scale,
        alignedStemX,
        fiber.circuitName,
      );

      anchorNodes.push({
        id: anchorId,
        type: "fiberAnchor",
        position: {
          x: pos.x - ANCHOR_DOT / 2,
          y: pos.y - ANCHOR_DOT / 2,
        },
        data: {
          connectionId: fiber.connectionId,
          fiberColor: fiber.fiberColor,
          fiberNumber: fiber.fiberNumber,
          tubeColor: fiber.tubeColor,
          side: vc.side,
          visualCableId: vc.id,
          circuitName: fiber.circuitName,
        } satisfies FiberAnchorNodeData,
        draggable: true,
        selectable: true,
      });
    }
  }

  for (const entry of handleEntries) {
    const connectionId = entry.id.replace(/^splice-/, "").replace(/^butt-/, "");
    const spliceId = `splicePoint-${connectionId}`;
    if (seenSplices.has(spliceId)) continue;
    seenSplices.add(spliceId);

    const edge = routedEdges.find((e) => e.id === entry.id);
    const edgeData = (edge?.data ?? {}) as {
      spliceX?: number;
      spliceY?: number;
      sourceColor?: string;
      targetColor?: string;
      fullButtSplice?: boolean;
    };

    const spliceX =
      edgeData.spliceX ??
      (entry.sourceX + entry.targetX) / 2;
    const spliceY =
      edgeData.spliceY ?? (entry.sourceY + entry.targetY) / 2;

    spliceNodes.push({
      id: spliceId,
      type: "splicePoint",
      position: {
        x: spliceX - SPLICE_DOT / 2,
        y: spliceY - SPLICE_DOT / 2,
      },
      data: {
        connectionId,
        sourceColor: edgeData.sourceColor ?? "#94a3b8",
        targetColor: edgeData.targetColor ?? "#94a3b8",
        fullButtSplice: entry.fullButtSplice,
      } satisfies SplicePointNodeData,
      draggable: true,
      selectable: true,
    });
  }

  return {
    nodes: [...slimCables, ...anchorNodes, ...spliceNodes],
    edges: routedEdges,
  };
}

export function anchorColorForFiber(fiberColor: FiberColorAbbrev): string {
  return colorHex(fiberColor);
}
