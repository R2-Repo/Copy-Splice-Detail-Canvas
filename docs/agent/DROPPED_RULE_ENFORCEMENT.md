# Dropped rule enforcement (contract vs code)

> **2026-06-28** — User Q&A removed these from the **public SDC contract**. Code may still enforce them until a follow-up migration (some touch **frozen routing** — user approval required).

| Dropped from contract | Still in code? | Location | Follow-up |
|----------------------|----------------|----------|-----------|
| Dominant cable pair (Q3) | Yes | `dominantCablePair.ts`, `layoutRules.ts` DOM-* | Remove or replace with general row-order rules |
| Ring-cut visual split (Q4) | Yes | `visualCables.ts`, CBL-005 check | Remove split behavior or make optional |
| Center nest + bundle trunk (Q7) | Yes | `spliceEdgeRouting.ts` (frozen), EDGE-005/007/010 | **Frozen** — needs explicit user approval |
| Orthogonal H–V–H path shape (Q8a) | Partial | Path templates in routing | Align templates with routing-first or drop checks |
| Distinct lanes on mount (Q8b) | Yes | `spliceEdgeRouting.test.ts`, lane assign | Drop test assertions or reframe under SDC-GRID-001 |
| Through-cable row sort (Q8c) | Yes | `connectionRowOrder.ts` | Remove sort or keep as implementation detail only |

## Do not cite in chat or agent docs

- FBR-*, TUB-*, CBL-*, ROW-*, DOM-*, EDGE-*, DOT-*, STR-* prefixes
- `LAYOUT_RULES.md`, `RULE_ID_MAP.md`, `RULE_PRIORITY.md` (deleted)

## Safe to proceed (docs-only)

Rule pack, agent docs, and SDC failure messages can be updated without touching frozen routing. Removing dropped **enforcement** is a separate code session.
