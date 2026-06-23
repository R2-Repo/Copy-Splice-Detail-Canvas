# Agent guide — Splice Detail Canvas

Frontend-only React PWA: node/workflow canvas (React Flow). No backend unless the user adds one.

## Read first

| File | Purpose |
|------|---------|
| `docs/agent/SCOPE.md` | Product vision, MVP, features, non-goals |
| `docs/agent/RULE_PRIORITY.md` | Rule conflict resolution when EDGE rules clash |
| `docs/agent/CONTEXT.md` | Current focus, decisions, blockers (current-only) |
| `docs/agent/HANDOFF.md` | Last session summary for the next agent |
| `docs/agent/ARCHITECTURE.md` | Folders, patterns, extension points |
| `splice_detail_canvas_rule_pack/00_Rule_Index.md` | **Canonical 12 SDC rules** — public contract |
| `docs/agent/RULE_ID_MAP.md` | SDC ↔ legacy map (legacy = private engine) |
| `docs/agent/LAYOUT_RULES.md` | **Deprecated** — legacy IDs; see rule pack |
| `docs/agent/QUAD_LAYOUT.md` | **4-side (quad) layout** — architecture, backlog, handoff (**read before quad work**) |
| `.cursor/rules/frozen-routing.mdc` | **Frozen** splice routing symbols — user approval required |
| `docs/agent/RULE_DICTIONARY.md` | Plain-English **SDC** rule IDs for chat |
| `docs/agent/SIMPLE_TERMS.md` | **User simple names** (canonical chat vocabulary) — one-line diagram + simple ↔ official dictionary |
| `docs/agent/CANVAS_GLOSSARY.md` | Expanded diagram part names + screenshots |
| `docs/agent/CHANGELOG.md` | Archived session history (not active requirements) |
| `docs/reference/examples/README.md` | **Left-*** CSVs for user QA and testing (Import in app) |
| `docs/reference/` | Images and other reference assets (when cited) |

## Workflow

1. Read SCOPE → RULE_PRIORITY → rule pack index → CONTEXT + HANDOFF before coding.
2. When the user describes the diagram in simple terms, read **SIMPLE_TERMS.md** first and map to official/code names.
3. Plan in bullets; ask if requirements are unclear.
3. Implement in `src/` using existing patterns.
4. Run **`npm run test:layout`** (layout contract — **required every session** with code changes).
5. Run `npm run check`, `npm run test:ci`, `npm run build`.
6. SDC rule changes: update rule pack docs + `src/features/rules/` + `sdcLayoutContract.test.ts`.
7. Update CONTEXT + HANDOFF before ending the session.

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
npm run test:layout # layout contract (Examples #1–#3) — run before finishing
npm run check       # typecheck
npm run test:ci     # all unit tests
npm run build       # production build
npm run verify      # layout + check + test:ci + build
```

## Response style

See `.cursor/rules/concise-responses.mdc`. Short bullets; no filler or recaps. User types **expand** for detail.
