import type { Edge, Node } from "@xyflow/react";

import { fiberHandlePosition } from "@/features/canvas/edges/spliceEdgeRouting";
import { colorHex } from "@/features/diagram/colorCode";
import {
  computeSpliceEdgeLayout,
  type ComputeSpliceLayoutOptions,
  type PrecomputedSpliceEdgeData,
} from "@/features/diagram/computeSpliceLayout";
import type { SpliceHandleEntry } from "@/features/diagram/centerRouter";
import type { VisualCable } from "@/features/diagram/visualCables";
import type { FiberColorAbbrev } from "@/types/splice";

import type {
  FiberAnchorNodeData,
  SplicePointNodeData,
} from "@/features/canvas/nodes/types";

const ANCHOR_DOT = 6;
const SPLICE_DOT = 9;

function connectionIdFromSpliceEdgeId(edgeId: string): string {
  if (edgeId.startsWith("splice-left-")) {
    return edgeId.slice("splice-left-".length);
  }
  if (edgeId.startsWith("splice-right-")) {
    return edgeId.slice("splice-right-".length);
  }
  return edgeId.replace(/^splice-/, "").replace(/^butt-/, "");
}

function fiberAnchorId(cableNodeId: string, connectionId: string): string {
  const visualCableId = cableNodeId.replace(/^cable-/, "");
  return `fiberAnchor-${visualCableId}::${connectionId}`;
}

/** Left leg or legacy composite edge — one per fiber connection. */
export function fiberSpliceRoutingEdges(edges: Edge[]): Edge[] {
  const seen = new Set<string>();
  const routed: Edge[] = [];
  for (const edge of edges) {
    if (edge.type !== "splice") continue;
    if (edge.id.startsWith("splice-right-") || edge.id.startsWith("butt-")) {
      continue;
    }
    const connectionId = connectionIdFromSpliceEdgeId(edge.id);
    if (seen.has(connectionId)) continue;
    seen.add(connectionId);
    routed.push(edge);
  }
  return routed;
}

/** Plan §3.1: fiberAnchor → splicePoint → fiberAnchor with precomputed leg paths. */
export function wireSplitSpliceEdges(
  routedEdges: Edge[],
  handleEntries: SpliceHandleEntry[],
): Edge[] {
  const entryById = new Map(handleEntries.map((e) => [e.id, e]));
  const wired: Edge[] = [];

  for (const edge of routedEdges) {
    if (edge.type !== "splice") {
      wired.push(edge);
      continue;
    }

    const data = (edge.data ?? {}) as PrecomputedSpliceEdgeData & {
      fullButtSplice?: boolean;
    };
    const entry = entryById.get(edge.id);

    if (
      !entry ||
      data.fullButtSplice === true ||
      edge.id.startsWith("butt-") ||
      data.routingPrecomputed !== true ||
      !data.leftPath ||
      !data.rightPath
    ) {
      wired.push(edge);
      continue;
    }

    const connectionId = connectionIdFromSpliceEdgeId(edge.id);
    const spliceId = `splicePoint-${connectionId}`;
    const sourceAnchor = fiberAnchorId(entry.sourceNodeId, connectionId);
    const targetAnchor = fiberAnchorId(entry.targetNodeId, connectionId);
    const shared = { ...data };

    wired.push({
      id: `splice-left-${connectionId}`,
      source: sourceAnchor,
      target: spliceId,
      sourceHandle: "out",
      targetHandle: "in",
      type: "splice",
      data: { ...shared, splitLeg: "left" as const },
    });
    wired.push({
      id: `splice-right-${connectionId}`,
      source: spliceId,
      target: targetAnchor,
      sourceHandle: "out",
      targetHandle: "in",
      type: "splice",
      data: { ...shared, splitLeg: "right" as const },
    });
  }

  return wired;
}

export function augmentNodesEngineGraph(
  cableNodes: Node[],
  edges: Edge[],
  visualCables: VisualCable[],
  diagramCenterX: number,
  options?: ComputeSpliceLayoutOptions,
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
    options,
  );

  const cableById = new Map(slimCables.map((n) => [n.id, n]));
  const anchorNodes: Node[] = [];
  const spliceNodes: Node[] = [];
  const seenAnchors = new Set<string>();
  const seenSplices = new Set<string>();

  const activeFiberConnIds = new Set<string>();
  for (const edge of routedEdges) {
    if (edge.type !== "splice") continue;
    if (edge.id.startsWith("butt-")) continue;
    activeFiberConnIds.add(edge.id.replace(/^splice-/, ""));
  }

  for (const vc of visualCables) {
    const cableNode = cableById.get(`cable-${vc.id}`);
    if (!cableNode) continue;
    const scale =
      (cableNode.data as { diagramScale?: number }).diagramScale ?? 1;
    const alignedStemX = (cableNode.data as { alignedStemX?: number })
      .alignedStemX;

    for (const fiber of vc.tubes.flatMap((t) => t.fibers)) {
      if (!activeFiberConnIds.has(fiber.connectionId)) continue;
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
    if (entry.fullButtSplice) continue;
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
      // Fusion dots are never dragged as React Flow nodes. In manual mode the
      // overlay handles dot drag via its own hit buttons; in auto mode they
      // must be fully inert. Keep them non-interactive in both modes.
      draggable: false,
      selectable: false,
    });
  }

  return {
    nodes: [...slimCables, ...anchorNodes, ...spliceNodes],
    edges: wireSplitSpliceEdges(routedEdges, handleEntries),
  };
}

export function anchorColorForFiber(fiberColor: FiberColorAbbrev): string {
  return colorHex(fiberColor);
}
