import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import {
  cableFiberTopToBottomOk,
  compactTubeFiberLayoutOk,
} from "./tubeFiberLayout";
import { buildVisualCablesForLayout } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

const examples = join(process.cwd(), "docs/reference/examples");

describe("tube fiber layout invariants", () => {
  for (const n of [1, 2, 3] as const) {
    it(`Example #${n}: TIA order + ${24}px pitch within each buffer tube`, () => {
      const graph = buildConnectionGraph(
        parseBentleyCsv(
          readFileSync(
            join(examples, `CSV Splice Detail Example #${n}.csv`),
            "utf8",
          ),
        ),
      );
      const { visualCables } = buildVisualCablesForLayout(graph);
      expect(compactTubeFiberLayoutOk(visualCables)).toBe(true);
      expect(cableFiberTopToBottomOk(visualCables)).toBe(true);
    });
  }
});
