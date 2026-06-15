import type { Edge } from "@xyflow/react";

/**
 * Mode-agnostic helpers for marking a splice "existing" (grey dashed = legacy /
 * protect-in-place). A fiber splice is two split leg edges (`splice-left-*`,
 * `splice-right-*`); a collapsed buffer-tube butt is one `butt-*` edge. The
 * "existing" state belongs to the whole connection, so both legs flip together.
 */

/** Connection key for an edge: the butt edge id itself, else the connection id. */
export function legConnectionId(edgeId: string): string {
  if (edgeId.startsWith("butt-")) return edgeId;
  return edgeId
    .replace(/^splice-(?:left|right)-/, "")
    .replace(/^splice-/, "");
}

function edgeIdsForConnection(connectionId: string): Set<string> {
  if (connectionId.startsWith("butt-")) return new Set([connectionId]);
  return new Set([
    `splice-left-${connectionId}`,
    `splice-right-${connectionId}`,
    `splice-${connectionId}`,
  ]);
}

/** Current existing state of a connection (read from its primary edge). */
export function isConnectionExisting(
  edges: Edge[],
  connectionId: string,
): boolean {
  const ids = edgeIdsForConnection(connectionId);
  const edge = edges.find((e) => ids.has(e.id));
  return Boolean((edge?.data as { existing?: boolean } | undefined)?.existing);
}

/** Set `existing` on every edge belonging to the given connections (both legs). */
export function setConnectionsExisting(
  edges: Edge[],
  connectionIds: Iterable<string>,
  value: boolean,
): Edge[] {
  const targets = new Set<string>();
  for (const connectionId of connectionIds) {
    for (const id of edgeIdsForConnection(connectionId)) targets.add(id);
  }
  if (targets.size === 0) return edges;
  let changed = false;
  const next = edges.map((edge) => {
    if (!targets.has(edge.id)) return edge;
    const current = Boolean(
      (edge.data as { existing?: boolean } | undefined)?.existing,
    );
    if (current === value) return edge;
    changed = true;
    return { ...edge, data: { ...edge.data, existing: value } };
  });
  return changed ? next : edges;
}
