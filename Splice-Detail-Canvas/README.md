# Splice Detail Canvas

Modern **frontend-only** React PWA: a node/workflow canvas app built for agentic development in Cursor.

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run check` | TypeScript check |
| `npm run test` | Vitest (watch) |
| `npm run test:ci` | Vitest (CI) |
| `npm run lint` | ESLint |

## For Cursor agents

See **[AGENTS.md](./AGENTS.md)** — workflow, constraints, and handoff files in `docs/agent/`.

## Stack

- Vite + React 19 + TypeScript
- [@xyflow/react](https://reactflow.dev/) for the canvas
- Vitest + Testing Library
- PWA via `vite-plugin-pwa`

## Project layout

```
src/features/canvas/   # Workflow canvas (React Flow)
src/components/        # Shared UI
docs/agent/            # SCOPE, CONTEXT, HANDOFF for agents
docs/reference/        # Your examples, images, resources
.cursor/rules/         # Cursor rules
```

## Reference materials

Add screenshots, specs, and sample files under [`docs/reference/`](./docs/reference/) when ready. See that folder’s README for subfolder layout.

## Vision

Agent-maintained context files, minimal token chatter, and production-ready features — see original goals in git history or ask the agent to **expand** `docs/agent/CONTEXT.md`.

## GitHub Pages

One-time setup in GitHub (browser):

1. Repo **Settings → Pages**
2. **Build and deployment → Source:** choose **GitHub Actions** (not “Deploy from a branch”)
3. Save

After that, every **commit + push to `main`** (including from GitHub Desktop) runs `.github/workflows/deploy-github-pages.yml`, builds the app, and updates the live site.

Live URL: `https://<your-github-username>.github.io/Splice-Detail-Canvas/`

The build sets `GITHUB_PAGES=true` so Vite uses the correct `/Splice-Detail-Canvas/` asset paths. Rename the repo on GitHub? Update the fallback name in `vite.config.ts`.
