import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildCircuitIndex,
  connectionMatchesHighlight,
  normalizeCircuitName,
  pairCountForCircuit,
} from "@/features/canvas/circuitIndex";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { resolveReferenceCsvPath } from "@/testHelpers/layoutContractCsvPaths";

describe("normalizeCircuitName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeCircuitName("  CH  2090  ")).toBe("CH 2090");
  });

  it("returns undefined for blank", () => {
    expect(normalizeCircuitName("   ")).toBeUndefined();
    expect(normalizeCircuitName(undefined)).toBeUndefined();
  });
});

describe("buildCircuitIndex", () => {
  it("layout contract CSV: single circuit CH 2090 across all pairs", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(
        readFileSync(
          resolveReferenceCsvPath("CSV Splice Detail Example #2.csv"),
          "utf8",
        ),
      ),
    );
    const index = buildCircuitIndex(graph);
    expect(index.names).toEqual(["CH 2090"]);
    expect(pairCountForCircuit(index, "CH 2090")).toBe(6);
  });

  it("3161.4 CSV: multiple distinct circuits", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(
        readFileSync(resolveReferenceCsvPath("3161.4.csv"), "utf8"),
      ),
    );
    const index = buildCircuitIndex(graph);
    expect(index.names.length).toBeGreaterThan(5);
    expect(index.names).toContain("CH 3158");
    expect(pairCountForCircuit(index, "CH 3158")).toBe(2);
  });
});

describe("connectionMatchesHighlight", () => {
  it("matches primary and shared-handle splice ids", () => {
    const highlighted = new Set(["conn-a"]);
    expect(connectionMatchesHighlight("conn-a", undefined, highlighted)).toBe(
      true,
    );
    expect(connectionMatchesHighlight("conn-b", ["conn-a"], highlighted)).toBe(
      true,
    );
    expect(connectionMatchesHighlight("conn-c", ["conn-x"], highlighted)).toBe(
      false,
    );
  });
});
