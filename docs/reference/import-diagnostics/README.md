# Import optimizer diagnostics samples

Captured VM QA runs with all `VITE_DEBUG_IMPORT_*` and `VITE_DEBUG_LAYOUT_SEARCH` flags enabled.

**Debug flags** (`.env.local`):

```
VITE_DEBUG_IMPORT_OPTIMIZER=1
VITE_DEBUG_IMPORT_TIMING=1
VITE_DEBUG_IMPORT_CANDIDATES=1
VITE_DEBUG_IMPORT_RULES=1
VITE_DEBUG_IMPORT_TOP_BOTTOM=1
VITE_DEBUG_LAYOUT_SEARCH=1
```

## 300N&MAIN (North Temple / 300N_MAIN)

| File | Source |
|------|--------|
| [`300N_MAIN-console.log`](./300N_MAIN-console.log) | Browser console — full `[import optimizer]` group + recoverable selection |
| [`300N_MAIN-diagnostics.json`](./300N_MAIN-diagnostics.json) | `window.__SDC_LAST_IMPORT_DIAGNOSTICS__` after import |
| [`300N_MAIN-run-summary.json`](./300N_MAIN-run-summary.json) | Headless QA script summary |
| [`300N_MAIN-screenshot.png`](./300N_MAIN-screenshot.png) | Viewport screenshot after import (1280×720) |

**Fixture:** `docs/reference/examples/old csv examples/300N_MAIN.csv` (splice **300N&MAIN**, 278 pairs, 4 cables)  
**Captured:** 2026-06-29 (`main` @ LAYOUT-003 #32)  
**Result:** search candidate **fully passes rules** (`recoverableSelection.selectionKind: fully-passing`). Heuristic rejected on soft score (18164 vs 11500). Worker search wall **~1.2s**; total import **~2.1s** diagnostics / **~6.1s** wall. No config error banner.

Reproduce:

```bash
npm run dev
node scripts/import-diagnostics-qa.mjs "docs/reference/examples/old csv examples/300N_MAIN.csv" \
  --out-dir docs/reference/import-diagnostics --basename 300N_MAIN
```

## Left-SP-3254.5

| File | Source |
|------|--------|
| [`Left-SP-3254.5-console.log`](./Left-SP-3254.5-console.log) | Browser console — full `[import optimizer]` group + recoverable selection |
| [`Left-SP-3254.5-diagnostics.json`](./Left-SP-3254.5-diagnostics.json) | `window.__SDC_LAST_IMPORT_DIAGNOSTICS__` after import |
| [`Left-SP-3254.5-run-summary.json`](./Left-SP-3254.5-run-summary.json) | Headless QA script summary |
| [`Left-SP-3254.5-screenshot.png`](./Left-SP-3254.5-screenshot.png) | Viewport screenshot after import (1280×720) |
| [`Left-SP-3254.5-screenshot-fit.png`](./Left-SP-3254.5-screenshot-fit.png) | Fit-view screenshot (1920×1080) |

**Fixture:** `docs/reference/examples/Left-SP-3254.5.csv` (splice **SP-3254.5**, 10 pairs, 4 cables)  
**Captured:** 2026-06-29 (`main` @ searchStats diagnostics fix)  
**Result:** heuristic baseline **fully passes rules** (`recoverableSelection.selectionKind: fully-passing`). Search-best candidate rejected on soft score (1940.8 vs 1940.2). Worker search wall **~660ms**; total import **~4.4s**. `searchStats.evaluatedT0: 54`, `evaluatedT1: 39`. No config error banner.

Reproduce:

```bash
npm run dev
node scripts/import-diagnostics-qa.mjs docs/reference/examples/Left-SP-3254.5.csv \
  --out-dir docs/reference/import-diagnostics --basename Left-SP-3254.5
```

## Left-STATE_OFFICE

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

Reproduce:

```bash
npm run dev
node scripts/import-diagnostics-qa.mjs docs/reference/examples/Left-STATE_OFFICE.csv \
  --out-dir docs/reference/import-diagnostics --basename Left-STATE_OFFICE
```
