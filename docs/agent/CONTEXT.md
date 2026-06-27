# Context

> Agents: keep this file current-only. History lives in git log and [`CHANGELOG.md`](./CHANGELOG.md).

## Focus (2026-06-27)

**Fast gates + manual QA.** Rule/layout contract tests **suspended** until user explicitly requests hardening. See [`TESTING.md`](./TESTING.md).

## Active build track

- **Routing-first auto layout** — [`ROUTING_FIRST_LAYOUT.md`](./ROUTING_FIRST_LAYOUT.md): search thousands of placements; grid route + SDC rules pick best; no 2/4-side toggle; manual side drag later
- Smart manual movement: fiber anchor drag, tube tip ↕ + stem ↔, shift+drag bundle, marquee groups, unlock selection
- SDC-UX-001: lock-on-commit (grid hybrid); unlock selection / reset layout in toolbar

## Testing policy

- **Default:** `npm run smoke` (check + `test:fast` + build) — few minutes
- **Manual QA:** import example-2 (+ touched CSVs) after visual/routing changes
- **Suspended:** `test:rules` / `test:hardening` — only when user asks
- Deferred weak points: [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md)

## Session gate

```bash
npm run smoke
```

## Baseline

- Branch: `main`
- Frozen: `.cursor/rules/frozen-routing.mdc`
