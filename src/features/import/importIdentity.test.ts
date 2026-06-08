import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "./parseBentleyCsv";

describe("import identity (D1/D3)", () => {
  it("D1: same cable in both From and To columns → two legs", () => {
    const csv = [
      "Left ---",
      "HUB,72-SMF DIST MAIN, 1,BL,BL,<->,6 DROP TSC, 1,BL,OR,HUB,CH 1",
      "HUB,6 DROP TSC, 2,BL,GR,<->,72-SMF DIST MAIN, 2,BL,OR,HUB,CH 1",
    ].join("\n");

    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const distLegs = graph.legs.filter((l) => l.cable === "72-SMF DIST MAIN");
    const dropLegs = graph.legs.filter((l) => l.cable === "6 DROP TSC");

    expect(distLegs).toHaveLength(2);
    expect(dropLegs).toHaveLength(2);
    expect(distLegs.map((l) => l.csvColumn).sort()).toEqual(["from", "to"]);
    expect(graph.connections).toHaveLength(2);
  });

  it("D3: legs store empirically derived fibersPerTube", () => {
    const csv = [
      "Left ---",
      "HUB,6 DROP TSC, 1,BL,BL,<->,144-SMF I-15 DIST, 1,BL,BL,HUB,",
      "HUB,6 DROP TSC, 2,BL,OR,<->,144-SMF I-15 DIST, 97,YL,BL,HUB,",
    ].join("\n");

    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const dropLeg = graph.legs.find((l) => l.cable === "6 DROP TSC");
    const distLeg = graph.legs.find((l) => l.cable === "144-SMF I-15 DIST");

    expect(dropLeg?.fibersPerTube).toBe(6);
    expect(distLeg?.fibersPerTube).toBe(12);
  });
});
