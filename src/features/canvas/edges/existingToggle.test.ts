import type { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import {
  isConnectionExisting,
  legConnectionId,
  setConnectionsExisting,
} from "./existingToggle";

function leg(id: string, existing = false): Edge {
  return { id, source: "a", target: "b", type: "splice", data: { existing } };
}

describe("legConnectionId", () => {
  it("strips split-leg prefixes to the connection id", () => {
    expect(legConnectionId("splice-left-c1")).toBe("c1");
    expect(legConnectionId("splice-right-c1")).toBe("c1");
    expect(legConnectionId("splice-c1")).toBe("c1");
  });

  it("keeps butt edge ids as-is", () => {
    expect(legConnectionId("butt-tube7")).toBe("butt-tube7");
  });
});

describe("setConnectionsExisting", () => {
  it("flips both legs of a fiber connection together", () => {
    const edges = [leg("splice-left-c1"), leg("splice-right-c1"), leg("splice-left-c2")];
    const next = setConnectionsExisting(edges, ["c1"], true);
    expect((next[0]!.data as { existing: boolean }).existing).toBe(true);
    expect((next[1]!.data as { existing: boolean }).existing).toBe(true);
    expect((next[2]!.data as { existing: boolean }).existing).toBe(false);
  });

  it("flips the single butt edge", () => {
    const edges = [leg("butt-t1"), leg("splice-left-c2")];
    const next = setConnectionsExisting(edges, ["butt-t1"], true);
    expect((next[0]!.data as { existing: boolean }).existing).toBe(true);
    expect((next[1]!.data as { existing: boolean }).existing).toBe(false);
  });

  it("returns the same array reference when nothing changes", () => {
    const edges = [leg("splice-left-c1", true), leg("splice-right-c1", true)];
    expect(setConnectionsExisting(edges, ["c1"], true)).toBe(edges);
  });

  it("handles a whole bundle at once", () => {
    const edges = [
      leg("splice-left-c1"),
      leg("splice-right-c1"),
      leg("splice-left-c2"),
      leg("splice-right-c2"),
    ];
    const next = setConnectionsExisting(edges, ["c1", "c2"], true);
    expect(next.every((e) => (e.data as { existing: boolean }).existing)).toBe(true);
  });
});

describe("isConnectionExisting", () => {
  it("reads existing from either leg", () => {
    const edges = [leg("splice-left-c1", true), leg("splice-right-c1", true)];
    expect(isConnectionExisting(edges, "c1")).toBe(true);
    expect(isConnectionExisting(edges, "c2")).toBe(false);
  });
});
