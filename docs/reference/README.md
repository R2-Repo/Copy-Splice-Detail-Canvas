# Reference materials

Drop **non-code** materials here for you and Cursor agents to use when defining and building the app.

This folder is **not** bundled into the production app unless you explicitly import files from it in `src/`.

## Subfolders

| Folder | Use for |
|--------|---------|
| [`examples/README.md`](./examples/README.md) | Bentley **Left-*** CSVs for user QA and testing |
| [`rule_examples/README.md`](./rule_examples/README.md) | **SDC-grounded** good/bad routing screenshots + JSON metadata ([`index.json`](./rule_examples/index.json)) |
| [`import-diagnostics/`](./import-diagnostics/) | Sample import optimizer console log + diagnostics JSON (300N&MAIN, Left-STATE_OFFICE) |
| [`images/`](./images/) | Glossary/anatomy PNG crops (not rule pass/fail examples) |
| [`routing-examples/`](./routing-examples/README.md) | **Superseded** — legacy R-label routing refs; see `rule_examples/` |
| [`resources/`](./resources/) | Other assets |

## Tips

- Prefer descriptive filenames (`splice-node-mockup.png`, `workflow-v1.json`).
- Keep large binaries reasonable for git; use Git LFS if files grow large.
- When asking an agent to match a design, point to a specific file path in this folder.
- Do not put secrets or credentials here.

## For agents

Read files in this folder **only when** the user references them or when `docs/agent/SCOPE.md` points to them. Summarize relevant details in `CONTEXT.md` if they affect active work.

Early project planning notes were archived to [`docs/archive/`](../archive/) — use `SCOPE.md` for active requirements.
