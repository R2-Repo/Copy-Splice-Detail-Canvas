import type { Edge, Node } from "@xyflow/react";

import type { CableNodeData } from "@/features/canvas/nodes/types";
import {
  fiberHandlePosition,
  parseOrthogonalPathPoints,
} from "@/features/canvas/edges/splicePathGeometry";
import { SPLICE_LANE_SEP } from "@/features/diagram/cableLayoutMetrics";
import type { ConnectionGraph } from "@/types/splice";
import {
  buildVisualCablesForLayout,
  type VisualCable,
} from "@/features/diagram/visualCables";

import {
  buildHandleCoordsCache,
  handleCoordsForConnection,
} from "./handleCoords";
import {
  pathEndPoint,
  pathStartPoint,
  removeOrthogonalReversals,
  repinLegEnd,
  repinLegStart,
  shiftVerticalLaneX,
} from "./legSegments";
import { syncSplicePointNodes } from "./syncSplicePointNodes";

type SpliceLaneData = {
  leftPath?: string;
  rightPath?: string;
  spliceX?: number;
  spliceY?: number;
};

const ANCHOR_DOT = 6;
const STACK_EPS = 0.5;
const STACK_SEP_X = SPLICE_LANE_SEP;

function visualCableFromCableNode(
  vc: VisualCable,
  cableData: CableNodeData,
): VisualCable {
  const tubeByColor = new Map(cableData.tubes.map((t) => [t.tubeColor, t]));
  return {
    ...vc,
    // During manual drags, node.data.side is the live rendered side; graph
    // cableSides can lag behind until drag-stop persistence.
    side: cableData.side ?? vc.side,
    tubes: vc.tubes.map((tube) => {
      const live = tubeByColor.get(tube.tubeColor);
      if (!live) return tube;
      return {
        ...tube,
        visualShiftY: live.visualShiftY ?? tube.visualShiftY,
        stemReachX: live.stemReachX ?? tube.stemReachX,
      };
    }),
  };
}

function positionNear(
  a: { x: number; y: number },
  b: { x: number; y: number },
  tolerance = 0.5,
): boolean {
  return Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance;
}

type VerticalRun = {
  segmentIndex: number;
  x: number;
  y0: number;
  y1: number;
};

function longestVerticalRun(path: string): VerticalRun | null {
  const pts = parseOrthogonalPathPoints(path);
  let best: VerticalRun | null = null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (Math.abs(a.x - b.x) > STACK_EPS) continue;
    const y0 = Math.min(a.y, b.y);
    const y1 = Math.max(a.y, b.y);
    if (y1 - y0 <= STACK_EPS) continue;
    if (!best || y1 - y0 > best.y1 - best.y0) {
      best = { segmentIndex: i, x: a.x, y0, y1 };
    }
  }
  return best;
}

function columnDeltaX(column: number): number {
  if (column <= 0) return 0;
  const step = Math.ceil(column / 2);
  return (column % 2 === 1 ? 1 : -1) * step * STACK_SEP_X;
}

function patchConnectionPaths(
  connectionId: string,
  changedSide: "left" | "right",
  changedPath: string,
  edgePatches: Map<string, Edge>,
  edgeById: Map<string, Edge>,
): void {
  const leftId = `splice-left-${connectionId}`;
  const rightId = `splice-right-${connectionId}`;
  const leftEdge = edgePatches.get(leftId) ?? edgeById.get(leftId);
  const rightEdge = edgePatches.get(rightId) ?? edgeById.get(rightId);
  if (!leftEdge) return;
  const data = (leftEdge.data ?? {}) as SpliceLaneData;
  const leftPath =
    changedSide === "left" ? changedPath : String(data.leftPath ?? "");
  const rightPath =
    changedSide === "right" ? changedPath : String(data.rightPath ?? "");
  if (!leftPath || !rightPath) return;
  const splice =
    changedSide === "left" ? pathEndPoint(leftPath) : pathStartPoint(rightPath);
  const patchData = {
    leftPath,
    rightPath,
    spliceX: splice.x,
    spliceY: splice.y,
  };
  edgePatches.set(leftId, {
    ...leftEdge,
    data: { ...(leftEdge.data as Record<string, unknown>), ...patchData },
  });
  if (rightEdge) {
    edgePatches.set(rightId, {
      ...rightEdge,
      data: { ...(rightEdge.data as Record<string, unknown>), ...patchData },
    });
  }
}

