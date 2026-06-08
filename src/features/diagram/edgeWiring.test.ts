import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

const examples = join(process.cwd(), "docs/reference/examples");

describe("edge endpoint wiring", () => {
  for (const [name, file] of [
    ["Example #2", "CSV Splice Detail Example #2.csv"],
    ["11400S", "SP-I-15_11400S.csv"],
  ] as const) {
    it(`${name}: splice edges connect two different cable nodes`, () => {
      const graph = buildConnectionGraph(
        parseBentleyCsv(readFileSync(join(examples, file), "utf8")),
      );
      const { edges } = buildReactFlowGraph(graph);
      const splices = edges.filter((e) => e.type === "splice");
      expect(splices.length).toBeGreaterThan(0);
      for (const e of splices) {
        expect(e.source, e.id).not.toBe(e.target);
        expect(e.sourceHandle).not.toBe(e.targetHandle);
      }
    });
  }
});
