import type { Edge } from "@xyflow/react";

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
 * Those fibers have the same from/to and travel together as a "shared run", so
 * grabbing one is almost always an intent to move the whole bundle. Falls back
 * to just the grabbed connection when it carries no bundle key.
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
