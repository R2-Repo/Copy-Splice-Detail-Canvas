# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-25 — **Build-first policy + smart manual adjust**

### Done

| Area | Change |
|------|--------|
| `KNOWN_ISSUES.md` + `knownLayoutIssues.ts` | KI-001..004 registry; tests skip known reds |
| `package.json` | `smoke`, `test:hardening`, `verify` → smoke, `verify:full` |
| Agent docs | SCOPE build phase; AGENTS + cursor rules; STABILIZATION paused |
| `useManualAdjustEngine` | Fiber anchor drag; handle cache for marquee; tube preview repin |
| `TubeManualHandles` | Stem reach ↔ drag (`stemReachX`) |
| `smartSelect.ts` | Same-tube group + shift+bundle drag targets |
| `WorkflowCanvas` | Unlock selection toolbar; repin preview during anchor drag |

### Test status

| Gate | Command | Notes |
|------|---------|-------|
| smoke | `npm run smoke` | **Run to confirm** |
| layout | `npm run test:layout` | Skips KI-001, KI-002 grid rules |
| hardening | `npm run test:hardening` | Opt-in full check |

### Next

1. Manual QA: import example-2 → drag fiber anchors, tube tips, stem handles; shift+drag bundle
2. PDF/export polish (MVP-c)
3. Hardening track: KI-001 example-3 overlap when scheduled

### Frozen

- `spliceEdgeRouting.ts` — no edits without user approval
