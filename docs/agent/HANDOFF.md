# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-27 — **Routing-first layout Phase 5 (rule hardening + SDC-SCORE-001)**

### Done

| Area | Change |
|------|--------|
| Rule pack | `SDC-SCORE-001` active in `00_Rule_Index.md` + `15_SDC-SCORE-001_Composite_Layout_Score.md` |
| Engine | `score001.ts` wired in registry; `evaluateLayoutCandidate` sets `optimizedLayoutCandidate` |
| Contract tests | `sdcLayoutContract.test.ts` builds via `layoutSearch` + `evaluateLayoutCandidate` (not legacy heuristics) |
| Snapshots | `src/testHelpers/fixtures/searchCandidates/{example-1,example-2,example-3,left-sp-3254.5}.json` |
| KI cleanup | **KI-001/002/004 resolved** — removed skips for example-3 + left-sp-3254.5; KI-003 (Left-SPI-215) remains |
| SDC-SCORE-001 tests | Synthetic 3-cable beats baseline; tie-break; soft score on reference fixtures |

### Test status

| Gate | Command | Result |
|------|---------|--------|
| smoke | `npm run smoke` | **Pass** (~49s) |
| layout (Phase 5 reference) | `npm run test:layout` | **Pass** 12/12 (~21s with snapshots) |
| rules (full hardening) | `npm run test:rules` | Long-running (37 suspended files); rule contract portion green |
| slow CSV search | `layoutSearch.slow.test.ts` | Opt-in (not in smoke) |

### Manual QA

1. `npm run dev` → import **example-2**, **Left-SP-3254.5**, **example-3** (now pass contract tests)
2. Confirm optimizer overlay + no layout mode picker
3. Optional: `RUN_KNOWN_ISSUES=1 npm run test:layout-slow` for Left-SPI-215

### Next

1. **Phase 6** — manual side drag (SDC-UX-001 side assignment)
2. Remove `USE_LEGACY_IMPORT_LAYOUT=1` fallback after full `test:rules` green on all suspended files

### Frozen

- `spliceEdgeRouting.ts` — no edits (search calls frozen APIs only)
