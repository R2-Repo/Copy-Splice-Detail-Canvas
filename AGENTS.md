# Agent guide — Splice Detail Canvas

Frontend-only React PWA: node/workflow canvas (React Flow). No backend unless the user adds one.

## Read first

| File | Purpose |
|------|---------|
| `docs/agent/SCOPE.md` | Product vision, MVP, features, non-goals |
| `docs/agent/CONTEXT.md` | Current focus, decisions, blockers (current-only) |
| `docs/agent/HANDOFF.md` | Last session summary for the next agent |
| `docs/agent/ARCHITECTURE.md` | Folders, patterns, extension points |
| `splice_detail_canvas_rule_pack/00_Rule_Index.md` | **Canonical SDC rules** — public contract |
| `src/features/rules/sdcCheckIds.ts` | **SDC subcodes** for atomic layout/routing checks |
| `docs/agent/QUAD_LAYOUT.md` | **Top/bottom edge geometry** — render adapters when optimizer places cables on T/B; see ROUTING_FIRST_LAYOUT |
| `docs/agent/ROUTING_FIRST_LAYOUT.md` | **Routing-first auto layout** — search pipeline build plan (canonical for import placement) |
| `docs/agent/IMPORT_OPTIMIZER_BUILD.md` | **Import optimizer one-pass build** — four-side scoring, beam search, finalists (active) |
| `.cursor/rules/frozen-routing.mdc` | **Frozen** splice routing symbols — user approval required |
| `docs/agent/RULE_DICTIONARY.md` | Plain-English **SDC** rule IDs for chat |
| `docs/agent/SIMPLE_TERMS.md` | **User simple names** (canonical chat vocabulary) — one-line diagram + simple ↔ official dictionary |
| `docs/agent/CANVAS_GLOSSARY.md` | Expanded diagram part names + screenshots |
| `docs/agent/CHANGELOG.md` | Archived session history (not active requirements) |
| `docs/reference/examples/README.md` | **Left-*** CSVs for user QA and testing (Import in app) |
| `docs/reference/` | Images and other reference assets (when cited) |
| `docs/agent/TESTING.md` | **Fast vs suspended gates**, manual QA |

| `docs/agent/KNOWN_ISSUES.md` | **Deferred layout weak points** — for opt-in hardening only |

## Workflow

1. Read SCOPE → rule pack index → CONTEXT + HANDOFF + **TESTING** before coding.
2. When the user describes the diagram in simple terms, read **SIMPLE_TERMS.md** first and map to official/code names.
3. Plan in bullets; ask if requirements are unclear.
3. Implement in `src/` using existing patterns.
4. Run **`npm run smoke`** (default gate: check + `test:fast` + build) — few minutes.
5. **Manual QA** after visual/routing changes — import example-2 (see `TESTING.md`).
6. Run **`npm run test:rules`** / **`test:hardening`** **only when the user explicitly asks**.
7. SDC rule changes: update rule pack docs + `src/features/rules/` + contract tests (run rules gate when user requests).
8. Update CONTEXT + HANDOFF before ending the session.

## Constraints

- Do not add npm packages without user approval (except this bootstrap stack).
- Do not modify **frozen routing** (see `.cursor/rules/frozen-routing.mdc`) without explicit user approval.
- Do not invent APIs, env vars, or backends.
- Keep changes scoped to the task.
- Prefer `@/` imports from `src/`.

## Stack

- Vite 6, React 19, TypeScript (strict)
- `@xyflow/react` for the canvas
- Vitest + Testing Library
- `vite-plugin-pwa` for installable PWA

## Commands

```bash
npm run dev         # local dev server
npm run smoke       # default gate (check + test:fast + build) — few minutes
npm run test:fast   # fast unit/import tests only
npm run test:engine # manual-adjust subset
npm run test:rules  # SUSPENDED rule/layout contracts — only when user asks
npm run test:full   # entire vitest suite (hours possible)
npm run check       # typecheck
npm run build       # production build
npm run verify      # alias for smoke
```

## Response style

See `.cursor/rules/concise-responses.mdc`. Short bullets; no filler or recaps. User types **expand** for detail.

## Cursor Cloud specific instructions

Frontend-only PWA — no backend, services, or env vars to start. `npm run dev` serves on `http://localhost:5173/`; `npm run build` is the production build.

- `npm run smoke` runs **`test:fast`** only (rule/layout contract tests suspended per `docs/agent/TESTING.md`). Target: **few minutes**.
- Run `npm run test:rules` **only when the user explicitly requests** layout hardening — can take tens of minutes to hours.
- `npm run lint` is **not** part of the `smoke`/`verify` gate.
- The app is import-driven: it shows an empty canvas until a Bentley CSV is imported via the **Import file** toolbar button (native file picker). Sample CSVs for manual/QA testing live in `docs/reference/examples/` (e.g. `Left-SP-3254.5.csv`).

### Browser-automation MCPs

`.cursor/mcp.json` registers two headless browser MCPs so agents can drive a browser against the dev server (`http://localhost:5173/`):

- **Playwright MCP** (`@playwright/mcp`, `--headless`). Browser binary is **not** persisted on a fresh VM — install once: `npx --yes playwright install --with-deps chromium`. Writes session output to `.playwright-mcp/` (gitignored).
- **Chrome DevTools MCP** (`chrome-devtools-mcp`, `--headless --isolated`). Drives the **system** Google Chrome (already in the VM image, Chrome 144+ required) — no per-VM browser install needed. `--isolated` uses a throwaway profile. Exposes DevTools-grade tools (network, performance/Lighthouse, console, screenshots) beyond basic navigation.

`.cursor/mcp.json` also registers the **official GitHub MCP** (remote, `https://api.githubcopilot.com/mcp/`) for issues/PRs/CI/code search. It authenticates via `Authorization: Bearer ${env:GITHUB_MCP_PAT}`, so set a **`GITHUB_MCP_PAT`** secret (a GitHub Personal Access Token) — without it the server returns 401 / "needs login". No token is committed. (The old npm `@modelcontextprotocol/server-github` is deprecated; do not use it.)
