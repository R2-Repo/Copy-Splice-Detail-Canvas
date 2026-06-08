import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  mirrorSideAssignment,
  pickBestSideAssignment,
  scoreCableSideAssignment,
} from "./layoutScoring";
import { computeCableCanvasSides } from "@/features/import/cableLegIdentity";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import type { SplicePair } from "@/types/splice";

const examples = join(process.cwd(), "docs/reference/examples");

function pair(
  aCable: string,
  aNum: number,
  bCable: string,
  bNum: number,
): SplicePair {
  return {
    id: `${aCable}-${aNum}::${bCable}-${bNum}`,
    endpointA: {
      device: "HUB",
      cable: aCable,
      fiberNumber: aNum,
      tubeColor: "BL",
      fiberColor: "BL",
      csvColumn: "from",
    },
    endpointB: {
      device: "HUB",
      cable: bCable,
      fiberNumber: bNum,
      tubeColor: "BL",
      fiberColor: "BL",
      csvColumn: "to",
    },
  };
}

describe("layoutScoring", () => {
  it("prefers opposite-side assignment over same-side", () => {
    const pairs = [pair("A", 1, "B", 1), pair("A", 2, "B", 2)];
    const opposite = new Map([
      ["A", "left" as const],
      ["B", "right" as const],
    ]);
    const same = new Map([
      ["A", "left" as const],
      ["B", "left" as const],
    ]);
    expect(scoreCableSideAssignment(pairs, opposite).score).toBeLessThan(
      scoreCableSideAssignment(pairs, same).score,
    );
  });

  it("pickBestSideAssignment chooses lowest score", () => {
    const pairs = [pair("A", 1, "B", 1)];
    const left = new Map([["A", "left" as const], ["B", "right" as const]]);
    const mirrored = mirrorSideAssignment(left);
    const best = pickBestSideAssignment([left, mirrored], pairs);
    expect(best.get("A")).toBeDefined();
  });

  it("pickBestSideAssignment minimizes bends before crossings", () => {
    const pairs = [
      pair("A", 1, "B", 1),
      pair("A", 2, "B", 2),
      pair("C", 1, "D", 1),
    ];
    const lowBends = new Map([
      ["A", "left" as const],
      ["B", "right" as const],
      ["C", "left" as const],
      ["D", "right" as const],
    ]);
    const highBends = new Map([
      ["A", "left" as const],
      ["B", "left" as const],
      ["C", "left" as const],
      ["D", "right" as const],
    ]);
    expect(
      scoreCableSideAssignment(pairs, lowBends).bends,
    ).toBeLessThan(scoreCableSideAssignment(pairs, highBends).bends);
    const best = pickBestSideAssignment([highBends, lowBends], pairs);
    expect(scoreCableSideAssignment(pairs, best).bends).toBe(0);
  });

  for (const file of ["300N_MAIN.csv", "SP-I-15_11400S.csv", "SPI-215_I-80.csv"] as const) {
    it(`${file} side assignment beats global mirror on crossings`, () => {
      const report = parseBentleyCsv(
        readFileSync(join(examples, file), "utf8"),
      );
      const sides = computeCableCanvasSides(report.pairs);
      const mirrored = mirrorSideAssignment(sides);
      expect(
        scoreCableSideAssignment(report.pairs, sides).crossings,
      ).toBeLessThanOrEqual(
        scoreCableSideAssignment(report.pairs, mirrored).crossings,
      );
    });
  }
});
