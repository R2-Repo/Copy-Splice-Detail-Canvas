import {
  tryDevFixtureMeta,
  type DevFixture,
  type DevFixtureId,
} from "@/features/import/devFixtureMeta";
import {
  LEFT_REFERENCE_CSVS,
  readLeftCsv,
  type LeftReferenceCsv,
} from "@/testHelpers/leftCsvPaths";
import {
  LAYOUT_CONTRACT_CSVS,
  readReferenceCsv,
} from "@/testHelpers/layoutContractCsvPaths";

const EXAMPLE_FILE: Record<"example-1" | "example-2" | "example-3", string> = {
  "example-1": LAYOUT_CONTRACT_CSVS.ringCut,
  "example-2": LAYOUT_CONTRACT_CSVS.dominantPair,
  "example-3": LAYOUT_CONTRACT_CSVS.multiCable,
};

let diskCache: Map<DevFixtureId, DevFixture> | null = null;

function readFixtureText(id: DevFixtureId): string {
  if (id === "example-1" || id === "example-2" || id === "example-3") {
    return readReferenceCsv(EXAMPLE_FILE[id]);
  }
  const fileName = tryDevFixtureMeta(id)!.fileName as LeftReferenceCsv;
  if (!(LEFT_REFERENCE_CSVS as readonly string[]).includes(fileName)) {
    throw new Error(`Left reference CSV not registered: ${fileName}`);
  }
  return readLeftCsv(fileName);
}

/** Node/tests: read CSV from docs/reference via fs helpers. */
export function resolveDevFixture(id: string): DevFixture | null {
  const meta = tryDevFixtureMeta(id);
  if (!meta) return null;
  diskCache ??= new Map();
  const cached = diskCache.get(meta.id);
  if (cached) return cached;
  const fixture: DevFixture = {
    id: meta.id,
    fileName: meta.fileName,
    text: readFixtureText(meta.id),
    kind: meta.kind,
  };
  diskCache.set(meta.id, fixture);
  return fixture;
}
