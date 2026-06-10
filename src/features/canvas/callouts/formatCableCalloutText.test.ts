import { describe, expect, it } from "vitest";

import {
  buildExistingConnectionIds,
  compressRanges,
  formatCableCalloutText,
  type CalloutFiberRef,
} from "./formatCableCalloutText";

const CABLE = "I-80 & 5600 S EB";

function fibers(nums: number[]): CalloutFiberRef[] {
  return nums.map((n) => ({
    connectionId: `conn-${n}`,
    fiberNumber: n,
  }));
}

describe("compressRanges", () => {
  it("compresses contiguous ranges", () => {
    expect(compressRanges([1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12])).toBe(
      "1-4, 6-12",
    );
  });

  it("compresses a single full span", () => {
    expect(compressRanges(Array.from({ length: 72 }, (_, i) => i + 1))).toBe(
      "1-72",
    );
  });

  it("compresses disjoint spans", () => {
    expect(
      compressRanges([1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 40, 41, 42, 43, 44, 45, 46, 47, 48]),
    ).toBe("1-4, 6-12, 40-48");
  });

  it("dedupes duplicate fiber numbers", () => {
    expect(compressRanges([1, 1, 2, 3])).toBe("1-3");
  });
});

describe("formatCableCalloutText", () => {
  it("formats full cable span", () => {
    expect(formatCableCalloutText(CABLE, fibers(Array.from({ length: 72 }, (_, i) => i + 1)), [])).toBe(
      `${CABLE}\nFibers 1-72`,
    );
  });

  it("formats partial spans with a gap", () => {
    const nums = [...Array.from({ length: 4 }, (_, i) => i + 1), ...Array.from({ length: 7 }, (_, i) => i + 6)];
    expect(formatCableCalloutText(CABLE, fibers(nums), [])).toBe(
      `${CABLE}\nFibers 1-4, 6-12`,
    );
  });

  it("formats multiple disjoint spans", () => {
    const nums = [
      ...Array.from({ length: 4 }, (_, i) => i + 1),
      ...Array.from({ length: 7 }, (_, i) => i + 6),
      ...Array.from({ length: 9 }, (_, i) => i + 40),
    ];
    expect(formatCableCalloutText(CABLE, fibers(nums), [])).toBe(
      `${CABLE}\nFibers 1-4, 6-12, 40-48`,
    );
  });

  it("uses Existing Protect in Place when all fibers are existing", () => {
    const refs = fibers([1, 2, 3, 4]);
    const edges = refs.map((ref) => ({
      id: `splice-${ref.connectionId}`,
      data: { existing: true },
    }));
    expect(formatCableCalloutText(CABLE, refs, edges)).toBe(
      `${CABLE}\nExisting Protect in Place`,
    );
  });

  it("excludes existing fibers from the active range", () => {
    const refs = fibers([1, 2, 3, 4, 5, 6]);
    const edges = [{ id: "splice-conn-5", data: { existing: true } }];
    expect(formatCableCalloutText(CABLE, refs, edges)).toBe(
      `${CABLE}\nFibers 1-4, 6`,
    );
  });

  it("treats butt edge existing as all pairIds existing", () => {
    const refs: CalloutFiberRef[] = [
      { connectionId: "a", fiberNumber: 1 },
      { connectionId: "b", fiberNumber: 2 },
    ];
    const edges = [
      {
        id: "butt-tube-1",
        data: { existing: true, pairIds: ["a", "b"] },
      },
    ];
    expect(formatCableCalloutText(CABLE, refs, edges)).toBe(
      `${CABLE}\nExisting Protect in Place`,
    );
  });
});

describe("buildExistingConnectionIds", () => {
  it("collects splice and butt pair ids", () => {
    const ids = buildExistingConnectionIds([
      { id: "splice-foo", data: { existing: true } },
      { id: "butt-bar", data: { existing: true, pairIds: ["p1", "p2"] } },
      { id: "splice-baz", data: { existing: false } },
    ]);
    expect(ids).toEqual(new Set(["foo", "p1", "p2"]));
  });
});
