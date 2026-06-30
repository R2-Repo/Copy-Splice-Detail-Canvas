# SDC Python sidecar (dev-only)

Local **search coordinator** for import, routing, and rules development. **Not shipped in the PWA** and **not part of `npm run smoke`.**

TypeScript remains the source of truth for routing, rules, and T2 evaluation. Python owns **strategy**, **parallelism**, and **dev-scale search**.

## Setup

From repo root:

```bash
npm install
cd tools/sdc-sidecar
python -m pip install -e .
# Optional: Ray for multi-core batch eval (Python 3.11–3.12)
python -m pip install -e ".[ray]"
```

**Requirements:** Python 3.11+, Node 20+, npm.

## Architecture

```
Python sdc CLI (strategy + Ray/ProcessPool)
  → DaemonPool (HTTP, persistent TS processes)
    → tools/sdc-eval/daemon.ts
      → tiered T0/T1/T2 eval, layoutSearch, rules
```

Optional PWA hook: `src/features/layoutSearch/deepSearchClient.ts` → `sdc serve` on `http://127.0.0.1:18780`.

## Commands

| Command | Purpose |
|---------|---------|
| `sdc daemon start\|stop\|status` | TS eval daemon pool |
| `sdc deep-search <csv>` | Python-orchestrated tiered search |
| `sdc compare <csv>` | Deep search vs TS incumbent + golden JSON |
| `sdc topology <csv>` | Export topology constraints |
| `sdc evaluate-batch <csv> <candidates.json>` | TS batch tier eval |
| `sdc calibrate-t0 <csv>` | T0 mirror vs TS (zero false rejects) |
| `sdc sweep --preset qa` | Hyperparam sweep |
| `sdc serve` | HTTP API for PWA stub |
| `sdc cache stats\|clear` | SQLite score cache |
| `sdc parse`, `search`, `batch`, `export-top` | Same as before (daemon-accelerated) |

### Examples

```bash
# Start daemon pool (auto-started on first command)
python -m sdc daemon start --workers 2

# Deep search with time budget
python -m sdc deep-search ../../docs/reference/examples/Left-SP-3254.5.csv \
  --strategy evolutionary --time-budget-ms 60000 --population-size 128

# Compare vs incumbent (writes fixtures/golden/)
python -m sdc compare ../../docs/reference/examples/Left-SP-3254.5.csv \
  --max-generations 10 --out-dir .sdc-cache/compare

# HTTP API for PWA stub
python -m sdc serve --port 18780
```

From repo root:

```bash
npm run sdc:sidecar -- deep-search docs/reference/examples/Left-SP-3254.5.csv
npm run sdc:verify
npm run sdc:daemon    # single TS daemon (NDJSON + HTTP)
npm run sdc:serve     # Python HTTP API
```

## Strategies

| Name | Description |
|------|-------------|
| `evolutionary` | Topology seeds + mutations + tiered eval (default) |
| `python_beam` | Beam-width limited expansion |
| `hybrid` | Evolutionary population (TS refinement via compare) |
| `incumbent` | Delegate to TS `layoutSearch` only |

## Reports

Batch/deep-search writes import-diagnostics-aligned artifacts under `--out-dir` or `.sdc-cache/`.

## Direct TS CLI

```bash
echo '{"csvPath":"docs/reference/examples/Left-SP-3254.5.csv"}' | npm run sdc:eval -- analyze-topology
echo '{"csvPath":"...","candidates":[...],"maxTier":"T0"}' | npm run sdc:eval -- evaluate-batch
```

Schemas: [`../sdc-eval/schemas/`](../sdc-eval/schemas/).
