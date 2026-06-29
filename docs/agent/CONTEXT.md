# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-29)

**SDC-LAYOUT-003** — side assignment rule (stack/side consistency + paint vs candidate).

**SDC-LAYOUT-002 import fix** (main #30) — quad optimizer candidates no longer false-fail fan-out stem alignment; validator uses evaluated graph state + `quadGeometry` helpers.

**Routing-first side placement** — no user 2-side / 4-side toggle; optimizer assigns L/R/T/B [SDC-CORE-001], [SDC-SCORE-001].

**Recoverable import fallback** — heuristic in final pool; `pickBestRecoverableCandidate` when no finalist fully passes.

## Active build track

- Import optimizer / routing-first layout
- Manual QA on reference CSVs after merge

## Branch

- `cursor/layout-003-side-assignment-3a51` — LAYOUT-003 on top of main LAYOUT-002 quad fix
