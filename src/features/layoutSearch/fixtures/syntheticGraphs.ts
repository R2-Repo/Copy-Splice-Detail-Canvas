import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import type {
  CableAppearanceSummary,
  ConnectionGraph,
  SplicePair,
} from "@/types/splice";

function pair(
  id: string,
  leftCable: string,
  leftFiber: number,
  rightCable: string,
  rightFiber: number,
): SplicePair {
  return {
    id,
    endpointA: {
      device: "DEV-L",
      cable: leftCable,
      fiberNumber: leftFiber,
      tubeColor: "BL",
      fiberColor: "BL",
      csvColumn: "from",
    },
    endpointB: {
      device: "DEV-R",
      cable: rightCable,
      fiberNumber: rightFiber,
      tubeColor: "BL",
      fiberColor: "BL",
      csvColumn: "to",
    },
  };
}

function appearances(
  entries: Array<{ cable: string; leftFrom: number; rightTo: number }>,
): CableAppearanceSummary[] {
  return entries.map((e) => ({
    device: "DEV",
    cable: e.cable,
    left: { from: e.leftFrom, to: 0 },
    right: { from: 0, to: e.rightTo },
  }));
}

/** Hub splice: two locked through 144s + two searchable drop cables. */
export function syntheticHubSpliceGraph(strandsPerHubPair = 48): ConnectionGraph {
  const pairs: SplicePair[] = [];
  let id = 0;

  for (let i = 1; i <= strandsPerHubPair; i++) {
    pairs.push(
      pair(`hub-${id++}`, "CABLE-A-144", i, "CABLE-B-144", i),
    );
  }
  for (let i = 1; i <= 8; i++) {
    pairs.push(pair(`sat-a-${id++}`, "CABLE-A-144", 100 + i, "DROP-A", i));
    pairs.push(pair(`sat-b-${id++}`, "CABLE-B-144", 100 + i, "DROP-B", i));
  }

  return buildConnectionGraph({
    header: { spliceNumber: "SYN-HUB" },
    pairs,
    cableAppearances: appearances([
      { cable: "CABLE-A-144", leftFrom: strandsPerHubPair + 8, rightTo: 0 },
      { cable: "CABLE-B-144", leftFrom: 0, rightTo: strandsPerHubPair + 8 },
      { cable: "DROP-A", leftFrom: 0, rightTo: 8 },
      { cable: "DROP-B", leftFrom: 8, rightTo: 0 },
    ]),
  });
}

/** Symmetric two-144 splice for tiered-eval perf (homogeneous tube bundles). */
export function syntheticTwo144Graph(fibersPerTube = 6): ConnectionGraph {
  const pairs: SplicePair[] = [];
  let id = 0;
  const tubes = 12;

  for (let tube = 1; tube <= tubes; tube++) {
    for (let fiber = 1; fiber <= fibersPerTube; fiber++) {
      const fiberNum = (tube - 1) * fibersPerTube + fiber;
      pairs.push(
        pair(
          `ab-${id++}`,
          "DIST-144-A",
          fiberNum,
          "DIST-144-B",
          fiberNum,
        ),
      );
    }
  }

  const total = tubes * fibersPerTube;
  return buildConnectionGraph({
    header: { spliceNumber: "SYN-2x144" },
    pairs,
    cableAppearances: appearances([
      { cable: "DIST-144-A", leftFrom: total, rightTo: 0 },
      { cable: "DIST-144-B", leftFrom: 0, rightTo: total },
    ]),
  });
}
