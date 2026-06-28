# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-28)

**Import center-strand render fix.** Grid/nodes routing edges now paint on first CSV import (static engine-node handles + handle remeasure).

## Active build track

- **Routing-first auto layout — Phase 6 done** — side drag + lock-on-commit (SDC-UX-001).
- **Import paint fix** — `fiberAnchor` / `splicePoint` nodes declare `width`/`height`/`handles` so React Flow mounts precomputed leg edges immediately.
- Legacy `USE_LEGACY_IMPORT_LAYOUT=1` fallback still present.

## Testing policy

- **Default:** `npm run smoke` (check + `test:fast` + build) — few minutes
- **Manual QA:** import example-2 — confirm center legs + fusion dots visible before any drag
- KI-003 (Left-SPI-215) still skipped unless `RUN_KNOWN_ISSUES=1`

## Session gate

```bash
npm run smoke          # every session
```

## Baseline

- Branch: `cursor/fix-splice-edge-render-b752`
- Frozen: `.cursor/rules/frozen-routing.mdc`
