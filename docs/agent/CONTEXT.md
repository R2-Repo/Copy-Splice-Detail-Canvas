# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-29)

**SDC-LAYOUT-002 import fix** — quad optimizer candidates no longer false-fail fan-out stem alignment; validator uses evaluated graph state + quad-side grouping.

**Routing-first side placement docs** — rule pack + agent docs: no user 2-side / 4-side toggle; import optimizer assigns cable edges (L/R/T/B) from strand routing search [SDC-CORE-001], [SDC-SCORE-001].

**Recoverable import fallback** — heuristic is a normal candidate in the final pool; `pickBestRecoverableCandidate` ranks by rule failures + weighted penalties when no finalist fully passes.

**Import optimizer shipped** — beam search (default), routing-first side placement, routing intent + seed generation, finalist fallback, proxy T1, tiered `runRulesForTier`. See [`IMPORT_OPTIMIZER_BUILD.md`](./IMPORT_OPTIMIZER_BUILD.md).

## Active build track

- Import optimizer / routing-first layout
- SDC-LAYOUT-002 quad validation fix (merge with main)
- Manual QA on reference CSVs after merge

## Branch

- `cursor/fix-layout-002-import-e00b` — LAYOUT-002 false-failure fix on top of main
