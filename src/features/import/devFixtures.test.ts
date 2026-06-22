import { describe, expect, it } from "vitest";

import {
  DEV_FIXTURE_IDS,
  readDevFixtureIdFromLocation,
} from "./devFixtureMeta";
import { resolveDevFixture } from "./devFixturesNode";

describe("devFixtures", () => {
  it("resolves all fixture ids", () => {
    expect(DEV_FIXTURE_IDS).toHaveLength(6);
    for (const id of DEV_FIXTURE_IDS) {
      expect(resolveDevFixture(id)?.id).toBe(id);
    }
  });

  it("readDevFixtureIdFromLocation parses ?fixture=", () => {
    expect(readDevFixtureIdFromLocation("?fixture=example-2")).toBe("example-2");
    expect(readDevFixtureIdFromLocation("?fixture=SP")).toBe("sp");
    expect(readDevFixtureIdFromLocation("?other=1")).toBeNull();
    expect(readDevFixtureIdFromLocation("?fixture=unknown")).toBeNull();
  });
});
