# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-28 — **SDC rule vocabulary cleanup (Q1–Q10)**

### Done

| Area | Change |
|------|--------|
| Rule pack | **SDC-ROUTE-004** (bend budget); 24px pitch in **SDC-GRID-001** + cross-refs; UX dot grouping + snap |
| Deleted docs | `LAYOUT_RULES.md`, `RULE_ID_MAP.md`, `RULE_PRIORITY.md` |
| Rewritten | `RULE_DICTIONARY.md` (SDC-only), `SIMPLE_TERMS.md`, agent `.mdc` rules, `AGENTS.md` |
| Code | `route004.ts`; `ruleFailureMessages.ts`; bend check moved off `route003` |
| Renames (Q10) | `heuristicImportLayout`, `hill-climb` search mode, `composite` routing engine (aliases kept) |
| New doc | `DROPPED_RULE_ENFORCEMENT.md` — contract vs code gaps |

### User Q&A summary

- **Keep hard:** SDC-ROUTE-004 bend budget; 24px pitch everywhere
- **Drop from contract:** dominant pair, ring-cut split, center nest/jogX, Q8 path/lane/row rules
- **Custom:** fusion dots on organized line per group (H or V path); near-straight snap import + manual
- **Delete** RULE_PRIORITY; **rename** non-rule legacy naming

### Not done (needs follow-up)

- Remove dropped-rule **enforcement** in `layoutRules.ts` / `dominantCablePair.ts` / frozen `spliceEdgeRouting.ts` — see `DROPPED_RULE_ENFORCEMENT.md`
- Full validator migration out of `layoutRules.ts`

### Gates

- `npm run smoke` — pass (358 fast tests + build)

### Frozen

`spliceEdgeRouting.ts` — not touched.
