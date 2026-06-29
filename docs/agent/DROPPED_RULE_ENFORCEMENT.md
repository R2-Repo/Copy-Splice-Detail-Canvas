# Dropped rule enforcement (contract vs code)

> **2026-06-28** — Q3/Q4/Q7/Q8 enforcement removed from validators and layout pipeline. **Routing still assigns jogX** in frozen `spliceEdgeRouting.ts` (geometry only — not validated).

| Dropped from contract | Enforcement removed? | Notes |
|----------------------|----------------------|-------|
| Dominant cable pair (Q3) | **Yes** | Deleted `dominantCablePair.ts`; placement/search use adjacency/affinity heuristics only |
| Ring-cut visual split (Q4) | **Yes** | Single visual cable per physical cable; no `~0`/`~1` split |
| Center nest + bundle trunk (Q7) | **Validators yes** | EDGE-005/007/010 checks removed; jogX still computed in frozen routing |
| H–V–H path shape (Q8a) | **Yes** | EDGE-009/010 checks removed |
| Distinct lanes on mount (Q8b) | **Yes** | EDGE-001 check removed from collision eval |
| Through-cable row sort (Q8c) | **Yes** | Row order = tube group + stable CSV order (no through-first / dominant blocks) |

## Still in code (internal check IDs — rename pass pending)

`layoutRules.ts` still uses FBR-*, TUB-*, CBL-*, ROW-*, EDGE-*, DOT-*, STR-* for active checks. Next pass: rename to SDC subcodes or move into `src/features/rules/`.

## Do not cite in chat or agent docs

- Legacy rule ID prefixes in user-facing text
- Deleted: `LAYOUT_RULES.md`, `RULE_ID_MAP.md`, `RULE_PRIORITY.md`
