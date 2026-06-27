# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-27)

**Fast gates + manual QA.** Rule/layout contract tests **suspended** until user explicitly requests hardening. See [`TESTING.md`](./TESTING.md).

## Active build track

- **Routing-first auto layout — Phase 4 done** — CSV import runs `layoutSearchAsync`; unified `buildCanvasFromCandidate` render; `optimizedLayoutCandidate` persisted; legacy fallback `USE_LEGACY_IMPORT_LAYOUT=1`.
- Smart manual movement: fiber anchor drag, tube tip ↕ + stem ↔, shift+drag bundle, marquee groups, unlock selection
- SDC-UX-001: lock-on-commit (grid hybrid); unlock selection / reset layout in toolbar

## Testing policy

- **Default:** `npm run smoke` (check + `test:fast` + build) — few minutes
- **Layout search CSV regressions (Left-SPI-215, Example #2):** `layoutSearch.slow.test.ts` — opt-in via `test:full` / hardening, not smoke
- **Manual QA:** import example-2 (+ touched CSVs) after visual/routing changes
- **Suspended:** `test:rules` / `test:hardening` — only when user asks
- Deferred weak points: [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md)

## Session gate

```bash
npm run smoke
```

## Baseline

- Branch: `cursor/routing-first-phase4-import-wire-301a`
- Frozen: `.cursor/rules/frozen-routing.mdc`
