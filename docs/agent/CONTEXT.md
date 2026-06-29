# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-29)

**Import searchStats diagnostics** — worker slice now records tier counters alongside eval sub-phases; `globalThis` singleton avoids duplicate module state in worker bundle.

**SDC-LAYOUT-001 import validation** — spacing checks use painted candidate geometry (merged with main's `buildLayoutRuleContextFromEvaluated` + explicit `placement` from search eval).

**SDC-LAYOUT-003** — side assignment rule (stack/side consistency + paint vs candidate).

**SDC-LAYOUT-002 import fix** (main #30) — quad optimizer candidates no longer false-fail fan-out stem alignment.

**Routing-first side placement** — no user 2-side / 4-side toggle; optimizer assigns L/R/T/B [SDC-CORE-001], [SDC-SCORE-001].

## Active build track

- Import optimizer / routing-first layout
- Manual QA: import example-2 + Left-SP-3254.5 + Left-STATE_OFFICE after layout rule changes

## Branch

- `cursor/fix-layout001-import-violations-ad52` — LAYOUT-001 placement fix merged onto main LAYOUT-002/003 work
