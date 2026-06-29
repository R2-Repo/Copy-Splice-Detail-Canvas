import {
  orderedFiberConnections,
  pairEndpointsForSide,
} from "@/features/diagram/buildConnectionGraph";
import { spliceTubeBundleKey } from "@/features/diagram/spliceCenterLanes";
import { isThroughCable } from "@/features/diagram/throughCable";
import {
  buildVisualCablesForLayout,
  findVisualCableForConnection,
  type VisualCable,
} from "@/features/diagram/visualCables";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import type { ConnectionGraph, FiberConnection } from "@/types/splice";

import { cableKeysFromGraph } from "../layoutSearch";
import type { CableAffinity, TopologyAnalysis } from "./topologyTypes";
import { deriveConstraints } from "./deriveConstraints";

function connectionCablePair(
  conn: FiberConnection,
  graph: ConnectionGraph,
): [string, string] | null {
  const { left, right } = pairEndpointsForSide(conn.pair, graph);
  const a = cableNameKey(left.cable);
  const b = cableNameKey(right.cable);
  if (a === b) return null;
  return a < b ? [a, b] : [b, a];
}

function buildAffinityMatrix(
  graph: ConnectionGraph,
): { affinities: CableAffinity[]; perCableTotal: Map<string, number> } {
  const pairCounts = new Map<string, number>();
  const perCableTotal = new Map<string, number>();
  const sameSideTally = new Map<string, { same: number; total: number }>();

  for (const conn of orderedFiberConnections(graph)) {
    const pair = connectionCablePair(conn, graph);
    if (!pair) continue;
    const [a, b] = pair;
    const key = `${a}\0${b}`;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    perCableTotal.set(a, (perCableTotal.get(a) ?? 0) + 1);
    perCableTotal.set(b, (perCableTotal.get(b) ?? 0) + 1);

    const { left, right } = pairEndpointsForSide(conn.pair, graph);
    const leftCable = cableNameKey(left.cable);
    const rightCable = cableNameKey(right.cable);
    const sameSide =
      graph.cableSides.get(leftCable) === graph.cableSides.get(rightCable);
    const tally = sameSideTally.get(key) ?? { same: 0, total: 0 };
    tally.total += 1;
    if (sameSide) tally.same += 1;
    sameSideTally.set(key, tally);
  }

  const affinities: CableAffinity[] = [];
  for (const [key, connectionCount] of pairCounts) {
    const [cableA, cableB] = key.split("\0") as [string, string];
    const totalA = perCableTotal.get(cableA) ?? 1;
    const totalB = perCableTotal.get(cableB) ?? 1;
    const tally = sameSideTally.get(key) ?? { same: 0, total: connectionCount };
    affinities.push({
      cableA,
      cableB,
      connectionCount,
      affinityA: connectionCount / totalA,
      affinityB: connectionCount / totalB,
      sameSideRate: tally.total > 0 ? tally.same / tally.total : 0,
    });
  }

  affinities.sort(
    (x, y) =>
      y.connectionCount - x.connectionCount ||
      x.cableA.localeCompare(y.cableA) ||
      x.cableB.localeCompare(y.cableB),
  );

  return { affinities, perCableTotal };
}

function throughConfidence(
  graph: ConnectionGraph,
  cableKeys: string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cable of cableKeys) {
    const legs = graph.legs.filter(
      (leg) => cableNameKey(leg.cable) === cable,
    );
    const through = isThroughCable(cable, graph);
    const hasFromTo =
      legs.some((l) => l.csvColumn === "from") &&
      legs.some((l) => l.csvColumn === "to");
    let confidence = through ? 0.85 : 0.35;
    if (hasFromTo) confidence -= 0.15;
    if (/\b(144|288)\b/.test(cable)) confidence += 0.1;
    out[cable] = Math.max(0, Math.min(1, confidence));
  }
  return out;
}

function hubRanking(
  perCableTotal: Map<string, number>,
  throughCableConfidence: Record<string, number>,
): { hubCables: string[]; satelliteCables: string[] } {
  const cableKeys = [...perCableTotal.keys()].sort((a, b) => a.localeCompare(b));
  const scored = cableKeys.map((cable) => ({
    cable,
    degree: perCableTotal.get(cable) ?? 0,
    through: throughCableConfidence[cable] ?? 0,
  }));

  scored.sort(
    (a, b) =>
      b.degree * (0.5 + b.through) - a.degree * (0.5 + a.through) ||
      a.cable.localeCompare(b.cable),
  );

  const hubCutoff = Math.max(2, Math.ceil(scored.length / 2));
  const hubCables = scored.slice(0, hubCutoff).map((e) => e.cable);
  const hubSet = new Set(hubCables);
  const satelliteCables = cableKeys.filter((c) => !hubSet.has(c));

  return { hubCables, satelliteCables };
}

function homogeneousTubeBundles(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  minSize: number,
): Array<{ tubeBundleKey: string; connectionIds: string[]; representativeId: string }> {
  const byBundle = new Map<string, string[]>();

  for (const conn of orderedFiberConnections(graph)) {
    const leftVc = findVisualCableForConnection(visualCables, conn.id, {
      canvasSide: "left",
    });
    const rightVc = findVisualCableForConnection(visualCables, conn.id, {
      canvasSide: "right",
    });
    if (!leftVc || !rightVc) continue;

    const { left } = pairEndpointsForSide(conn.pair, graph);
    const leftTube = left.tubeColor;
    const bundleKey = spliceTubeBundleKey(leftVc.id, leftTube, rightVc.id);
    const list = byBundle.get(bundleKey) ?? [];
    list.push(conn.id);
    byBundle.set(bundleKey, list);
  }

  const groups: Array<{
    tubeBundleKey: string;
    connectionIds: string[];
    representativeId: string;
  }> = [];

  for (const [tubeBundleKey, connectionIds] of byBundle) {
    if (connectionIds.length < minSize) continue;
    const destCables = new Set<string>();
    let homogeneous = true;
    for (const id of connectionIds) {
      const conn = graph.connections.find((c) => c.id === id);
      if (!conn || conn.kind !== "fiber") continue;
      const { right } = pairEndpointsForSide(conn.pair, graph);
      destCables.add(cableNameKey(right.cable));
      if (destCables.size > 1) {
        homogeneous = false;
        break;
      }
    }
    if (!homogeneous) continue;
    groups.push({
      tubeBundleKey,
      connectionIds,
      representativeId: connectionIds[0]!,
    });
  }

  groups.sort((a, b) => a.tubeBundleKey.localeCompare(b.tubeBundleKey));
  return groups;
}

/** One-pass graph stats after `buildConnectionGraph`. */
export function analyzeTopology(graph: ConnectionGraph): TopologyAnalysis {
  const cableKeys = cableKeysFromGraph(graph);
  const { visualCables } = buildVisualCablesForLayout(graph);
  const { affinities, perCableTotal } = buildAffinityMatrix(graph);
  const throughCableConfidence = throughConfidence(graph, cableKeys);
  const { hubCables, satelliteCables } = hubRanking(
    perCableTotal,
    throughCableConfidence,
  );
  const proxyBundleGroups = homogeneousTubeBundles(graph, visualCables, 4);

  const constraints = deriveConstraints({
    graph,
    cableKeys,
    affinities,
    visualCables,
    throughCableConfidence,
    hubCables,
    satelliteCables,
    proxyBundleGroups,
  });

  return {
    cableKeys,
    affinities,
    constraints,
    throughCableConfidence,
  };
}
