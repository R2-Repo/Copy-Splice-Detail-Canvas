import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

const examples = join(process.cwd(), "docs/reference/examples");

function cableNodeCount(csvPath: string): {
  uniqueNames: number;
  visualCables: number;
  reactFlowCables: number;
} {
  const report = parseBentleyCsv(readFileSync(csvPath, "utf8"));
  const graph = buildConnectionGraph(report);
  const { visualCables } = buildVisualCablesForLayout(graph);
  const { nodes } = buildReactFlowGraph(graph);

  const uniqueNames = new Set(
    report.pairs.flatMap((p) => [p.endpointA.cable, p.endpointB.cable]),
  ).size;

  return {
    uniqueNames,
    visualCables: visualCables.length,
    reactFlowCables: nodes.filter((n) => n.type === "cable").length,
  };
}

describe("import cable counts (one canvas node per physical cable name)", () => {
  it("Example #1: ring-cut keeps split 144 cylinders", () => {
    const counts = cableNodeCount(
      join(examples, "CSV Splice Detail Example #1.csv"),
    );
    expect(counts.uniqueNames).toBe(2);
    expect(counts.visualCables).toBe(3);
    expect(counts.reactFlowCables).toBe(3);
  });

  it("Example #2: four physical cables → four nodes", () => {
    const counts = cableNodeCount(
      join(examples, "CSV Splice Detail Example #2.csv"),
    );
    expect(counts.uniqueNames).toBe(4);
    expect(counts.visualCables).toBe(4);
    expect(counts.reactFlowCables).toBe(4);
  });

  it("Example #3: four physical cables → four nodes", () => {
    const counts = cableNodeCount(
      join(examples, "CSV Splice Detail Example #3.csv"),
    );
    expect(counts.uniqueNames).toBe(4);
    expect(counts.visualCables).toBe(4);
    expect(counts.reactFlowCables).toBe(4);
  });

  it("11400S: six physical cables → six nodes (not doubled)", () => {
    const counts = cableNodeCount(join(examples, "SP-I-15_11400S.csv"));
    expect(counts.uniqueNames).toBe(6);
    expect(counts.visualCables).toBe(6);
    expect(counts.reactFlowCables).toBe(6);
  });

  it("11400S: 288 MP292 BK tube has 12 strands (not duplicated 24)", () => {
    const report = parseBentleyCsv(
      readFileSync(join(examples, "SP-I-15_11400S.csv"), "utf8"),
    );
    const graph = buildConnectionGraph(report);
    const { visualCables } = buildVisualCablesForLayout(graph);
    const { edges } = buildReactFlowGraph(graph);

    const target = "288 DIST I-15: MP 292.3 - 11400 S";
    const vc = visualCables.find((v) => v.cable === target)!;
    const bk = vc.tubes.find((t) => t.tubeColor === "BK")!;
    expect(bk.fibers).toHaveLength(12);

    const cableNodeId = `cable-${vc.id}`;
    const touching = edges.filter(
      (e) => e.source === cableNodeId || e.target === cableNodeId,
    );
    expect(touching.length).toBeGreaterThan(0);
  });

  it("aggregates cable appearances by name only", () => {
    const report = parseBentleyCsv(
      readFileSync(join(examples, "SP-I-15_11400S.csv"), "utf8"),
    );
    const names = new Set(report.cableAppearances.map((a) => a.cable));
    expect(report.cableAppearances.length).toBe(names.size);
    expect(names.size).toBe(6);
    for (const app of report.cableAppearances) {
      expect(cableNameKey(app.cable)).toBe(app.cable);
    }
  });
});
