import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  characterizeReferenceCsv,
  type RoutingCharacterization,
} from "./routingCharacterization";

import nodesGoldens from "./__goldens__/routingCharacterization.json";
import gridGoldens from "./__goldens__/routingCharacterization.grid.json";

const examplesDir = join(process.cwd(), "docs/reference/examples");

describe("routing characterization goldens (B0)", () => {
  for (const [file, expected] of Object.entries(nodesGoldens) as [
    string,
    RoutingCharacterization,
  ][]) {
    it(`${file} matches nodes-engine routing golden`, () => {
      const actual = characterizeReferenceCsv(examplesDir, file, "nodes");
      expect(actual.leftRows).toBe(expected.leftRows);
      expect(actual.pairs).toBe(expected.pairs);
      expect(actual.parseGap).toBe(expected.parseGap);
      expect(actual.uniqueCables).toBe(expected.uniqueCables);
      expect(actual.legCount).toBe(expected.legCount);
      expect(actual.legs).toEqual(expected.legs);
      expect(actual.dominant).toEqual(expected.dominant);
      expect(actual.routing).toEqual(expected.routing);
    });
  }
});

describe("routing characterization goldens (grid default)", () => {
  for (const [file, expected] of Object.entries(gridGoldens) as [
    string,
    RoutingCharacterization,
  ][]) {
    it(`${file} matches grid routing golden`, () => {
      const actual = characterizeReferenceCsv(examplesDir, file, "grid");
      expect(actual.leftRows).toBe(expected.leftRows);
      expect(actual.pairs).toBe(expected.pairs);
      expect(actual.parseGap).toBe(expected.parseGap);
      expect(actual.uniqueCables).toBe(expected.uniqueCables);
      expect(actual.legCount).toBe(expected.legCount);
      expect(actual.legs).toEqual(expected.legs);
      expect(actual.dominant).toEqual(expected.dominant);
      expect(actual.routing).toEqual(expected.routing);
    });
  }
});
