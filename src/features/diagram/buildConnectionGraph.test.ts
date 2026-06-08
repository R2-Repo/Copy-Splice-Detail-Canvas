import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

const example2Path = join(
  process.cwd(),
  "docs/reference/examples/CSV Splice Detail Example #2.csv",
);

describe("buildConnectionGraph", () => {
  it("Example #2: six pairs, multiple cable legs", () => {
    const report = parseBentleyCsv(readFileSync(example2Path, "utf8"));
    const graph = buildConnectionGraph(report);

    expect(graph.report.pairs).toHaveLength(6);
    expect(graph.connections.filter((c) => c.kind === "fiber")).toHaveLength(6);
    expect(graph.legs.length).toBeGreaterThanOrEqual(4);

    const distLegs = graph.legs.filter((l) => l.cable.includes("DIST 18"));
    expect(distLegs.length).toBeGreaterThanOrEqual(2);
  });
});
