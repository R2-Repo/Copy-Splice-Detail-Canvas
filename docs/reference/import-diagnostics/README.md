# Import optimizer diagnostics samples

Captured VM QA run with all `VITE_DEBUG_IMPORT_*` flags enabled (`main` @ import diagnostics #22).

| File | Source |
|------|--------|
| [`Left-STATE_OFFICE-console.log`](./Left-STATE_OFFICE-console.log) | Browser console — collapsed `[import optimizer]` group |
| [`Left-STATE_OFFICE-diagnostics.json`](./Left-STATE_OFFICE-diagnostics.json) | `window.__SDC_LAST_IMPORT_DIAGNOSTICS__` after import |
| [`Left-STATE_OFFICE-run-summary.json`](./Left-STATE_OFFICE-run-summary.json) | Headless QA script summary (timing + finalists excerpt) |

**Fixture:** `docs/reference/examples/Left-STATE_OFFICE.csv`  
**Result:** heuristic fallback — no rule-passing finalist (`SDC-LAYOUT-002`, `SDC-ROUTE-001`, `SDC-ROUTE-002`, `SDC-ROUTE-003`). Optimizer wall **~116s**.

Reproduce:

```bash
# .env.local
VITE_DEBUG_IMPORT_OPTIMIZER=1
npm run dev
# Import Left-STATE_OFFICE.csv → console group + window.__SDC_LAST_IMPORT_DIAGNOSTICS__
```

Or: `node scripts/import-diagnostics-qa.mjs docs/reference/examples/Left-STATE_OFFICE.csv`
