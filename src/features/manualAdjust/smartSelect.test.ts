import type { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { bundleConnectionIds } from "./smartSelect";

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

  it("always includes the grabbed connection", () => {
    const edges = legEdges("c9", "CAB-A|BL|CAB-B");
    expect(bundleConnectionIds(edges, "c9")).toContain("c9");
  });

  it("does not group across different destination cables", () => {
    const edges = [
      ...legEdges("c1", "CAB-A|BL|CAB-B"),
      ...legEdges("c2", "CAB-A|BL|CAB-C"),
    ];
    expect(bundleConnectionIds(edges, "c1")).toEqual(["c1"]);
  });
});
