import { cableLegIdForEndpoint, pairEndpointsForSide } from "@/features/diagram/buildConnectionGraph";
import { FIBERS_PER_BUFFER_TUBE } from "@/features/diagram/cableLayoutMetrics";
import { diagramSideForCsvColumn } from "@/features/import/cableLegIdentity";
import { tubeEndpointKey } from "@/features/diagram/tubeId";
import type { VisualCable, VisualTube } from "@/features/diagram/visualCables";
import { findVisualCableForConnection } from "@/features/diagram/visualCables";
import type {
  ConnectionGraph,
  CsvColumnRole,
  FiberEndpoint,
  SplicePair,
  TubeColorCode,
  TubeEndpoint,
} from "@/types/splice";

export type FullButtSpliceTubePair = {
  id: string;
  endpointA: TubeEndpoint;
  endpointB: TubeEndpoint;
  pairIds: string[];
};

export type ResolvedFullButtSplice = {
  tube: FullButtSpliceTubePair;
  leftVc: VisualCable;
  rightVc: VisualCable;
  leftEndpoint: TubeEndpoint;
  rightEndpoint: TubeEndpoint;
};

type TubePairGroup = {
  leftLegId: string;
  rightLegId: string;
  leftTube: TubeColorCode;
  rightTube: TubeColorCode;
  pairs: SplicePair[];
};

function tubePairGroupKey(
  leftLegId: string,
  leftTube: TubeColorCode,
  rightLegId: string,
  rightTube: TubeColorCode,
): string {
  return `${leftLegId}|${leftTube}::${rightLegId}|${rightTube}`;
}

function groupPairsByTubePair(graph: ConnectionGraph): TubePairGroup[] {
  const groups = new Map<string, TubePairGroup>();

  for (const pair of graph.report.pairs) {
    const { left, right } = pairEndpointsForSide(pair, graph);
    const leftLegId = cableLegIdForEndpoint(left);
    const rightLegId = cableLegIdForEndpoint(right);
    const key = tubePairGroupKey(
      leftLegId,
      left.tubeColor,
      rightLegId,
      right.tubeColor,
    );
    const existing = groups.get(key);
    if (existing) {
      existing.pairs.push(pair);
    } else {
      groups.set(key, {
        leftLegId,
        rightLegId,
        leftTube: left.tubeColor,
        rightTube: right.tubeColor,
        pairs: [pair],
      });
    }
  }

  return [...groups.values()];
}

