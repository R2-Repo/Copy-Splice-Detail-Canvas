/**
 * Smart selection helpers for manual adjust (bundles, tube groups, drag targets).
 */
import type { Edge } from "@xyflow/react";

import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { tubeKeyFor, type TubeKey } from "@/features/diagram/tubeRowShift";
import type { ConnectionGraph } from "@/types/splice";

import type { ManualAdjustSelection } from "./types";

type SpliceEdgeBundleData = {
  tubeBundleKey?: string;
};

function leftEdgeFor(edges: Edge[], connectionId: string): Edge | undefined {
  return edges.find((e) => e.id === `splice-left-${connectionId}`);
}

function bundleKeyForConnection(
  edges: Edge[],
  connectionId: string,
): string | undefined {
  const data = leftEdgeFor(edges, connectionId)?.data as
    | SpliceEdgeBundleData
    | undefined;
  return data?.tubeBundleKey;
}

/**
 * Smart bundle selection. Returns every connection whose left leg shares this
 * leg's `tubeBundleKey` (same source buffer tube -> same destination cable).
 */
export function bundleConnectionIds(
  edges: Edge[],
  connectionId: string,
): string[] {
  const key = bundleKeyForConnection(edges, connectionId);
  if (!key) return [connectionId];
  const ids: string[] = [];
  for (const edge of edges) {
    if (!edge.id.startsWith("splice-left-")) continue;
    const edgeKey = (edge.data as SpliceEdgeBundleData | undefined)
      ?.tubeBundleKey;
    if (edgeKey === key) {
      ids.push(edge.id.slice("splice-left-".length));
    }
  }
  if (!ids.includes(connectionId)) ids.push(connectionId);
  return ids;
}

/** All splice connections on the same source buffer tube (partial tube group). */
export function sameSourceTubeConnectionIds(
  graph: ConnectionGraph,
  connectionId: string,
  visualCableId: string,
): string[] {
  const tubeKey = tubeKeyForFiberAnchor(graph, connectionId, visualCableId);
  if (!tubeKey) return [connectionId];
  const vcId = tubeKey.split("|")[0]!;
  const tubeColor = tubeKey.split("|")[1]!;
  const { visualCables } = buildVisualCablesForLayout(graph);
  const vc = visualCables.find((v) => v.id === vcId);
  if (!vc) return [connectionId];
  const tube = vc.tubes.find((t) => t.tubeColor === tubeColor);
  if (!tube) return [connectionId];
  const ids = tube.fibers.map((f) => f.connectionId);
  return ids.length > 0 ? ids : [connectionId];
}

export function tubeKeyForFiberAnchor(
  graph: ConnectionGraph,
  connectionId: string,
  visualCableId: string,
): TubeKey | null {
  const { visualCables } = buildVisualCablesForLayout(graph);
  const vc = visualCables.find((v) => v.id === visualCableId);
  if (!vc) return null;
  for (const tube of vc.tubes) {
    if (tube.fibers.some((f) => f.connectionId === connectionId)) {
      return tubeKeyFor(visualCableId, tube.tubeColor);
    }
  }
  return null;
}

/** Unique tube keys for a set of connections on one visual cable. */
export function tubeKeysForConnectionsOnCable(
  graph: ConnectionGraph,
  connectionIds: Iterable<string>,
  visualCableId: string,
): TubeKey[] {
  const keys = new Set<TubeKey>();
  for (const id of connectionIds) {
    const key = tubeKeyForFiberAnchor(graph, id, visualCableId);
    if (key) keys.add(key);
  }
  return [...keys];
}

/**
 * Connection ids to move when dragging a fiber anchor.
 * Shift → smart bundle; active multi-select → selection; else same source tube group.
 */
export function dragConnectionIdsForFiberAnchor(
  edges: Edge[],
  graph: ConnectionGraph,
  connectionId: string,
  visualCableId: string,
  selection: ManualAdjustSelection,
  options?: { shiftKey?: boolean; preferSelection?: boolean },
): string[] {
  if (options?.shiftKey) {
    return bundleConnectionIds(edges, connectionId);
  }
  if (
    options?.preferSelection !== false &&
    selection.connectionIds.has(connectionId) &&
    selection.connectionIds.size > 1
  ) {
    return [...selection.connectionIds];
  }
  return sameSourceTubeConnectionIds(graph, connectionId, visualCableId);
}
