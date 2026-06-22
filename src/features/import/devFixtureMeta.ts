export type DevFixtureId =
  | "example-1"
  | "example-2"
  | "example-3"
  | "sp"
  | "state"
  | "spi";

export type DevFixture = {
  id: DevFixtureId;
  fileName: string;
  text: string;
  kind: "layout-contract" | "left-reference";
};

export type DevFixtureMeta = {
  id: DevFixtureId;
  fileName: string;
  kind: DevFixture["kind"];
};

/** Names match `layoutContractCsvPaths` / `leftCsvPaths` (browser-safe, no fs). */
export const DEV_FIXTURE_META: DevFixtureMeta[] = [
  {
    id: "example-1",
    fileName: "CSV Splice Detail Example #1.csv",
    kind: "layout-contract",
  },
  {
    id: "example-2",
    fileName: "CSV Splice Detail Example #2.csv",
    kind: "layout-contract",
  },
  {
    id: "example-3",
    fileName: "CSV Splice Detail Example #3.csv",
    kind: "layout-contract",
  },
  {
    id: "state",
    fileName: "Left-STATE_OFFICE.csv",
    kind: "left-reference",
  },
  {
    id: "spi",
    fileName: "Left-SPI-215_I-80.csv",
    kind: "left-reference",
  },
  {
    id: "sp",
    fileName: "Left-SP-3254.5.csv",
    kind: "left-reference",
  },
];

export const DEV_FIXTURE_IDS = DEV_FIXTURE_META.map((m) => m.id);

const metaById = new Map(DEV_FIXTURE_META.map((m) => [m.id, m]));

export function devFixtureMeta(id: DevFixtureId): DevFixtureMeta {
  const meta = metaById.get(id);
  if (!meta) throw new Error(`Unknown dev fixture: ${id}`);
  return meta;
}

export function tryDevFixtureMeta(id: string): DevFixtureMeta | null {
  return metaById.get(id as DevFixtureId) ?? null;
}

export function readDevFixtureIdFromLocation(
  search = typeof window !== "undefined" ? window.location.search : "",
): DevFixtureId | null {
  const raw = new URLSearchParams(search).get("fixture")?.trim().toLowerCase();
  if (!raw) return null;
  return metaById.has(raw as DevFixtureId) ? (raw as DevFixtureId) : null;
}
