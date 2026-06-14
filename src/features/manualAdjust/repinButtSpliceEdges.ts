import type { Edge, Node } from "@xyflow/react";

import type { CableNodeData } from "@/features/canvas/nodes/types";
import {
  buildButtSplicePath,
  defaultSideCircuitLabelSpan,
  parseTubeHandleId,
  routingLaneFromData,
  tubeHandlePosition,
} from "@/features/canvas/edges/splicePathGeometry";
import type { SideCircuitLabelSpan } from "@/features/diagram/cableLabels";
import { tubeKeyFor } from "@/features/diagram/tubeRowShift";
import {
  buildVisualCablesForLayout,
  type VisualCable,
} from "@/features/diagram/visualCables";
import type {
  ConnectionGraph,
  TubeColorCode,
  TubeManualOverride,
  TubeOverrideKey,
} from "@/types/splice";

function visualCableFromCableNode(
  vc: VisualCable,
  cableData: CableNodeData,
  vcId: string,
  tubePreview?: ReadonlyMap<TubeOverrideKey, TubeManualOverride>,
): VisualCable {
  const tubeByColor = new Map(cableData.tubes.map((t) => [t.tubeColor, t]));
  return {
    ...vc,
    // Keep butt-handle repin aligned with the live rendered side in manual mode.
    side: cableData.side ?? vc.side,
    tubes: vc.tubes.map((tube) => {
      const live = tubeByColor.get(tube.tubeColor);
      const preview = tubePreview?.get(tubeKeyFor(vcId, tube.tubeColor));
      if (!live && !preview) return tube;
      return {
        ...tube,
        visualShiftY:
          preview?.visualShiftY ?? live?.visualShiftY ?? tube.visualShiftY,
        stemReachX:
          preview?.stemReachX ?? live?.stemReachX ?? tube.stemReachX,
      };
    }),
  };
}

function isButtEdge(edge: Edge): boolean {
  const data = (edge.data ?? {}) as { fullButtSplice?: boolean };
  return data.fullButtSplice === true || edge.id.startsWith("butt-");
}

function edgeTouchesTubeKey(edge: Edge, tubeKey: TubeOverrideKey): boolean {
  const [vcId, tubeColor] = tubeKey.split("|") as [string, TubeColorCode];
  const sourceTube = parseTubeHandleId(edge.sourceHandle);
  const targetTube = parseTubeHandleId(edge.targetHandle);
  if (
    edge.source === `cable-${vcId}` &&
    sourceTube?.tubeColor === tubeColor
  ) {
    return true;
  }
  if (
    edge.target === `cable-${vcId}` &&
    targetTube?.tubeColor === tubeColor
  ) {
    return true;
  }
  return false;
}

function buttHandlePosition(
  cableNode: Node,
  vc: VisualCable,
  tubeColor: TubeColorCode,
  vcId: string,
  tubePreview?: ReadonlyMap<TubeOverrideKey, TubeManualOverride>,
): { x: number; y: number } {
  const cableData = cableNode.data as CableNodeData;
  const liveVc = visualCableFromCableNode(vc, cableData, vcId, tubePreview);
  return tubeHandlePosition(
    liveVc,
    tubeColor,
    cableNode.position,
    cableData.diagramScale ?? 1,
    cableData.alignedStemX,
  );
}

export type RepinButtSpliceEdgesOptions = {
  tubeKeys: Iterable<TubeOverrideKey>;
  tubePreview?: ReadonlyMap<TubeOverrideKey, TubeManualOverride>;
};

