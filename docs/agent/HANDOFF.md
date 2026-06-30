# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-30 — **rule_examples reference library** (`cursor/rule-examples-docs-2676`)

### This session

- Filled `docs/reference/rule_examples/README.md` + `index.json` (16 examples).
- Fixed image path mismatches (`bad-center-routing-congestion-overlap.png`, `bad-fiber-strand-same-lane-overlap.json`).
- Normalized metadata observation field: bad → `visually_observable_issues`.
- Migrated 5 good examples from `routing-examples/` with SDC metadata; cross-linked legacy bad PNGs.
- Updated `docs/reference/README.md`, `AGENTS.md`, `REFACTOR_PLAN.md`; marked `routing-examples/` superseded.

**Gate:** docs-only — no code change.

### Manual QA

None required (reference docs only).

### Frozen

`spliceEdgeRouting.ts` — not touched.
