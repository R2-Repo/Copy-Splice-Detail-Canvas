import { deriveFibersPerTube } from "@/features/diagram/fibersPerTube";
import { isThroughCableName } from "@/features/diagram/throughCable";
import {
  cableNameKey,
  computeCableCanvasSides,
  csvColumnsForCable,
  diagramSideForCsvColumn,
} from "@/features/import/cableLegIdentity";
import { logicalEndpointKey } from "@/features/import/parseBentleyCsv";
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

function fiberCountForLeg(legId: CableLegId, pairs: SplicePair[]): number {
  const fibers = new Set<string>();
  for (const pair of pairs) {
    for (const ep of [pair.endpointA, pair.endpointB]) {
      if (cableLegIdForEndpoint(ep) === legId) {
        fibers.add(logicalEndpointKey(ep));
      }
    }
  }
  return fibers.size;
}

function deriveLegRole(
  cable: string,
  fiberCount: number,
  maxFiberCount: number,
): CableLeg["role"] {
  if (fiberCount >= maxFiberCount && fiberCount > 6) return "through";
  if (maxFiberCount > 6 && fiberCount <= 6) return "drop";
  return isThroughCableName(cable) ? "through" : "drop";
}

function endpointsForLeg(
  legId: CableLegId,
  pairs: SplicePair[],
): FiberEndpoint[] {
  const out: FiberEndpoint[] = [];
  for (const pair of pairs) {
    for (const ep of [pair.endpointA, pair.endpointB]) {
      if (cableLegIdForEndpoint(ep) === legId) out.push(ep);
    }
  }
  return out;
}

function enrichLegs(
  legs: Omit<CableLeg, "fibersPerTube" | "role">[],
  pairs: SplicePair[],
): CableLeg[] {
  const fiberCounts = legs.map((leg) => ({
    leg,
    count: fiberCountForLeg(leg.id, pairs),
  }));
  const maxFiberCount = Math.max(0, ...fiberCounts.map((e) => e.count));

  return fiberCounts
    .map(({ leg, count }) => ({
      ...leg,
      fibersPerTube: deriveFibersPerTube(
        endpointsForLeg(leg.id, pairs),
        leg.cable,
      ),
      role: deriveLegRole(leg.cable, count, maxFiberCount),
    }))
    .sort((a, b) => {
      if (a.side !== b.side) return a.side === "left" ? -1 : 1;
      return a.cable.localeCompare(b.cable);
    });
}

function buildLegsFromAppearances(
  appearances: CableAppearanceSummary[],
  pairs: SplicePair[],
): CableLeg[] {
  const legs: Omit<CableLeg, "fibersPerTube" | "role">[] = [];

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

  return enrichLegs(legs, pairs);
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
        byId.set(id, {
          id,
          device: ep.device,
          cable: ep.cable,
          csvColumn: ep.csvColumn,
          side: diagramSideForCsvColumn(ep.csvColumn),
          fibersPerTube: 12,
          role: "drop",
        });
      }
    }
  }

  const base = [...byId.values()].map(
    ({ fibersPerTube: _f, role: _r, ...leg }) => leg,
  );
  return enrichLegs(base, pairs);
}

export function buildConnectionGraph(report: SpliceReport): ConnectionGraph {
  const cableSides = computeCableCanvasSides(report.pairs);
  const legs = ensurePairEndpointLegs(
    buildLegsFromAppearances(report.cableAppearances, report.pairs),
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
