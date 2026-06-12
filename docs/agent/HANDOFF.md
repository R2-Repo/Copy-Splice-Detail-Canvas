# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-12 — Cable callout sizing fix (text cutoff) + shorter default gap.

## Done

- **Text cutoff fix** — removed `height: 100%` on textarea; measure `scrollHeight` then set explicit height; `white-space: pre-wrap`; chrome buffer via `CALLOUT_BOX_CHROME_Y`.
- **Larger callouts** — width **240px**, min height **80px**.
- **Shorter leaders** — default gap **48 → 20px** (callouts sit closer to cable on generate).

## Next

- Visual re-test: Example #2 → Add cable callouts → confirm readable text, no scroll, straight red leaders to cable outer border.
- Visual re-test: Example #2 → Manual adjust → toggle Auto (diagram unchanged) → refresh (overrides restore) → drag cable in Auto.
- **Group drag** — multi-select fiber anchors, drag together with constraints.

## Commands verified

```bash
npm run check
npm run build
npx vitest run src/features/canvas/callouts/cableCalloutGeometry.test.ts
```

- `npm run test:layout` / `test:ci` — pre-existing failures unchanged (EDGE-010, CSV paths, routing goldens).
