# Handoff

## Last session (2026-06-30)

**SDC-SCORE-001 bend preference + top/bottom scoring**

### Shipped

- **T2 `computeSoftScore`:** 0-corner best, 1-corner small penalty, 2-corner larger penalty; single-bend top/bottom credit; `topBottomRelief` on full eval
- **Removed** `sidesUsed` from soft-score total (T0 + T2); tie-break is stable candidate id only
- **Docs:** `16_SDC-ROUTE-004` preference section → SCORE-001; `15_SDC-SCORE-001`, `ROUTING_FIRST_LAYOUT.md`, `RULE_DICTIONARY.md`
- **Tests:** `layoutScorer.test.ts` bend ladder + T/B credit

### Manual QA

- Import example-2 — confirm top/bottom cables win when they reduce bends/crossings
- `npm run smoke` — CI gate (check + test:fast + build)

### Notes

- Hard bend cap **SDC-ROUTE-004** unchanged (≤2 corners)
- `sidesUsed` still in diagnostics breakdown, not scored
