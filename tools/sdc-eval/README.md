# SDC eval CLI (TypeScript)

Headless dev tool — same import/search/routing/rules code path as the PWA, no browser.

## Commands

| Command | Purpose |
|---------|---------|
| `parse` | CSV → graph summary (+ optional full graph JSON) |
| `analyze-topology` | Topology constraints + affinities |
| `search` | Run `layoutSearch` on a CSV or graph |
| `evaluate` | Score one `LayoutCandidate` (full T2) |
| `evaluate-tier` | Tiered T0/T1/T2 eval with `maxTier` |
| `evaluate-batch` | Batch tiered eval on many candidates |
| `rules` | Run SDC rules (with optional candidate) |
| `export-top` | Search + write top N `.sdc.json` |

## Daemon

Long-lived process with session graph cache:

```bash
npm run sdc:daemon
# HTTP default: 127.0.0.1:18765
# POST {"id":"1","command":"ping","payload":{}}
```

## Usage

```bash
npm run sdc:eval -- parse --file request.json
echo '{"csvPath":"docs/reference/examples/Left-SP-3254.5.csv"}' | npm run sdc:eval -- search
npm run sdc:eval -- evaluate-tier --file eval-tier-request.json
```

JSON schemas: [`schemas/`](schemas/).

## Python sidecar

See [`../sdc-sidecar/README.md`](../sdc-sidecar/README.md) — Python orchestrates daemon pool + search strategies.