function deconflictMovedLegVerticalRuns(
  edgePatches: Map<string, Edge>,
  edgeById: Map<string, Edge>,
  touchedConnections: string[],
  movedLegByConnection: Map<string, "left" | "right">,
): void {
  const entries: Array<{
    connectionId: string;
    side: "left" | "right";
    path: string;
    run: VerticalRun;
  }> = [];
  for (const connectionId of touchedConnections) {
    const side = movedLegByConnection.get(connectionId);
    if (!side) continue;
    const leftId = `splice-left-${connectionId}`;
    const leftEdge = edgePatches.get(leftId) ?? edgeById.get(leftId);
    if (!leftEdge) continue;
    const data = (leftEdge.data ?? {}) as SpliceLaneData;
    const path = String(
      side === "left" ? data.leftPath ?? "" : data.rightPath ?? "",
    );
    if (!path) continue;
    const run = longestVerticalRun(path);
    if (!run) continue;
    entries.push({ connectionId, side, path, run });
  }
  if (entries.length < 2) return;

  const groups: typeof entries[] = [];
  for (const entry of [...entries].sort((a, b) => a.run.x - b.run.x)) {
    const group = groups.find((g) => Math.abs(g[0]!.run.x - entry.run.x) <= STACK_EPS);
    if (group) group.push(entry);
    else groups.push([entry]);
  }

  for (const group of groups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.run.y0 - b.run.y0);
    const laneEnds: number[] = [];
    for (const entry of sorted) {
      let lane = laneEnds.findIndex((endY) => entry.run.y0 > endY + STACK_EPS);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(entry.run.y1);
      } else {
        laneEnds[lane] = entry.run.y1;
      }
      const deltaX = columnDeltaX(lane);
      if (deltaX === 0) continue;
      const shifted = shiftVerticalLaneX(
        entry.path,
        entry.run.segmentIndex,
        deltaX,
      );
      if (shifted === entry.path) continue;
      patchConnectionPaths(
        entry.connectionId,
        entry.side,
        shifted,
        edgePatches,
        edgeById,
      );
    }
  }
}

