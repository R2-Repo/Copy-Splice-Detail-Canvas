# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-25)

**Build-first policy + smart manual adjust.** Default gate is `npm run smoke`. Layout hardening deferred per [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md).

## Active build track

- Smart manual movement: fiber anchor drag, tube tip ↕ + stem ↔, shift+drag bundle, marquee groups, unlock selection
- SDC-UX-001: lock-on-commit (grid hybrid); unlock selection / reset layout in toolbar

## Known issues (not session blockers)

See [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md) — KI-001..004 skipped in default `test:ci`.

## Session gate

```bash
npm run smoke
```

Layout/routing changes: also `npm run test:layout`. Hardening: `npm run test:hardening`.

## Baseline

- Branch: `main`
- Frozen: `.cursor/rules/frozen-routing.mdc`
