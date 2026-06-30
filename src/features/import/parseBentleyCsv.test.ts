import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  legEndpointKey,
  logicalEndpointKey,
  parseBentleyCsv,
  parseLeftSectionRows,
} from "./parseBentleyCsv";

import { resolveReferenceCsvPath, referenceCsvAvailable } from "@/testHelpers/layoutContractCsvPaths";

const SAMPLE_ROW =
  "HUB3-8(BLUFFDALE_REDWOOD_RD),6-SMF DROP: MVC MP 3.1 & HARVEST MOON DR,   1,BL,BL,<->,144 DIST: 2100 N TO HARVEST HILLS,  17,OR,SL,HUB3-8(BLUFFDALE_REDWOOD_RD),CH 3022";

describe("parseBentleyCsv", () => {
  it("parses a minimal inline report", () => {
    const csv = ["Left ---", SAMPLE_ROW].join("\n");
    const report = parseBentleyCsv(csv);
    expect(report.pairs).toHaveLength(1);
  });

  it("parses Example #2 with 6 deduped pairs", () => {
    const csv = readFileSync(resolveReferenceCsvPath("CSV Splice Detail Example #2.csv"), "utf8");
    const report = parseBentleyCsv(csv);

    expect(report.header.spliceNumber).toBe("SP-2090.4.5");
    expect(report.header.street).toBe("3300 S & 3175 E");
    expect(report.header.cityState).toBe("COTTONWOOD HEIGHTS");
    expect(report.header.poleNumber).toBe("");
    expect(report.header.description).toBe("UDOT");
    expect(report.header.reportDate).toBe("Wed May 20 13:11:52 2026");
    expect(report.header.location).toBe("40.699735 -111.803808");
    expect(report.pairs).toHaveLength(6);

    const cables = new Set(
      report.pairs.flatMap((p) => [p.endpointA.cable, p.endpointB.cable]),
    );
    expect(cables.has("6 DROP (TSC): 3300 S & 3175 E")).toBe(true);
    expect(cables.has("DIST 18. 3300 S 3175 E/3300 E")).toBe(true);
  });

  it("infers fiber # from To tube+color when blank and tubes differ", () => {
    const row =
      "HUB2-8,11400S DIST,   1,BL,BL,<->,288 DIST I-15: MP 292.3 - 11400 S, ,BK,BL, ,";
    const report = parseBentleyCsv(["Left ---", row].join("\n"));
    expect(report.pairs).toHaveLength(1);
    const to = report.pairs[0]!.endpointB;
    expect(to.tubeColor).toBe("BK");
    expect(to.fiberColor).toBe("BL");
    expect(to.fiberNumber).toBe(85);
  });

  it("same-tube blank fiber# uses peer-copy for crossover rows", () => {
    const row =
      "HUB_2-17,6 DROP (TSC): 3500 S & GARDEN GATE RD,   3,BL,GR,<->,144-SMF 3500 S DIST, ,BL,RO,HUB_2-17,CH 2724";
    const report = parseBentleyCsv(["Left ---", row].join("\n"));
    expect(report.pairs).toHaveLength(1);
    const dist = report.pairs[0]!.endpointB;
    expect(dist.fiberNumber).toBe(11);
    expect(dist.fiberNumberSource).toBe("inferred");
  });

  it("Example #3 parses 28 left rows with zero parse failures", () => {
    const csv = readFileSync(
      resolveReferenceCsvPath("CSV Splice Detail Example #3.csv"),
      "utf8",
    );
    const results = parseLeftSectionRows(csv);
    const failures = results.filter((r) => !r.ok);
    expect(failures).toHaveLength(0);
    expect(results.filter((r) => r.ok)).toHaveLength(28);
    const report = parseBentleyCsv(csv);
    expect(report.pairs).toHaveLength(28);
  });

  it.skipIf(!referenceCsvAvailable("3161.4.csv"))(
    "parses street/city/pole/desc from 3161.4 header",
    () => {
    const csv = readFileSync(resolveReferenceCsvPath("3161.4.csv"), "utf8");
    const report = parseBentleyCsv(csv);
    expect(report.header.street).toBe("PROVO - UNIVERSITY AVE & 1230N");
    expect(report.header.cityState).toBe("3161; 4-TSC CCTV");
    expect(report.header.poleNumber).toBe("LONG111658422");
    expect(report.header.description).toBe("LAT. 40.250826");
  });

  it("legEndpointKey distinguishes through-cable from/to legs", () => {
    const fromEp = {
      device: "HUB",
      cable: "144 MAIN",
      fiberNumber: 1,
      tubeColor: "BL" as const,
      fiberColor: "BL" as const,
      csvColumn: "from" as const,
    };
    const toEp = { ...fromEp, csvColumn: "to" as const };
    expect(legEndpointKey(fromEp)).not.toBe(legEndpointKey(toEp));
    expect(logicalEndpointKey(fromEp)).toBe(logicalEndpointKey(toEp));
  });
});
