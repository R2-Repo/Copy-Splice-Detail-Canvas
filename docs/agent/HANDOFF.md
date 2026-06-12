# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-12 — V1 Print to PDF toolbar button (browser print).

## Done

- **`src/features/export/`** — `printDiagram.ts` (bounds, viewport fit, print orchestration), `usePrintDiagram.ts`, unit tests.
- **Toolbar** — Print to PDF button (disabled until CSV import); printer icon; opens browser print → Save as PDF.
- **Print CSS** — `body.printing-diagram` hides chrome, shows diagram stage, landscape `@page`, preserves callout colors when visible.
- **Viewport restore** — saves/restores live viewport and document title on `afterprint`.

## Next

- Manual QA: import Example #2 (`?fixture=example-2`) → Print to PDF → verify cables/splices/colors; toggle callouts → re-print; cancel print → confirm viewport restores.
- Visual re-test: Example #2 → Manual → drag vertical leg at fusion dot ↔; drag cable (same side, no flip).

## Commands verified

```bash
npm run test:layout   # 3/3 pass
npm run check
npx vitest run src/features/export/printDiagram.test.ts   # 6/6 pass
npm run test:ci       # 183/183 pass
npm run build
```
