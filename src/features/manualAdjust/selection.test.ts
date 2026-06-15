import { describe, expect, it } from "vitest";

import {
  addConnectionsToSelection,
  emptySelection,
  setConnectionSelection,
  toggleConnectionSelection,
} from "./selection";

describe("addConnectionsToSelection", () => {
  it("unions new connections into the existing selection (Ctrl+double-click)", () => {
    const base = setConnectionSelection(["c1", "c2"]);
    const next = addConnectionsToSelection(base, ["c3", "c4"]);
    expect([...next.connectionIds].sort()).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("keeps already-selected connections (no duplicates)", () => {
    const base = setConnectionSelection(["c1", "c2"]);
    const next = addConnectionsToSelection(base, ["c2", "c3"]);
    expect([...next.connectionIds].sort()).toEqual(["c1", "c2", "c3"]);
  });

  it("does not mutate the input selection", () => {
    const base = setConnectionSelection(["c1"]);
    addConnectionsToSelection(base, ["c2"]);
    expect([...base.connectionIds]).toEqual(["c1"]);
  });
});

describe("toggleConnectionSelection (Ctrl+click additive)", () => {
  it("adds a connection to the existing selection when additive", () => {
    const base = setConnectionSelection(["c1"]);
    const next = toggleConnectionSelection(base, "c2", true);
    expect([...next.connectionIds].sort()).toEqual(["c1", "c2"]);
  });

  it("removes an already-selected connection when additive (toggle off)", () => {
    const base = setConnectionSelection(["c1", "c2"]);
    const next = toggleConnectionSelection(base, "c2", true);
    expect([...next.connectionIds]).toEqual(["c1"]);
  });

  it("replaces the selection when not additive", () => {
    const base = setConnectionSelection(["c1", "c2"]);
    const next = toggleConnectionSelection(base, "c3", false);
    expect([...next.connectionIds]).toEqual(["c3"]);
  });

  it("starts from empty cleanly", () => {
    const next = toggleConnectionSelection(emptySelection(), "c1", true);
    expect([...next.connectionIds]).toEqual(["c1"]);
  });
});
