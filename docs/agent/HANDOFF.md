# Handoff

## Last session (2026-06-30)

**Python Sidecar — Full Power Build** — implemented per plan.

### Shipped

- **TS:** `tools/sdc-eval/daemon.ts` (HTTP + NDJSON), `handlers.ts`, commands `analyze-topology`, `evaluate-tier`, `evaluate-batch`
- **Python:** daemon pool, `deep-search`, `compare`, `topology`, `evaluate-batch`, `sweep`, `serve`, `cache`, `calibrate-t0`
- **Engine:** topology-aware seeds/mutations, evolutionary + beam strategies, coordinator tiered pipeline, T0 mirror, SQLite cache, checkpoints
- **PWA stub:** `src/features/layoutSearch/deepSearchClient.ts` (localhost only, no UI toggle)
- **Verify:** `npm run sdc:verify` expanded (daemon, topology, T0 calibrate)

### Manual QA

- `npm run sdc:verify`
- `npm run sdc:sidecar -- deep-search docs/reference/examples/Left-SP-3254.5.csv --time-budget-ms 30000`
- Import example-2 in app (unchanged default path)

### Notes

- Ray optional (`pip install -e ".[ray]"`) — falls back to sequential/ProcessPool on Python 3.14+
- Daemon ports: 18765+ (pool), serve: 18780
- Winning Python strategy port to TS still follows `tools/sdc-sidecar/sdc/experimental/port_checklist.md`
