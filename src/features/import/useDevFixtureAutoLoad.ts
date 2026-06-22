import { useEffect, useRef } from "react";

import { fetchDevFixture } from "@/features/import/devFixtures";
import { readDevFixtureIdFromLocation } from "@/features/import/devFixtureMeta";

/** Dev-only: auto-import CSV when `?fixture=` is present (Phase 7 QA gate). */
export function useDevFixtureAutoLoad(
  loadFromCsv: (text: string, fileName: string) => void,
): void {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!import.meta.env.DEV || loadedRef.current) return;

    const fixtureId = readDevFixtureIdFromLocation();
    if (!fixtureId) return;

    loadedRef.current = true;

    void (async () => {
      const fixture = await fetchDevFixture(fixtureId);
      if (fixture) loadFromCsv(fixture.text, fixture.fileName);
    })();
  }, [loadFromCsv]);
}
