# Handoff

> Agents: overwrite this section at the end of each session.

## Last updated

2026-06-27 — **Routing-first layout plan (unified auto sides)**

### Done

| Area | Change |
|------|--------|
| `docs/agent/ROUTING_FIRST_LAYOUT.md` | Build plan: search → grid route → SDC score; L/R/T/B sides; no layout mode picker on import |
| `vitest.slowTests.ts` | Manifest of suspended rule/layout contract files |
| `vitest.fast.config.ts` | Default gate — excludes slow tests |
| `vitest.hardening.config.ts` | Opt-in — runs suspended tests only |
| `package.json` | `smoke` → `test:fast`; `test:rules` / `test:hardening`; `test:full` for entire suite |
| `docs/agent/TESTING.md` | Testing policy + manual QA checklist |
| CI | `test:fast` instead of full `test:ci` |
| Agent docs + cursor rules | No layout contract runs unless user asks |

### Test status

| Gate | Command | Notes |
|------|---------|-------|
| smoke | `npm run smoke` | **Run to confirm** — target few minutes |
| fast | `npm run test:fast` | Same tests as smoke (no build) |
| rules | `npm run test:rules` | **Suspended** — user must ask |
| full | `npm run test:full` | Entire vitest suite |

### Manual QA (build phase)

1. `npm run dev` → import **example-2**
2. Drag fiber anchors, tube tips, bundles as relevant
3. Import any CSV touched by the feature

### Next

1. **Phase 1** [`ROUTING_FIRST_LAYOUT.md`](./ROUTING_FIRST_LAYOUT.md): `evaluateLayoutCandidate` (L/R) + brute-force test fixture
2. Continue smart manual adjust + MVP features
3. Re-enable `test:rules` after Phase 5 (search on reference CSVs)

### Frozen

- `spliceEdgeRouting.ts` — no edits without user approval
