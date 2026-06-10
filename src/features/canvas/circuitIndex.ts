import { orderedFiberConnections } from "@/features/diagram/buildConnectionGraph";
import type { ConnectionGraph } from "@/types/splice";

/** Same trim/collapse-whitespace as formatCircuitTag. */
export function normalizeCircuitName(name: string | undefined): string | undefined {
  if (name === undefined) return undefined;
  const normalized = name.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}

export type CircuitIndex = {
  /** Sorted unique circuit names in the diagram. */
  names: string[];
  /** Normalized name → splice connection ids carrying that OS. */
  byName: Map<string, Set<string>>;
};

export function buildCircuitIndex(graph: ConnectionGraph): CircuitIndex {
  const byName = new Map<string, Set<string>>();

  for (const conn of orderedFiberConnections(graph)) {
    const name = normalizeCircuitName(conn.pair.circuitName);
    if (!name) continue;
    let ids = byName.get(name);
    if (!ids) {
      ids = new Set<string>();
      byName.set(name, ids);
    }
    ids.add(conn.id);
  }

  const names = [...byName.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );

  return { names, byName };
}

export function pairCountForCircuit(index: CircuitIndex, name: string): number {
  return index.byName.get(name)?.size ?? 0;
}

export function connectionMatchesHighlight(
  connectionId: string,
  spliceConnectionIds: string[] | undefined,
  highlighted: ReadonlySet<string>,
): boolean {
  if (highlighted.size === 0) return false;
  if (highlighted.has(connectionId)) return true;
  return spliceConnectionIds?.some((id) => highlighted.has(id)) ?? false;
}

/** Parse splice / butt edge id → connection id(s) for highlight checks. */
export function connectionIdsFromEdgeId(
  edgeId: string,
  pairIds?: string[],
): string[] {
  if (edgeId.startsWith("splice-")) {
    return [edgeId.slice("splice-".length)];
  }
  if (edgeId.startsWith("butt-") && pairIds?.length) {
    return pairIds;
  }
  return [];
}
