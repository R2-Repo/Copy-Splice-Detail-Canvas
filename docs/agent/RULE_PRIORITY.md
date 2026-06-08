# Layout rule priority

> When rules conflict, higher priority wins. Do not weaken P0 rules without explicit user approval.

## Priority tiers

| Priority | Rules | Policy |
|----------|-------|--------|
| **P0** | FBR-*, TUB-*, CBL-*, ROW-*, DOM-*, STR-* | Never weaken without user approval |
| **P1** | EDGE-004 | ≤2 bends total across both legs; deconflict via distinct `midX` only — no Y-track offsets that add bends |
| **P2** | EDGE-001, EDGE-008, EDGE-012 | Distinct routing lanes ≥24px apart; global deconflict across zones |
| **P3** | EDGE-011 | Y-track / gap-bend offsets — only when P1 is still satisfied |
| **P4** | EDGE-009, EDGE-010 | OS clearance, bundle trunks — must not violate P1 |

## Conflict resolution

**When EDGE-011 and EDGE-004 conflict:** satisfy EDGE-004 first. Accept minor overlap over extra bends unless the user explicitly overrides.

**When lane deconflict and two-bend limit both apply:** use distinct `midX` lanes (P2) within the bend budget (P1). Do not add vertical elbows in the gap to separate strands.

**Visual QA:** If contract tests pass but Examples #1–#3 look wrong, treat as a regression — revert to tag `layout-baseline-v1` and fix with a scoped session.

## Session scope

One bug → one example CSV → one rule ID → max 2 source files. Read this file before changing routing or layout.
