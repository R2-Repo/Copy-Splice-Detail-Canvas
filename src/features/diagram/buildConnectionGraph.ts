import {
  cableNameKey,
  computeCableCanvasSides,
  csvColumnsForCable,
  diagramSideForCsvColumn,
} from "@/features/import/cableLegIdentity";
import type {
  CableAppearanceSummary,
  CableLeg,
  CableLegId,
  ConnectionGraph,
  CsvColumnRole,
  DiagramConnection,
  FiberConnection,
  FiberEndpoint,
  SplicePair,
  SpliceReport,
} from "@/types/splice";

export function cableLegId(
  cable: string,
  csvColumn: CsvColumnRole,
): CableLegId {
  return `${cableNameKey(cable)}::${csvColumn}`;
}

export function cableLegIdForEndpoint(ep: FiberEndpoint): CableLegId {
  return cableLegId(ep.cable, ep.csvColumn);
}

function buildLegsFromAppearances(
  appearances: CableAppearanceSummary[],
): CableLeg[] {
  const legs: CableLeg[] = [];

  for (const app of appearances) {
    const columns = csvColumnsForCable(app);
    for (const csvColumn of columns) {
      legs.push({
        id: cableLegId(app.cable, csvColumn),
        device: "",
        cable: app.cable,
        csvColumn,
        side: diagramSideForCsvColumn(csvColumn),
      });
    }
  }

  return legs.sort((a, b) => {
    if (a.side !== b.side) return a.side === "left" ? -1 : 1;
    return a.cable.localeCompare(b.cable);
  });
}

function ensurePairEndpointLegs(
  legs: CableLeg[],
  pairs: SplicePair[],
): CableLeg[] {
  const byId = new Map(legs.map((l) => [l.id, l]));

  for (const pair of pairs) {
    for (const ep of [pair.endpointA, pair.endpointB]) {
      const id = cableLegIdForEndpoint(ep);
      if (!byId.has(id)) {
        const leg: CableLeg = {
          id,
          device: ep.device,
          cable: ep.cable,
          csvColumn: ep.csvColumn,
          side: diagramSideForCsvColumn(ep.csvColumn),
        };
        byId.set(id, leg);
      }
    }
  }

  return [...byId.values()].sort((a, b) => {
    if (a.side !== b.side) return a.side === "left" ? -1 : 1;
    return a.cable.localeCompare(b.cable);
  });
}

export function buildConnectionGraph(report: SpliceReport): ConnectionGraph {
  const cableSides = computeCableCanvasSides(report.pairs);
  const legs = ensurePairEndpointLegs(
    buildLegsFromAppearances(report.cableAppearances),
    report.pairs,
  );

  const connections: DiagramConnection[] = report.pairs.map((pair) => ({
    kind: "fiber",
    id: pair.id,
    pair,
  }));

  return { report, legs, connections, cableSides };
}

export function orderedFiberConnections(
  graph: ConnectionGraph,
): FiberConnection[] {
  return graph.connections.filter(
    (c): c is FiberConnection => c.kind === "fiber",
  );
}

export function getEndpointSide(
  _graph: ConnectionGraph,
  ep: FiberEndpoint,
): "left" | "right" {
  return diagramSideForCsvColumn(ep.csvColumn);
}

export function pairEndpointsForSide(
  pair: SplicePair,
  graph: ConnectionGraph,
): { left: FiberEndpoint; right: FiberEndpoint } {
  const sideA = getEndpointSide(graph, pair.endpointA);
  if (sideA === "left") {
    return { left: pair.endpointA, right: pair.endpointB };
  }
  return { left: pair.endpointB, right: pair.endpointA };
}

/** Resolve appearance summary for one cable name (testing / debug). */
export function resolveLegColumnsForCable(
  app: CableAppearanceSummary,
): CsvColumnRole[] {
  return csvColumnsForCable(app);
}

export { cableNameKey };