function fibersInTubeOnLeg(
  graph: ConnectionGraph,
  legId: string,
  tubeColor: TubeColorCode,
): FiberEndpoint[] {
  const fibers: FiberEndpoint[] = [];
  const seen = new Set<string>();

  for (const pair of graph.report.pairs) {
    for (const ep of [pair.endpointA, pair.endpointB]) {
      if (cableLegIdForEndpoint(ep) !== legId) continue;
      if (ep.tubeColor !== tubeColor) continue;
      const key = `${ep.fiberNumber}:${ep.fiberColor}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fibers.push(ep);
    }
  }

  return fibers;
}

function pairTouchesTube(
  pair: SplicePair,
  legId: string,
  tubeColor: TubeColorCode,
): boolean {
  for (const ep of [pair.endpointA, pair.endpointB]) {
    if (
      cableLegIdForEndpoint(ep) === legId &&
      ep.tubeColor === tubeColor
    ) {
      return true;
    }
  }
  return false;
}

function isExclusiveTubePair(
  graph: ConnectionGraph,
  group: TubePairGroup,
): boolean {
  const pairIds = new Set(group.pairs.map((p) => p.id));

  for (const pair of graph.report.pairs) {
    const touchesLeft = pairTouchesTube(
      pair,
      group.leftLegId,
      group.leftTube,
    );
    const touchesRight = pairTouchesTube(
      pair,
      group.rightLegId,
      group.rightTube,
    );
    if (!touchesLeft && !touchesRight) continue;
    if (!pairIds.has(pair.id)) return false;
  }

  return true;
}

function coversAllFibersInBothTubes(
  graph: ConnectionGraph,
  group: TubePairGroup,
): boolean {
  const leftFibers = fibersInTubeOnLeg(
    graph,
    group.leftLegId,
    group.leftTube,
  );
  const rightFibers = fibersInTubeOnLeg(
    graph,
    group.rightLegId,
    group.rightTube,
  );

  if (leftFibers.length !== FIBERS_PER_BUFFER_TUBE) return false;
  if (rightFibers.length !== FIBERS_PER_BUFFER_TUBE) return false;
  if (group.pairs.length !== FIBERS_PER_BUFFER_TUBE) return false;

  const leftCovered = new Set(
    group.pairs.map((p) => {
      const { left } = pairEndpointsForSide(p, graph);
      return `${left.fiberNumber}:${left.fiberColor}`;
    }),
  );
  const rightCovered = new Set(
    group.pairs.map((p) => {
      const { right } = pairEndpointsForSide(p, graph);
      return `${right.fiberNumber}:${right.fiberColor}`;
    }),
  );

  for (const f of leftFibers) {
    if (!leftCovered.has(`${f.fiberNumber}:${f.fiberColor}`)) return false;
  }
  for (const f of rightFibers) {
    if (!rightCovered.has(`${f.fiberNumber}:${f.fiberColor}`)) return false;
  }

  return true;
}

function isFullButtSpliceTubeGroup(
  graph: ConnectionGraph,
  group: TubePairGroup,
): boolean {
  if (group.pairs.length !== FIBERS_PER_BUFFER_TUBE) return false;
  if (!isExclusiveTubePair(graph, group)) return false;
  if (!coversAllFibersInBothTubes(graph, group)) return false;

  for (const pair of group.pairs) {
    const { left, right } = pairEndpointsForSide(pair, graph);
    if (left.fiberColor !== right.fiberColor) return false;
    if (diagramSideForCsvColumn(left.csvColumn) !== "left") return false;
    if (diagramSideForCsvColumn(right.csvColumn) !== "right") return false;
  }

  const leftColors = new Set<string>();
  const rightColors = new Set<string>();
  for (const pair of group.pairs) {
    const { left, right } = pairEndpointsForSide(pair, graph);
    if (leftColors.has(left.fiberColor)) return false;
    if (rightColors.has(right.fiberColor)) return false;
    leftColors.add(left.fiberColor);
    rightColors.add(right.fiberColor);
  }

  return (
    leftColors.size === FIBERS_PER_BUFFER_TUBE &&
    rightColors.size === FIBERS_PER_BUFFER_TUBE
  );
}

export function detectFullButtSpliceTubesFromLegs(
  graph: ConnectionGraph,
): FullButtSpliceTubePair[] {
  const results: FullButtSpliceTubePair[] = [];

  for (const group of groupPairsByTubePair(graph)) {
    if (!isFullButtSpliceTubeGroup(graph, group)) continue;

    const endpointA: TubeEndpoint = {
      key: tubeEndpointKey(group.leftLegId, group.leftTube),
      legId: group.leftLegId,
      tubeColor: group.leftTube,
    };
    const endpointB: TubeEndpoint = {
      key: tubeEndpointKey(group.rightLegId, group.rightTube),
      legId: group.rightLegId,
      tubeColor: group.rightTube,
    };

    results.push({
      id: `tube-${endpointA.key}::${endpointB.key}`,
      endpointA,
      endpointB,
      pairIds: group.pairs.map((p) => p.id),
    });
  }

  return results.sort((a, b) => a.id.localeCompare(b.id));
}

function csvRoleForTubeFiber(
  graph: ConnectionGraph,
  vc: VisualCable,
  tube: VisualTube,
  connectionId: string,
): CsvColumnRole | null {
  const pair = graph.report.pairs.find((p) => p.id === connectionId);
  if (!pair) return null;
  for (const ep of [pair.endpointA, pair.endpointB]) {
    if (ep.cable !== vc.cable) continue;
    if (ep.tubeColor !== tube.tubeColor) continue;
    return ep.csvColumn;
  }
  return null;
}

function tubeUniformCsvRole(
  graph: ConnectionGraph,
  vc: VisualCable,
  tube: VisualTube,
): CsvColumnRole | null {
  let role: CsvColumnRole | null = null;
  for (const fiber of tube.fibers) {
    const next = csvRoleForTubeFiber(graph, vc, tube, fiber.connectionId);
    if (!next) return null;
    if (!role) role = next;
    else if (role !== next) return null;
  }
  return role;
}

function isVisualTubeExclusive(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  vc: VisualCable,
  tube: VisualTube,
  pairIds: Set<string>,
): boolean {
  for (const pair of graph.report.pairs) {
    for (const ep of [pair.endpointA, pair.endpointB]) {
      if (ep.cable !== vc.cable) continue;
      if (ep.tubeColor !== tube.tubeColor) continue;
      const found = findVisualCableForConnection(visualCables, pair.id, {
        cable: ep.cable,
      });
      if (found?.id !== vc.id) continue;
      if (!pairIds.has(pair.id)) return false;
    }
  }
  return true;
}

function tubePairColorsMatch(
  graph: ConnectionGraph,
  pairIds: string[],
): boolean {
  for (const id of pairIds) {
    const pair = graph.report.pairs.find((p) => p.id === id);
    if (!pair) return false;
    const { left, right } = pairEndpointsForSide(pair, graph);
    if (left.fiberColor !== right.fiberColor) return false;
  }
  return true;
}

/** Match full butt splices on rendered visual tubes (handles merged cable legs). */
export function detectFullButtSpliceTubesFromVisuals(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
): FullButtSpliceTubePair[] {
  const results: FullButtSpliceTubePair[] = [];
  const used = new Set<string>();

  const fromTubes: { vc: VisualCable; tube: VisualTube }[] = [];
  const toTubes: { vc: VisualCable; tube: VisualTube }[] = [];

  for (const vc of visualCables) {
    for (const tube of vc.tubes) {
      if (tube.fibers.length !== FIBERS_PER_BUFFER_TUBE) continue;
      const role = tubeUniformCsvRole(graph, vc, tube);
      if (role === "from") fromTubes.push({ vc, tube });
      else if (role === "to") toTubes.push({ vc, tube });
    }
  }

  for (const { vc: fromVc, tube: fromTube } of fromTubes) {
    const pairIds = fromTube.fibers.map((f) => f.connectionId);
    const pairIdSet = new Set(pairIds);
    if (!tubePairColorsMatch(graph, pairIds)) continue;
    if (
      !isVisualTubeExclusive(
        graph,
        visualCables,
        fromVc,
        fromTube,
        pairIdSet,
      )
    ) {
      continue;
    }

    for (const { vc: toVc, tube: toTube } of toTubes) {
      const rightIdSet = new Set(toTube.fibers.map((f) => f.connectionId));
      if (rightIdSet.size !== pairIdSet.size) continue;
      if (!pairIds.every((id) => rightIdSet.has(id))) continue;
      if (
        !isVisualTubeExclusive(
          graph,
          visualCables,
          toVc,
          toTube,
          pairIdSet,
        )
      ) {
        continue;
      }

      const signature = [...pairIds].sort().join("|");
      if (used.has(signature)) continue;
      used.add(signature);

      const endpointA: TubeEndpoint = {
        key: tubeEndpointKey(fromVc.legId, fromTube.tubeColor),
        legId: fromVc.legId,
        tubeColor: fromTube.tubeColor,
      };
      const endpointB: TubeEndpoint = {
        key: tubeEndpointKey(toVc.legId, toTube.tubeColor),
        legId: toVc.legId,
        tubeColor: toTube.tubeColor,
      };

      results.push({
        id: `tube-${endpointA.key}::${endpointB.key}`,
        endpointA,
        endpointB,
        pairIds,
      });
    }
  }

  return results.sort((a, b) => a.id.localeCompare(b.id));
}

export function detectFullButtSpliceTubes(
  graph: ConnectionGraph,
  visualCables?: VisualCable[],
): FullButtSpliceTubePair[] {
  if (visualCables) {
    return detectFullButtSpliceTubesFromVisuals(graph, visualCables);
  }
  return detectFullButtSpliceTubesFromLegs(graph);
}

export function collapsedPairIdsFromButtSplices(
  pairs: FullButtSpliceTubePair[],
): Set<string> {
  return new Set(pairs.flatMap((p) => p.pairIds));
}

export function visualTubeFullyInButtSplice(
  tube: VisualTube,
  buttSplice: FullButtSpliceTubePair,
): boolean {
  if (tube.fibers.length !== FIBERS_PER_BUFFER_TUBE) return false;
  const pairIds = new Set(buttSplice.pairIds);
  return tube.fibers.every((f) => pairIds.has(f.connectionId));
}

function findVisualCableForButtSpliceEndpoint(
  visualCables: VisualCable[],
  buttSplice: FullButtSpliceTubePair,
  endpoint: TubeEndpoint,
): { vc: VisualCable; tube: VisualTube } | undefined {
  for (const vc of visualCables) {
    if (vc.legId !== endpoint.legId) continue;
    for (const tube of vc.tubes) {
      if (tube.tubeColor !== endpoint.tubeColor) continue;
      if (visualTubeFullyInButtSplice(tube, buttSplice)) {
        return { vc, tube };
      }
    }
  }
  return undefined;
}

export function resolveFullButtSpliceVisuals(
  visualCables: VisualCable[],
  buttSplices: FullButtSpliceTubePair[],
): ResolvedFullButtSplice[] {
  const resolved: ResolvedFullButtSplice[] = [];

  for (const tube of buttSplices) {
    const left = findVisualCableForButtSpliceEndpoint(
      visualCables,
      tube,
      tube.endpointA,
    );
    const right = findVisualCableForButtSpliceEndpoint(
      visualCables,
      tube,
      tube.endpointB,
    );
    if (!left || !right) continue;

    const leftEndpoint: TubeEndpoint = {
      key: tubeEndpointKey(left.vc.legId, left.tube.tubeColor),
      legId: left.vc.legId,
      tubeColor: left.tube.tubeColor,
    };
    const rightEndpoint: TubeEndpoint = {
      key: tubeEndpointKey(right.vc.legId, right.tube.tubeColor),
      legId: right.vc.legId,
      tubeColor: right.tube.tubeColor,
    };

    resolved.push({
      tube,
      leftVc: left.vc,
      rightVc: right.vc,
      leftEndpoint,
      rightEndpoint,
    });
  }

  return resolved;
}

export function collapsedTubeColorsForVisualCable(
  visualCable: VisualCable,
  resolved: ResolvedFullButtSplice[],
): TubeColorCode[] {
  const colors = new Set<TubeColorCode>();

  for (const entry of resolved) {
    if (entry.leftVc.id !== visualCable.id && entry.rightVc.id !== visualCable.id) {
      continue;
    }
    for (const tube of visualCable.tubes) {
      if (visualTubeFullyInButtSplice(tube, entry.tube)) {
        colors.add(tube.tubeColor);
      }
    }
  }

  return [...colors];
}
