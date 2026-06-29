import {
  cableLegIdForEndpoint,
  orderedFiberConnections,
  pairEndpointsForSide,
} from "@/features/diagram/buildConnectionGraph";
import {
  FIBER_ROW_PITCH,
  TUBE_GROUP_GAP,
} from "@/features/diagram/cableLayoutMetrics";
import { compareTubeColorsTia } from "@/features/diagram/colorCode";
import {
  connectionRowIndexMap,
  connectionRowOffsets,
} from "@/features/diagram/connectionRowOrder";
import type {
  CableLegId,
  ConnectionGraph,
  FiberColorAbbrev,
  FiberConnection,
  FiberEndpoint,
  TubeColorCode,
} from "@/types/splice";

export type VisualFiber = {
  connectionId: string;
  /** Additional splices on the same physical fiber (shared handle). */
  spliceConnectionIds?: string[];
  fiberNumber: number;
  fiberColor: FiberColorAbbrev;
  tubeColor: TubeColorCode;
  circuitName?: string;
  handleId: string;
  /** Global splice row (0-based) — ordering only. */
  rowIndex: number;
  /**
   * Compact offset within this cable (even 24px pitch, TIA fiber # order top→bottom).
   * Never stretched to match global splice-row gaps — spacing within a tube is fixed.
   */
  rowYOffset: number;
};

export type VisualTube = {
  tubeColor: TubeColorCode;
  fibers: VisualFiber[];
  /** Bounded Y shift for tube tip/handle only — fibers stay on row pitch. */
  visualShiftY?: number;
  /** Extra horizontal tube length toward center (manual fan-out reach). */
  stemReachX?: number;
};

export type VisualCable = {
  id: string;
  legId: CableLegId;
  device: string;
  cable: string;
  side: "left" | "right";
  order: number;
  tubes: VisualTube[];
};

type LegFiberRef = {
  connectionId: string;
  endpoint: FiberEndpoint;
  circuitName?: string;
  legId: CableLegId;
  rowIndex: number;
  rowYOffset: number;
};

function fibersForCable(
  graph: ConnectionGraph,
  cable: string,
  rowIndex: Map<string, number>,
  rowOffsets: Map<string, number>,
): LegFiberRef[] {
  const refs: LegFiberRef[] = [];
  for (const conn of orderedFiberConnections(graph)) {
    for (const ep of [conn.pair.endpointA, conn.pair.endpointB]) {
      if (ep.cable !== cable) continue;
      refs.push({
        connectionId: conn.id,
        endpoint: ep,
        circuitName: conn.pair.circuitName,
        legId: cableLegIdForEndpoint(ep),
        rowIndex: rowIndex.get(conn.id) ?? 0,
        rowYOffset: rowOffsets.get(conn.id) ?? 0,
      });
    }
  }
  return refs.sort((a, b) => a.rowIndex - b.rowIndex);
}

function primaryLegIdForCable(
  graph: ConnectionGraph,
  cable: string,
): CableLegId {
  const side = graph.cableSides.get(cable) ?? "left";
  const column = side === "left" ? "from" : "to";
  const preferred = graph.legs.find(
    (leg) => leg.cable === cable && leg.csvColumn === column,
  );
  if (preferred) return preferred.id;
  return graph.legs.find((leg) => leg.cable === cable)?.id ?? `${cable}::${column}`;
}

function uniqueCableNames(graph: ConnectionGraph): string[] {
  const names = new Set<string>();
  for (const leg of graph.legs) names.add(leg.cable);
  for (const conn of orderedFiberConnections(graph)) {
    names.add(conn.pair.endpointA.cable);
    names.add(conn.pair.endpointB.cable);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Even strand spacing inside one buffer tube; one row per TIA fiber # at 24px pitch. */
function compactTubeOffsets(fibers: LegFiberRef[]): Map<string, number> {
  const sorted = [...fibers].sort(
    (a, b) =>
      a.endpoint.fiberNumber - b.endpoint.fiberNumber ||
      a.rowIndex - b.rowIndex,
  );
  const offsets = new Map<string, number>();
  sorted.forEach((f, index) => {
    offsets.set(f.connectionId, index * FIBER_ROW_PITCH);
  });
  return offsets;
}

function dedupeTubeFibers(fibers: LegFiberRef[]): LegFiberRef[] {
  const byNumber = new Map<number, LegFiberRef[]>();
  for (const f of fibers) {
    const fn = f.endpoint.fiberNumber;
    const list = byNumber.get(fn) ?? [];
    list.push(f);
    byNumber.set(fn, list);
  }
  return [...byNumber.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, refs]) =>
      [...refs].sort((a, b) => a.rowIndex - b.rowIndex)[0]!,
    );
}

function connectionIdsForTubeFiber(
  fibers: LegFiberRef[],
  primary: LegFiberRef,
): string[] {
  const fn = primary.endpoint.fiberNumber;
  return fibers
    .filter((f) => f.endpoint.fiberNumber === fn)
    .sort((a, b) => a.rowIndex - b.rowIndex)
    .map((f) => f.connectionId);
}

