import { compareTubeColorsTia } from "@/features/diagram/colorCode";
import type {
  ConnectionGraph,
  CsvColumnRole,
  FiberEndpoint,
  FiberColorAbbrev,
  TubeColorCode,
} from "@/types/splice";

import { buildSpliceConnectionLines } from "./formatSpliceConnectionReport";
import type { SpliceReportOptions } from "./spliceReportTypes";

export type ConnectionInspectorSide = "left" | "right";

export type ConnectionInspectorStrand = {
  key: string;
  side: ConnectionInspectorSide;
  cable: string;
  csvColumn: CsvColumnRole;
  tubeColor: TubeColorCode;
  fiberNumber: number;
  fiberColor: FiberColorAbbrev;
  inferred: boolean;
  connectionIds: string[];
};

export type ConnectionInspectorConnection = {
  connectionId: string;
  left: FiberEndpoint;
  right: FiberEndpoint;
  leftInferred: boolean;
  rightInferred: boolean;
  leftStrandKey: string;
  rightStrandKey: string;
  circuitName?: string;
  existing?: boolean;
  fullButt?: boolean;
};

export type ConnectionInspectorModel = {
  connections: ConnectionInspectorConnection[];
  connectionById: Map<string, ConnectionInspectorConnection>;
  strandByKey: Map<string, ConnectionInspectorStrand>;
  connectionIdsByStrandKey: Map<string, string[]>;
  cableNamesBySide: Record<ConnectionInspectorSide, string[]>;
  strandKeysByCableSide: Record<ConnectionInspectorSide, Map<string, string[]>>;
};

type OrientedEndpoints = {
  left: FiberEndpoint;
  right: FiberEndpoint;
  leftInferred: boolean;
  rightInferred: boolean;
};

function sideEntryKey(cable: string, csvColumn: CsvColumnRole): string {
  return `${cable}\u001f${csvColumn}`;
}

function endpointSide(
  endpoint: FiberEndpoint,
  legSides: ReadonlyMap<string, ConnectionInspectorSide>,
): ConnectionInspectorSide | null {
  return legSides.get(sideEntryKey(endpoint.cable, endpoint.csvColumn)) ?? null;
}

function strandKey(
  side: ConnectionInspectorSide,
  endpoint: FiberEndpoint,
): string {
  return [
    side,
    endpoint.cable,
    endpoint.csvColumn,
    endpoint.tubeColor,
    String(endpoint.fiberNumber),
  ].join("\u001f");
}

function orientEndpoints(
  near: FiberEndpoint,
  far: FiberEndpoint,
  inferredNear: boolean,
  inferredFar: boolean,
  legSides: ReadonlyMap<string, ConnectionInspectorSide>,
): OrientedEndpoints {
  const nearSide = endpointSide(near, legSides);
  const farSide = endpointSide(far, legSides);

  if (nearSide === "left" && farSide === "right") {
    return {
      left: near,
      right: far,
      leftInferred: inferredNear,
      rightInferred: inferredFar,
    };
  }

  if (nearSide === "right" && farSide === "left") {
    return {
      left: far,
      right: near,
      leftInferred: inferredFar,
      rightInferred: inferredNear,
    };
  }

  return {
    left: near,
    right: far,
    leftInferred: inferredNear,
    rightInferred: inferredFar,
  };
}

function strandSort(
  a: ConnectionInspectorStrand,
  b: ConnectionInspectorStrand,
): number {
  return (
    compareTubeColorsTia(a.tubeColor, b.tubeColor) ||
    a.fiberNumber - b.fiberNumber ||
    a.fiberColor.localeCompare(b.fiberColor) ||
    a.csvColumn.localeCompare(b.csvColumn)
  );
}

function appendUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

export function buildConnectionInspectorModel(
  graph: ConnectionGraph,
  options?: SpliceReportOptions,
): ConnectionInspectorModel {
  const lines = buildSpliceConnectionLines(graph, options);
  const legSides = new Map<string, ConnectionInspectorSide>(
    graph.legs.map((leg) => [sideEntryKey(leg.cable, leg.csvColumn), leg.side]),
  );

  const connections: ConnectionInspectorConnection[] = [];
  const connectionById = new Map<string, ConnectionInspectorConnection>();
  const strandByKey = new Map<string, ConnectionInspectorStrand>();
  const connectionIdsByStrandKey = new Map<string, string[]>();
  const strandKeysByCableSideSets: Record<
    ConnectionInspectorSide,
    Map<string, Set<string>>
  > = {
    left: new Map(),
    right: new Map(),
  };

  for (const line of lines) {
    const oriented = orientEndpoints(
      line.near,
      line.far,
      line.inferredNear === true,
      line.inferredFar === true,
      legSides,
    );

    const leftKey = strandKey("left", oriented.left);
    const rightKey = strandKey("right", oriented.right);
    const connection: ConnectionInspectorConnection = {
      connectionId: line.connectionId,
      left: oriented.left,
      right: oriented.right,
      leftInferred: oriented.leftInferred,
      rightInferred: oriented.rightInferred,
      leftStrandKey: leftKey,
      rightStrandKey: rightKey,
      circuitName: line.circuitName,
      existing: line.existing,
      fullButt: line.fullButt,
    };

    connections.push(connection);
    connectionById.set(connection.connectionId, connection);

    const putStrand = (
      side: ConnectionInspectorSide,
      key: string,
      endpoint: FiberEndpoint,
      inferred: boolean,
      connectionId: string,
    ) => {
      if (!strandByKey.has(key)) {
        strandByKey.set(key, {
          key,
          side,
          cable: endpoint.cable,
          csvColumn: endpoint.csvColumn,
          tubeColor: endpoint.tubeColor,
          fiberNumber: endpoint.fiberNumber,
          fiberColor: endpoint.fiberColor,
          inferred,
          connectionIds: [],
        });
      }

      const strand = strandByKey.get(key)!;
      strand.inferred = strand.inferred || inferred;
      appendUnique(strand.connectionIds, connectionId);

      const connectionIds = connectionIdsByStrandKey.get(key) ?? [];
      appendUnique(connectionIds, connectionId);
      connectionIdsByStrandKey.set(key, connectionIds);

      const cableSetMap = strandKeysByCableSideSets[side];
      const cableSet = cableSetMap.get(endpoint.cable) ?? new Set<string>();
      cableSet.add(key);
      cableSetMap.set(endpoint.cable, cableSet);
    };

    putStrand(
      "left",
      leftKey,
      connection.left,
      connection.leftInferred,
      connection.connectionId,
    );
    putStrand(
      "right",
      rightKey,
      connection.right,
      connection.rightInferred,
      connection.connectionId,
    );
  }

  const strandKeysByCableSide: Record<
    ConnectionInspectorSide,
    Map<string, string[]>
  > = {
    left: new Map(),
    right: new Map(),
  };
  const cableNamesBySide: Record<ConnectionInspectorSide, string[]> = {
    left: [],
    right: [],
  };

  (["left", "right"] as const).forEach((side) => {
    const names = [...strandKeysByCableSideSets[side].keys()].sort((a, b) =>
      a.localeCompare(b),
    );
    cableNamesBySide[side] = names;

    names.forEach((cable) => {
      const keys = [...(strandKeysByCableSideSets[side].get(cable) ?? [])];
      keys.sort((a, b) =>
        strandSort(strandByKey.get(a)!, strandByKey.get(b)!),
      );
      strandKeysByCableSide[side].set(cable, keys);
    });
  });

  return {
    connections,
    connectionById,
    strandByKey,
    connectionIdsByStrandKey,
    cableNamesBySide,
    strandKeysByCableSide,
  };
}
