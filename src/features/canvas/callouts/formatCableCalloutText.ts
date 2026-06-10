export type CalloutFiberRef = {
  connectionId: string;
  fiberNumber: number;
  spliceConnectionIds?: string[];
};

export type CalloutEdgeRef = {
  id: string;
  data?: {
    existing?: boolean;
    pairIds?: string[];
  };
};

/** Merge sorted integers into compressed range strings, e.g. `1-4, 6-12, 40-48`. */
export function compressRanges(numbers: number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  if (sorted.length === 0) return "";

  const ranges: string[] = [];
  let start = sorted[0]!;
  let prev = sorted[0]!;

  for (let i = 1; i <= sorted.length; i++) {
    const n = sorted[i];
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    if (n !== undefined) {
      start = n;
      prev = n;
    }
  }

  return ranges.join(", ");
}

export function buildExistingConnectionIds(
  edges: readonly CalloutEdgeRef[],
): Set<string> {
  const ids = new Set<string>();
  for (const edge of edges) {
    if (!edge.data?.existing) continue;
    if (edge.id.startsWith("splice-")) {
      ids.add(edge.id.slice("splice-".length));
      continue;
    }
    if (edge.id.startsWith("butt-")) {
      for (const pairId of edge.data.pairIds ?? []) {
        ids.add(pairId);
      }
    }
  }
  return ids;
}

function connectionIsExisting(
  ref: CalloutFiberRef,
  existingIds: ReadonlySet<string>,
): boolean {
  if (existingIds.has(ref.connectionId)) return true;
  return (
    ref.spliceConnectionIds?.some((id) => existingIds.has(id)) ?? false
  );
}

export function formatCableCalloutText(
  cableLabel: string,
  fibers: readonly CalloutFiberRef[],
  edges: readonly CalloutEdgeRef[],
): string {
  const existingIds = buildExistingConnectionIds(edges);
  const allNumbers: number[] = [];
  const activeNumbers: number[] = [];

  for (const ref of fibers) {
    allNumbers.push(ref.fiberNumber);
    if (!connectionIsExisting(ref, existingIds)) {
      activeNumbers.push(ref.fiberNumber);
    }
  }

  if (allNumbers.length > 0 && activeNumbers.length === 0) {
    return `${cableLabel}\nExisting Protect in Place`;
  }

  const ranges = compressRanges(activeNumbers);
  const fiberLine = ranges.length > 0 ? `Fibers ${ranges}` : "Fibers";
  return `${cableLabel}\n${fiberLine}`;
}

export function calloutIdForCable(cableNodeId: string): string {
  return `callout-${cableNodeId}`;
}

export function fibersFromCableTubes(
  tubes: ReadonlyArray<{
    fibers: ReadonlyArray<{
      connectionId: string;
      fiberNumber: number;
      spliceConnectionIds?: string[];
    }>;
  }>,
): CalloutFiberRef[] {
  return tubes.flatMap((tube) =>
    tube.fibers.map((fiber) => ({
      connectionId: fiber.connectionId,
      fiberNumber: fiber.fiberNumber,
      spliceConnectionIds: fiber.spliceConnectionIds,
    })),
  );
}