/** Manual mode: move one cable's anchors + pin its leg ends only — no global reroute. */
export function syncManualVisualCable(
  nodes: Node[],
  edges: Edge[],
  graph: ConnectionGraph,
  visualCableId: string,
  cableNodeOverride?: Node,
): { nodes: Node[]; edges: Edge[]; touchedConnections: string[] } {
  const cableId = `cable-${visualCableId}`;
  const cableNode =
    cableNodeOverride?.id === cableId
      ? cableNodeOverride
      : nodes.find((n) => n.id === cableId);
  if (!cableNode || cableNode.type !== "cable") {
    return { nodes, edges, touchedConnections: [] };
  }

  const cableData = cableNode.data as CableNodeData;
  const { visualCables } = buildVisualCablesForLayout(graph);
  const vcRaw = visualCables.find((vc) => vc.id === visualCableId);
  if (!vcRaw) return { nodes, edges, touchedConnections: [] };

  const vc = visualCableFromCableNode(vcRaw, cableData);
  const collapsedOnCable = new Set(cableData.collapsedTubes ?? []);
  const connectionIds = vc.tubes.flatMap((t) =>
    collapsedOnCable.has(t.tubeColor)
      ? []
      : t.fibers.map((f) => f.connectionId),
  );

  const anchorPositions = new Map<string, { x: number; y: number }>();
  for (const connectionId of connectionIds) {
    const pos = fiberHandlePosition(
      vc,
      connectionId,
      cableNode.position,
      cableData.diagramScale ?? 1,
      cableData.alignedStemX,
    );
    anchorPositions.set(`fiberAnchor-${visualCableId}::${connectionId}`, {
      x: pos.x - ANCHOR_DOT / 2,
      y: pos.y - ANCHOR_DOT / 2,
    });
  }

  let nodesChanged = false;
  const nextNodes = nodes.map((n) => {
    if (n.id === cableId && n !== cableNode) {
      nodesChanged = true;
      return cableNode;
    }
    const anchorPos = anchorPositions.get(n.id);
    if (!anchorPos) return n;
    if (positionNear(n.position, anchorPos)) return n;
    nodesChanged = true;
    return { ...n, position: anchorPos };
  });

  const handleCache = buildHandleCoordsCache(
    nodesChanged ? nextNodes : nodes,
    graph,
  );
  const edgeById = new Map(edges.map((e) => [e.id, e]));
  const edgePatches = new Map<string, Edge>();
  const touchedConnections: string[] = [];
  const movedLegByConnection = new Map<string, "left" | "right">();

  for (const connectionId of connectionIds) {
    const handles = handleCoordsForConnection(
      connectionId,
      nodesChanged ? nextNodes : nodes,
      graph,
      handleCache,
    );
    if (!handles) continue;

    const leftId = `splice-left-${connectionId}`;
    const rightId = `splice-right-${connectionId}`;
    const leftEdge = edgeById.get(leftId);
    const rightEdge = edgeById.get(rightId);
    if (!leftEdge) continue;

    const pinsSource = handles.sourceVisualCableId === visualCableId;
    const pinsTarget = handles.targetVisualCableId === visualCableId;
    if (!pinsSource && !pinsTarget) continue;

    const data = (leftEdge.data ?? {}) as SpliceLaneData;

    // Manual mode is fully manual: re-pin only the moved cable's leg end(s) to
    // the new handle position and keep the existing leg shape + fusion dot.
    // No auto rerouting — lanes / midX are never recomputed here.
    const prevEdgeData = (edgePatches.get(leftId) ?? leftEdge).data as {
      leftPath?: string;
      rightPath?: string;
    };
    const prevLeft = String(prevEdgeData.leftPath ?? data.leftPath ?? "");
    const prevRight = String(prevEdgeData.rightPath ?? data.rightPath ?? "");
    if (!prevLeft || !prevRight) continue;

    let nextLeft = prevLeft;
    let nextRight = prevRight;
    if (pinsSource) nextLeft = repinLegStart(nextLeft, handles.source);
    if (pinsTarget) nextRight = repinLegEnd(nextRight, handles.target);
    // Keep both legs joined at the (otherwise unchanged) fusion dot.
    const splice = pinsSource
      ? pathEndPoint(nextLeft)
      : pathStartPoint(nextRight);
    if (pinsSource) nextRight = repinLegStart(nextRight, splice);
    else nextLeft = repinLegEnd(nextLeft, splice);

    // Sliding a leg end past a stale waypoint can leave a U-turn hook on its
    // lane (a broken-looking 90°). Drop those reversals — endpoint-preserving,
    // so the legs stay joined at the fusion dot computed above.
    nextLeft = removeOrthogonalReversals(nextLeft);
    nextRight = removeOrthogonalReversals(nextRight);

    if (prevLeft === nextLeft && prevRight === nextRight) {
      continue;
    }

    touchedConnections.push(connectionId);
    if (pinsSource && !pinsTarget) movedLegByConnection.set(connectionId, "left");
    else if (pinsTarget && !pinsSource) {
      movedLegByConnection.set(connectionId, "right");
    }
    const patchData = {
      leftPath: nextLeft,
      rightPath: nextRight,
      spliceX: splice.x,
      spliceY: splice.y,
    };
    edgePatches.set(leftId, {
      ...leftEdge,
      data: { ...(leftEdge.data as Record<string, unknown>), ...patchData },
    });
    if (rightEdge) {
      edgePatches.set(rightId, {
        ...rightEdge,
        data: { ...(rightEdge.data as Record<string, unknown>), ...patchData },
      });
    }
  }

  if (edgePatches.size > 0) {
    deconflictMovedLegVerticalRuns(
      edgePatches,
      edgeById,
      touchedConnections,
      movedLegByConnection,
    );
  }

  let resultNodes = nodesChanged ? nextNodes : nodes;
  let resultEdges = edges;

  if (edgePatches.size > 0) {
    resultEdges = edges.map((e) => edgePatches.get(e.id) ?? e);
    resultNodes = syncSplicePointNodes(
      resultNodes,
      resultEdges,
      touchedConnections,
    );
    if (resultNodes !== nodes) nodesChanged = true;
  }

  if (!nodesChanged && edgePatches.size === 0) {
    return { nodes, edges, touchedConnections: [] };
  }

  return {
    nodes: resultNodes,
    edges: resultEdges,
    touchedConnections,
  };
}
