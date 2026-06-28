# Import optimizer diagnostics samples

Captured VM QA run with all `VITE_DEBUG_IMPORT_*` flags enabled (`main` @ recoverable import fallback #25).

| File | Source |
|------|--------|
| [`Left-STATE_OFFICE-console.log`](./Left-STATE_OFFICE-console.log) | Browser console — full `[import optimizer]` group + recoverable selection |
| [`Left-STATE_OFFICE-diagnostics.json`](./Left-STATE_OFFICE-diagnostics.json) | `window.__SDC_LAST_IMPORT_DIAGNOSTICS__` after import |
| [`Left-STATE_OFFICE-run-summary.json`](./Left-STATE_OFFICE-run-summary.json) | Headless QA script summary (timing, recoverable selection, finalists) |
| [`Left-STATE_OFFICE-screenshot.png`](./Left-STATE_OFFICE-screenshot.png) | Viewport screenshot after import (1280×720) |
| [`Left-STATE_OFFICE-screenshot-fit.png`](./Left-STATE_OFFICE-screenshot-fit.png) | Fit-view screenshot (1920×1080) |

**Fixture:** `docs/reference/examples/Left-STATE_OFFICE.csv`  
**Captured:** 2026-06-28  
**Result:** heuristic baseline **fully passes rules** (`recoverableSelection.selectionKind: fully-passing`). Eight optimizer finalists all fail rules (`SDC-LAYOUT-002`, `SDC-ROUTE-001`, `SDC-ROUTE-002`, `SDC-ROUTE-003`). Optimizer wall **~110s**; heuristic paint **~1.3s**.

**Debug flags** (`.env.local`):

```
VITE_DEBUG_IMPORT_OPTIMIZER=1
VITE_DEBUG_IMPORT_TIMING=1
VITE_DEBUG_IMPORT_CANDIDATES=1
VITE_DEBUG_IMPORT_RULES=1
VITE_DEBUG_IMPORT_TOP_BOTTOM=1
VITE_DEBUG_LAYOUT_SEARCH=1
```

Reproduce:

```bash
npm run dev
node scripts/import-diagnostics-qa.mjs docs/reference/examples/Left-STATE_OFFICE.csv \
  --out-dir docs/reference/import-diagnostics --basename Left-STATE_OFFICE
```
