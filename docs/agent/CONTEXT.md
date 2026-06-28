# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-28)

**Import layout search speed.** Guided search for 4+ cable splices; 45 s time cap; faster candidate eval during search.

## Active build track

- **Routing-first auto layout — Phase 6 done** — side drag + lock-on-commit (SDC-UX-001).
- **Import paint fix** — center leg edges visible on first CSV import.
- **Import search tuning** — `IMPORT_LAYOUT_SEARCH_CONFIG` on fresh import (~20–30 s target for example-2 vs ~60–70 s brute-force path).
- Legacy `USE_LEGACY_IMPORT_LAYOUT=1` fallback still present.

## Testing policy

- **Default:** `npm run smoke` (check + `test:fast` + build) — few minutes
- **Manual QA:** import example-2 — confirm center legs + fusion dots; note import time
- KI-003 (Left-SPI-215) still skipped unless `RUN_KNOWN_ISSUES=1`

## Session gate

```bash
npm run smoke          # every session
```

## Baseline

- Branch: `cursor/cloud-agent-1782613752566-fmcsg`
- Frozen: `.cursor/rules/frozen-routing.mdc`
