import { describe, expect, it } from "vitest";

import { parseSpliceLocation } from "./parseSpliceLocation";

describe("parseSpliceLocation", () => {
  it("parses the Bentley location format from reference CSVs", () => {
    expect(parseSpliceLocation("40.696435 -112.038535")).toEqual({
      lat: 40.696435,
      lon: -112.038535,
    });
  });

  it("parses comma-separated values", () => {
    expect(parseSpliceLocation("40.145101,-111.646422")).toEqual({
      lat: 40.145101,
      lon: -111.646422,
    });
  });

  it("rejects invalid coordinates and malformed values", () => {
    expect(parseSpliceLocation("")).toBeNull();
    expect(parseSpliceLocation("40.1")).toBeNull();
    expect(parseSpliceLocation("40.1 -111.9 extra")).toBeNull();
    expect(parseSpliceLocation("95 -111.9")).toBeNull();
    expect(parseSpliceLocation("40.1 -190")).toBeNull();
    expect(parseSpliceLocation("abc def")).toBeNull();
  });
});