/** Rebuild precomputed butt-splice paths after collapsed tube handle Y moves. */
export function repinButtSpliceEdges(
  nodes: Node[],
  edges: Edge[],
  graph: ConnectionGraph,
  options: RepinButtSpliceEdgesOptions,
): { edges: Edge[]; touchedEdgeIds: Set<string> } {
  const tubeKeySet = new Set(options.tubeKeys);
  if (tubeKeySet.size === 0) {
    return { edges, touchedEdgeIds: new Set() };
  }

  const { visualCables } = buildVisualCablesForLayout(graph);
  const vcById = new Map(visualCables.map((vc) => [vc.id, vc]));
  const cableById = new Map(
    nodes.filter((n) => n.type === "cable").map((n) => [n.id, n]),
  );

  const touchedEdgeIds = new Set<string>();
  let changed = false;
  const nextEdges = edges.map((edge) => {
    if (!isButtEdge(edge)) return edge;
    if (![...tubeKeySet].some((key) => edgeTouchesTubeKey(edge, key))) {
      return edge;
    }

    const sourceNode = cableById.get(String(edge.source));
    const targetNode = cableById.get(String(edge.target));
    const sourceVcId = String(edge.source).replace(/^cable-/, "");
    const targetVcId = String(edge.target).replace(/^cable-/, "");
    const sourceVc = vcById.get(sourceVcId);
    const targetVc = vcById.get(targetVcId);
    const sourceTube = parseTubeHandleId(edge.sourceHandle);
    const targetTube = parseTubeHandleId(edge.targetHandle);
    if (
      !sourceNode ||
      !targetNode ||
      !sourceVc ||
      !targetVc ||
      !sourceTube ||
      !targetTube
    ) {
      return edge;
    }

    const edgeData = (edge.data ?? {}) as {
      laneIndex?: number;
      laneCount?: number;
      diagramCenterX?: number;
      sideCircuitSpan?: SideCircuitLabelSpan;
      routingMidX?: number;
      leftPath?: string;
      rightPath?: string;
      spliceX?: number;
      spliceY?: number;
    };

    const lane = routingLaneFromData(edgeData);
    const midX = lane?.midX ?? edgeData.routingMidX;
    if (midX === undefined) return edge;

    const sourcePos = buttHandlePosition(
      sourceNode,
      sourceVc,
      sourceTube.tubeColor,
      sourceVcId,
      options.tubePreview,
    );
    const targetPos = buttHandlePosition(
      targetNode,
      targetVc,
      targetTube.tubeColor,
      targetVcId,
      options.tubePreview,
    );

    const sideSpans =
      edgeData.sideCircuitSpan ?? defaultSideCircuitLabelSpan();
    const diagramCenterX =
      edgeData.diagramCenterX ?? (sourcePos.x + targetPos.x) / 2;
    const laneIndex = edgeData.laneIndex ?? 0;
    const laneCount = Math.max(1, edgeData.laneCount ?? 1);

    const pathResult = buildButtSplicePath(
      sourcePos.x,
      sourcePos.y,
      targetPos.x,
      targetPos.y,
      midX,
      sideSpans,
      diagramCenterX,
      laneIndex,
      laneCount,
    );

    if (
      edgeData.leftPath === pathResult.leftPath &&
      edgeData.rightPath === pathResult.rightPath &&
      edgeData.spliceX === pathResult.spliceX &&
      edgeData.spliceY === pathResult.spliceY
    ) {
      return edge;
    }

    changed = true;
    touchedEdgeIds.add(edge.id);
    return {
      ...edge,
      data: {
        ...(edge.data as Record<string, unknown>),
        routingPrecomputed: true,
        leftPath: pathResult.leftPath,
        rightPath: pathResult.rightPath,
        spliceX: pathResult.spliceX,
        spliceY: pathResult.spliceY,
      },
    };
  });

  return {
    edges: changed ? nextEdges : edges,
    touchedEdgeIds,
  };
}

/** True when the tube is collapsed on its cable node. */
export function isCollapsedTubeKey(
  nodes: Node[],
  tubeKey: TubeOverrideKey,
): boolean {
  const [vcId, tubeColor] = tubeKey.split("|") as [string, TubeColorCode];
  const cableNode = nodes.find((n) => n.id === `cable-${vcId}`);
  if (!cableNode) return false;
  const collapsed = (cableNode.data as CableNodeData).collapsedTubes ?? [];
  return collapsed.includes(tubeColor);
}
