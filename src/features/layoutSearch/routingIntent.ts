import { connectionRowIndexMap } from "@/features/diagram/connectionRowOrder";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import type { ConnectionGraph } from "@/types/splice";

import type { TopologyAnalysis } from "./topology/topologyTypes";
import type { LayoutSide } from "./layoutCandidate";

export type DominantPairIntent = {
  cableA: string;
  cableB: string;
  connectionCount: number;
};

export type RoutingIntent = {
  dominantPairs: DominantPairIntent[];
  satelliteToAnchor: Record<string, string>;
  medianRowByCablePair: Record<string, number>;
  sameSideRiskPairs: Array<{ cableA: string; cableB: string; rate: number }>;
  topBottomReliefCandidates: string[];
  bundleGroups: Array<{ tubeBundleKey: string; cables: string[] }>;
};

function pairKey(cableA: string, cableB: string): string {
  return cableA < cableB ? `${cableA}\0${cableB}` : `${cableB}\0${cableA}`;
}

/** Derive routing intent from topology analysis + graph row stats. */
export function deriveRoutingIntent(
  graph: ConnectionGraph,
  topology: TopologyAnalysis,
): RoutingIntent {
  const { visualCables, dominant } = buildVisualCablesForLayout(graph);
  const rowIndex = connectionRowIndexMap(graph, visualCables, dominant);

  const medianRowByCablePair: Record<string, number> = {};
  const pairRows = new Map<string, number[]>();

  for (const conn of graph.connections) {
    if (conn.kind !== "fiber") continue;
    const epA = cableNameKey(conn.pair.endpointA.cable);
    const epB = cableNameKey(conn.pair.endpointB.cable);
    if (epA === epB) continue;
    const key = pairKey(epA, epB);
    const rows = pairRows.get(key) ?? [];
    rows.push(rowIndex.get(conn.id) ?? 0);
    pairRows.set(key, rows);
  }

  for (const [key, rows] of pairRows) {
    rows.sort((a, b) => a - b);
    const mid = Math.floor(rows.length / 2);
    medianRowByCablePair[key] =
      rows.length % 2 === 0
        ? (rows[mid - 1]! + rows[mid]!) / 2
        : rows[mid]!;
  }

  const dominantPairs: DominantPairIntent[] = topology.affinities
    .slice(0, 8)
    .map((a) => ({
      cableA: a.cableA,
      cableB: a.cableB,
      connectionCount: a.connectionCount,
    }));

  const satelliteToAnchor: Record<string, string> = {};
  const { hubCables, satelliteCables } = topology.constraints;
  const hubSet = new Set(hubCables);
  for (const satellite of satelliteCables) {
    let bestHub = hubCables[0] ?? satellite;
    let bestCount = 0;
    for (const affinity of topology.affinities) {
      if (affinity.cableA !== satellite && affinity.cableB !== satellite) {
        continue;
      }
      const other =
        affinity.cableA === satellite ? affinity.cableB : affinity.cableA;
      if (!hubSet.has(other)) continue;
      if (affinity.connectionCount > bestCount) {
        bestCount = affinity.connectionCount;
        bestHub = other;
      }
    }
    satelliteToAnchor[satellite] = bestHub;
  }

  const sameSideRiskPairs = topology.affinities
    .filter((a) => a.sameSideRate < 0.15 && a.connectionCount >= 4)
    .map((a) => ({
      cableA: a.cableA,
      cableB: a.cableB,
      rate: a.sameSideRate,
    }));

  const loopbackLoad = new Map<string, number>();
  for (const affinity of topology.affinities) {
    if (affinity.sameSideRate >= 0.5) {
      loopbackLoad.set(
        affinity.cableA,
        (loopbackLoad.get(affinity.cableA) ?? 0) + affinity.connectionCount,
      );
      loopbackLoad.set(
        affinity.cableB,
        (loopbackLoad.get(affinity.cableB) ?? 0) + affinity.connectionCount,
      );
    }
  }

  let topBottomReliefCandidates = [...loopbackLoad.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([cable]) => cable)
    .slice(0, 6);

  if (topBottomReliefCandidates.length === 0) {
    const fromPairs = new Set<string>();
    for (const affinity of topology.affinities) {
      if (affinity.connectionCount >= 4) {
        fromPairs.add(affinity.cableA);
        fromPairs.add(affinity.cableB);
      }
    }
    topBottomReliefCandidates = [...fromPairs].sort((a, b) => a.localeCompare(b)).slice(0, 6);
  }

  const bundleGroups = topology.constraints.proxyBundleGroups.map((g) => {
    const cables = new Set<string>();
    for (const connId of g.connectionIds) {
      const conn = graph.connections.find((c) => c.id === connId);
      if (!conn || conn.kind !== "fiber") continue;
      cables.add(cableNameKey(conn.pair.endpointA.cable));
      cables.add(cableNameKey(conn.pair.endpointB.cable));
    }
    return {
      tubeBundleKey: g.tubeBundleKey,
      cables: [...cables].sort((a, b) => a.localeCompare(b)),
    };
  });

  return {
    dominantPairs,
    satelliteToAnchor,
    medianRowByCablePair,
    sameSideRiskPairs,
    topBottomReliefCandidates,
    bundleGroups,
  };
}

export function preferredOppositeSides(
  intent: RoutingIntent,
  lock?: {
    cableA: string;
    cableB: string;
    sideA: LayoutSide;
    sideB: LayoutSide;
  },
): { sideA: LayoutSide; sideB: LayoutSide } {
  if (lock) {
    return { sideA: lock.sideA, sideB: lock.sideB };
  }
  if (intent.dominantPairs[0]) {
    return { sideA: "left", sideB: "right" };
  }
  return { sideA: "left", sideB: "right" };
}
