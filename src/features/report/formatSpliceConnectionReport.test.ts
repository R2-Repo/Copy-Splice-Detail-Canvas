import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

import {
  buildSpliceConnectionLines,
  formatEndpoint,
  formatSpliceConnectionReport,
} from "./formatSpliceConnectionReport";

function graphFromFixture(name: string) {
  const csv = readFileSync(
    join(process.cwd(), "public/fixtures", name),
    "utf8",
  );
  return buildConnectionGraph(parseBentleyCsv(csv));
}

describe("formatSpliceConnectionReport", () => {
  it("formats example-2 with cable / tube / strand hierarchy", () => {
    const graph = graphFromFixture("example-2.csv");
    const report = formatSpliceConnectionReport(graph);

    expect(report).toContain("SPLICE CONNECTION REPORT");
    expect(report).toContain("SP-2090.4.5");
    expect(report).toContain("6 connections across 4 cables");

    expect(report).toContain("── 6 DROP (TSC): 3300 S & 3175 E ──");
    expect(report).toContain(
      "#1 BL  →  DIST 18. 3300 S 3175 E/3300 E / BL / #1 BL  Circuit: CH 2090",
    );
    expect(report).toContain(
      "#2 OR  →  DIST 18. 3300 S 3175 E/3300 E / BL / #2 OR  Circuit: CH 2090",
    );
    expect(report).toContain("── DIST 18. 3300 S 2700 E/3175 E ──");
  });

  it("never uses left/right side labels", () => {
    const graph = graphFromFixture("example-2.csv");
    const report = formatSpliceConnectionReport(graph);

    expect(/\bleft\b/i.test(report)).toBe(false);
    expect(/\bright\b/i.test(report)).toBe(false);
  });

  it("marks existing connections when requested", () => {
    const graph = graphFromFixture("example-2.csv");
    const firstId = graph.connections[0]!.id;
    const report = formatSpliceConnectionReport(graph, {
      existingConnectionIds: new Set([firstId]),
    });

    expect(report).toContain("[existing]");
  });

  it("buildSpliceConnectionLines returns one row per connection", () => {
    const graph = graphFromFixture("example-2.csv");
    const lines = buildSpliceConnectionLines(graph);

    expect(lines).toHaveLength(6);
    expect(formatEndpoint(lines[0]!.near)).toMatch(/ \/ BL \/ #\d+ \w+/);
    expect(formatEndpoint(lines[0]!.far)).toMatch(/ \/ BL \/ #\d+ \w+/);
  });
});
