import type { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv, LAYOUT_CONTRACT_CSVS } from "@/testHelpers/layoutContractCsvPaths";

import { clampStemReachX } from "./constraints";
import {
  bundleConnectionIds,
  dragConnectionIdsForFiberAnchor,
  sameSourceTubeConnectionIds,
  tubeKeyForFiberAnchor,
} from "./smartSelect";
import { emptySelection } from "./selection";

function legEdges(
  connectionId: string,
  tubeBundleKey?: string,
): Edge[] {
  const data = tubeBundleKey ? { tubeBundleKey } : {};
  return [
    { id: `splice-left-${connectionId}`, source: "a", target: "b", data },
    { id: `splice-right-${connectionId}`, source: "b", target: "c", data },
  ];
}

describe("bundleConnectionIds", () => {
  it("groups every connection sharing the same tubeBundleKey", () => {
    const edges = [
      ...legEdges("c1", "CAB-A|BL|CAB-B"),
      ...legEdges("c2", "CAB-A|BL|CAB-B"),
      ...legEdges("c3", "CAB-A|OR|CAB-B"),
    ];
    const ids = bundleConnectionIds(edges, "c1").sort();
    expect(ids).toEqual(["c1", "c2"]);
  });

  it("returns only the grabbed connection when it has no bundle key", () => {
    const edges = [...legEdges("c1"), ...legEdges("c2", "CAB-A|BL|CAB-B")];
    expect(bundleConnectionIds(edges, "c1")).toEqual(["c1"]);
  });
});

describe("clampStemReachX", () => {
  it("clamps to ±72px by default", () => {
    expect(clampStemReachX(100)).toBe(72);
    expect(clampStemReachX(-100)).toBe(-72);
  });
});

describe("sameSourceTubeConnectionIds", () => {
  it("returns all fibers in a tube on one cable", () => {
    const csv = readReferenceCsv(LAYOUT_CONTRACT_CSVS.dominantPair);
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { nodes } = buildReactFlowGraph(graph);
    const anchor = nodes.find((n) => n.type === "fiberAnchor");
    expect(anchor).toBeDefined();
    if (!anchor) return;
    const data = anchor.data as {
      connectionId: string;
      visualCableId: string;
    };
    const ids = sameSourceTubeConnectionIds(
      graph,
      data.connectionId,
      data.visualCableId,
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain(data.connectionId);
  });
});

describe("tubeKeyForFiberAnchor", () => {
  it("resolves tube key for a fiber anchor", () => {
    const csv = readReferenceCsv(LAYOUT_CONTRACT_CSVS.dominantPair);
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { nodes } = buildReactFlowGraph(graph);
    const anchor = nodes.find((n) => n.type === "fiberAnchor");
    expect(anchor).toBeDefined();
    if (!anchor) return;
    const data = anchor.data as {
      connectionId: string;
      visualCableId: string;
    };
    const key = tubeKeyForFiberAnchor(
      graph,
      data.connectionId,
      data.visualCableId,
    );
    expect(key?.startsWith(`${data.visualCableId}|`)).toBe(true);
  });
});

describe("dragConnectionIdsForFiberAnchor", () => {
  it("defaults to same source tube group", () => {
    const csv = readReferenceCsv(LAYOUT_CONTRACT_CSVS.dominantPair);
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { edges, nodes } = buildReactFlowGraph(graph);
    const anchor = nodes.find((n) => n.type === "fiberAnchor");
    expect(anchor).toBeDefined();
    if (!anchor) return;
    const data = anchor.data as {
      connectionId: string;
      visualCableId: string;
    };
    const ids = dragConnectionIdsForFiberAnchor(
      edges,
      graph,
      data.connectionId,
      data.visualCableId,
      emptySelection(),
    );
    expect(ids).toContain(data.connectionId);
  });
});
