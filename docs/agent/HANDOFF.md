# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-30 — **Left-SP-3254.5 fix attempt rolled back** (`cursor/left-sp-3254-import-qa-7a31`)

### This session

- User confirmed post-fix import was **worse**, not improved — correct.
- Root cause: layout pair-alignment + W1400 tie-break regressed center routing (vertical chimney, zoomed-out paint).
- **Reverted** `spliceRowLayout.ts`, `horizontalAlign.ts`, layout scorer wiring, tie-break, and sp3254 tests to `main` baseline.
- Re-import with reverted code → **W1133** winner, visual matches original QA screenshot.
- QA artifacts + honest assessment kept: `Left-SP-3254.5-assessment.md`.

**PR #42 should not merge as a fix** — branch is QA + failed experiment documentation only unless user wants a different approach.

**Still broken (unchanged from baseline):** `bad-missed-straight-horizontal-splice-routing`, center ATMS congestion.

### Frozen

`spliceEdgeRouting.ts` — not touched.
