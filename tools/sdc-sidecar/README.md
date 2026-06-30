# SDC Python sidecar (dev-only)

Local orchestration layer for import, routing, and rules development. **Not shipped in the PWA** and **not part of `npm run smoke`.**

TypeScript remains the source of truth — this package spawns `npm run sdc:eval` subprocesses.

## Setup

From repo root:

```bash
npm install          # includes tsx for sdc-eval CLI
cd tools/sdc-sidecar
python -m pip install -e .   # optional editable install for `sdc` script
```

Or run without install:

```bash
cd tools/sdc-sidecar
python -m sdc search ../../docs/reference/examples/Left-SP-3254.5.csv
```

**Requirements:** Python 3.11+, Node 20+, npm.

Set `SDC_REPO_ROOT` if auto-detection fails (optional — `npm run sdc:sidecar` sets it for you).

## Commands

| Command | Purpose |
|---------|---------|
| `sdc parse <csv>` | CSV summary via TS parser |
| `sdc search <csv>` | Full `layoutSearch` headlessly |
| `sdc batch --preset qa` | Parallel fixture sweep + HTML report |
| `sdc experiment search <csv>` | Python candidate generator + TS validate top-K |
| `sdc experiment compare <csv>` | Experimental vs incumbent search (golden JSON) |

### Examples

```bash
# Single search with report files
python -m sdc search ../../docs/reference/examples/Left-SP-3254.5.csv \
  --max-rounds 500 --out-dir ../../docs/reference/import-diagnostics

# Batch QA preset (SP-3254.5, STATE_OFFICE, example-2)
python -m sdc batch --preset qa --workers 1 --out-dir .sdc-cache/batch

# Compare experimental search to TS layoutSearch
python -m sdc experiment compare ../../docs/reference/examples/Left-SP-3254.5.csv \
  --validate-top 10 --iterations 128
```

## Architecture

```
Python sdc CLI
  → subprocess: npm run sdc:eval
    → tools/sdc-eval/cli.ts (parse | search | evaluate | rules)
      → src/features/layoutSearch, grid router, SDC rules
```

Experimental code lives under `sdc/experimental/`:

- `search.py` — random/mutate candidate generation; TS scores winners
- `proxy.py` — optional T0/T1-style pre-filter (not authoritative)

Before porting experiments to TypeScript, follow [`sdc/experimental/port_checklist.md`](sdc/experimental/port_checklist.md).

## Reports

Batch mode writes import-diagnostics-aligned artifacts:

- `<stem>-run-summary.json`
- `<stem>-search-response.json`
- `batch-report.html`
- `batch-summary.json`

See [`docs/reference/import-diagnostics/`](../../docs/reference/import-diagnostics/) for browser-captured samples.

## Direct TS CLI

```bash
echo '{"csvPath":"docs/reference/examples/Left-SP-3254.5.csv"}' | npm run sdc:eval -- parse
```

Schemas: [`../sdc-eval/schemas/`](../sdc-eval/schemas/).
