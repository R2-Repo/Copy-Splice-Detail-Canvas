# SDC eval CLI (TypeScript)

Headless dev tool — same import/search/routing/rules code path as the PWA, no browser.

## Commands

| Command | Purpose |
|---------|---------|
| `parse` | CSV → graph summary (+ optional full graph JSON) |
| `search` | Run `layoutSearch` on a CSV or graph |
| `evaluate` | Score one `LayoutCandidate` |
| `rules` | Run SDC rules (with optional candidate for full route+rules) |

## Usage

```bash
npm run sdc:eval -- parse --file request.json
echo '{"csvPath":"docs/reference/examples/Left-SP-3254.5.csv"}' | npm run sdc:eval -- search
npm run sdc:eval -- evaluate --file eval-request.json
```

JSON schemas: [`schemas/`](schemas/).

## Python sidecar

See [`../sdc-sidecar/README.md`](../sdc-sidecar/README.md) — Python orchestrates this CLI via subprocess.