function buildTubes(fibers: LegFiberRef[]): VisualTube[] {
  const byTube = new Map<TubeColorCode, LegFiberRef[]>();
  for (const f of fibers) {
    const list = byTube.get(f.endpoint.tubeColor) ?? [];
    list.push(f);
    byTube.set(f.endpoint.tubeColor, list);
  }

  let tubeBaseOffset = 0;
  const tubes: VisualTube[] = [];

  for (const [tubeColor, tubeFibers] of [...byTube.entries()].sort(([a], [b]) =>
    compareTubeColorsTia(a, b),
  )) {
    const sorted = dedupeTubeFibers(tubeFibers);
    const compact = compactTubeOffsets(sorted);
    const maxCompact = sorted.reduce(
      (max, f) => Math.max(max, compact.get(f.connectionId) ?? 0),
      0,
    );

    tubes.push({
      tubeColor,
      fibers: sorted.map((f) => {
        const spliceConnectionIds = connectionIdsForTubeFiber(tubeFibers, f);
        return {
          connectionId: f.connectionId,
          spliceConnectionIds:
            spliceConnectionIds.length > 1 ? spliceConnectionIds : undefined,
          fiberNumber: f.endpoint.fiberNumber,
          fiberColor: f.endpoint.fiberColor,
          tubeColor: f.endpoint.tubeColor,
          circuitName: f.circuitName,
          handleId: `${f.legId}::${f.endpoint.tubeColor}::${f.endpoint.fiberNumber}`,
          rowIndex: f.rowIndex,
          rowYOffset: tubeBaseOffset + (compact.get(f.connectionId) ?? 0),
        };
      }),
    });

    if (sorted.length > 0) {
      tubeBaseOffset += maxCompact + FIBER_ROW_PITCH + TUBE_GROUP_GAP;
    }
  }

  return tubes;
}

function groupKey(cable: string): string {
  return cable;
}

export function buildVisualCables(graph: ConnectionGraph): VisualCable[] {
  const rowIndex = connectionRowIndexMap(graph);
  const rowOffsets = connectionRowOffsets(graph);
  const groups = new Map<
    string,
    {
      side: "left" | "right";
      cable: string;
      legId: CableLegId;
      fibers: LegFiberRef[];
    }
  >();

  for (const cable of uniqueCableNames(graph)) {
    const fibers = fibersForCable(graph, cable, rowIndex, rowOffsets);
    if (fibers.length === 0) continue;

    groups.set(groupKey(cable), {
      side: graph.cableSides.get(cable) ?? "left",
      cable,
      legId: primaryLegIdForCable(graph, cable),
      fibers,
    });
  }

  const visual: VisualCable[] = [];
  let orderLeft = 0;
  let orderRight = 0;

  for (const [key, group] of groups) {
    const sortedFibers = [...group.fibers].sort(
      (a, b) => a.rowIndex - b.rowIndex,
    );
    const baseOrder = group.side === "left" ? orderLeft++ : orderRight++;

    visual.push({
      id: key,
      legId: group.legId,
      device: "",
      cable: group.cable,
      side: group.side,
      order: baseOrder,
      tubes: buildTubes(sortedFibers),
    });
  }

  return visual;
}

export function buildVisualCablesForLayout(graph: ConnectionGraph): {
  visualCables: VisualCable[];
} {
  return { visualCables: buildVisualCables(graph) };
}

export function parentVisualGroupKey(visualId: string): string {
  return visualId.replace(/~\d+$/, "");
}

export function visualGroupForConnection(
  visualCables: VisualCable[],
  connectionId: string,
  side: "left" | "right",
): string | undefined {
  const vc = visualCables.find(
    (v) =>
      v.side === side &&
      v.tubes.some((t) =>
        t.fibers.some(
          (f) =>
            f.connectionId === connectionId ||
            f.spliceConnectionIds?.includes(connectionId),
        ),
      ),
  );
  return vc ? parentVisualGroupKey(vc.id) : undefined;
}

function fiberMatchesConnection(
  fiber: VisualFiber,
  connectionId: string,
): boolean {
  return (
    fiber.connectionId === connectionId ||
    fiber.spliceConnectionIds?.includes(connectionId) === true
  );
}

export function findVisualCableForConnection(
  visualCables: VisualCable[],
  connectionId: string,
  options?: { cable?: string; canvasSide?: "left" | "right" },
): VisualCable | undefined {
  return visualCables.find((vc) => {
    if (options?.cable && vc.cable !== options.cable) return false;
    if (options?.canvasSide && vc.side !== options.canvasSide) return false;
    return vc.tubes.some((t) =>
      t.fibers.some((f) => fiberMatchesConnection(f, connectionId)),
    );
  });
}

export function findVisualCableForTube(
  visualCables: VisualCable[],
  legId: CableLegId,
  tubeColor: TubeColorCode,
  side: "left" | "right",
): VisualCable | undefined {
  return visualCables.find(
    (vc) =>
      vc.side === side &&
      vc.legId === legId &&
      vc.tubes.some((t) => t.tubeColor === tubeColor),
  );
}

export function endpointOnVisualSide(
  conn: FiberConnection,
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  side: "left" | "right",
): {
  visualCableId: string;
  handleId: string;
  endpoint: FiberEndpoint;
  canvasSide: "left" | "right";
} | null {
  const ends = pairEndpointsForSide(conn.pair, graph);
  const ep = side === "left" ? ends.left : ends.right;
  const vc = findVisualCableForConnection(visualCables, conn.id, {
    cable: ep.cable,
  });
  if (!vc) return null;
  const fiber = vc.tubes
    .flatMap((t) => t.fibers)
    .find((f) => fiberMatchesConnection(f, conn.id));
  if (!fiber) return null;
  return {
    visualCableId: vc.id,
    handleId: fiber.handleId,
    endpoint: ep,
    canvasSide: vc.side,
  };
}
