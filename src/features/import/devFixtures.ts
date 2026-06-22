import {
  devFixtureMeta,
  type DevFixture,
  type DevFixtureId,
} from "@/features/import/devFixtureMeta";

export type { DevFixture, DevFixtureId } from "@/features/import/devFixtureMeta";
export {
  DEV_FIXTURE_IDS,
  DEV_FIXTURE_META,
  readDevFixtureIdFromLocation,
} from "@/features/import/devFixtureMeta";

/** Browser dev: fetch bundled copy under `/qa-fixtures/{id}.csv`. */
export async function fetchDevFixture(
  id: DevFixtureId,
): Promise<DevFixture | null> {
  const meta = devFixtureMeta(id);
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const res = await fetch(`${base}qa-fixtures/${id}.csv`);
  if (!res.ok) return null;
  const text = await res.text();
  return {
    id: meta.id,
    fileName: meta.fileName,
    text,
    kind: meta.kind,
  };
}
