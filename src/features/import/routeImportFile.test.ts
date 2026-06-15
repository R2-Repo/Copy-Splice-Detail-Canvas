import { describe, expect, it } from "vitest";

import { DIAGRAM_CONFIG_SCHEMA_VERSION } from "@/features/export/diagramConfigTypes";

import { routeImportFile } from "./routeImportFile";

const minimalConfigJson = JSON.stringify({
  schemaVersion: DIAGRAM_CONFIG_SCHEMA_VERSION,
  exportedAt: "2026-01-01T00:00:00.000Z",
  report: { pairs: [] },
  cableSides: {},
  layout: {},
});

describe("routeImportFile", () => {
  it("routes valid diagram config JSON to config", () => {
    expect(routeImportFile(minimalConfigJson, "splice-config.sdc.json")).toBe(
      "config",
    );
  });

  it("routes .csv filename with non-config text to csv", () => {
    expect(
      routeImportFile("Bentley Splice Report\nLeft ---\n", "Left-STATE_OFFICE.csv"),
    ).toBe("csv");
  });

  it("routes unsupported files to unknown", () => {
    expect(routeImportFile("hello world", "notes.txt")).toBe("unknown");
    expect(routeImportFile('{"foo": 1}', "random.json")).toBe("unknown");
  });
});
