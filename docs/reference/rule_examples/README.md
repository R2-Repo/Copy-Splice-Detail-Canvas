# Rule examples — annotated SDC reference library

Canonical **good / bad** screenshot library for center routing and layout behavior. Each example pairs a PNG with JSON metadata grounded in **SDC rule IDs** and the rule pack.

**Machine-readable catalog:** [`index.json`](./index.json)

## Layout

| Path | Purpose |
|------|---------|
| [`Images/good/`](./Images/good/) | Positive routing/layout examples |
| [`Images/bad/`](./Images/bad/) | Failure examples — do not ship these patterns |
| [`metadata/`](./metadata/) | One JSON file per example (`<id>.json`) |
| [`index.json`](./index.json) | Catalog of all examples, rule IDs, and paths |

## Metadata schema

Each `metadata/<id>.json` file includes:

- **`id`**, **`verdict`** (`good` \| `bad`), **`title`**, **`summary`**
- **`suggested_repo_image_path`** — canonical PNG location under this folder
- **`visually_observable_issues`** (bad) or **`visually_observable_good_behavior`** (good)
- **`likely_broken_rules`** (bad) or **`likely_followed_rules`** (good) — each entry has `rule_id`, `related_file`, and why the image fails/passes
- **`grounding.reference_library_location`** — always `docs/reference/rule_examples`

Optional fields: `legacy_rule_mapping`, `classification.migrated_from`, `expected_correction`, `notes`.

## For agents

1. Start with [`index.json`](./index.json) to find examples by **SDC rule ID** or verdict.
2. Read the matching **`metadata/<id>.json`** for detailed failure/pass analysis.
3. Cite **SDC rule IDs** in chat (see [`docs/agent/RULE_DICTIONARY.md`](../../agent/RULE_DICTIONARY.md)).
4. Do **not** confuse this library with [`docs/reference/examples/`](../examples/) — Bentley CSVs for import QA.

## Examples (quick index)

### Good

| ID | Primary SDC rules |
|----|-------------------|
| `good-nested-color-order-spacing-90-bend` | SDC-ROUTE-002, SDC-ORDER-002, SDC-LAYOUT-001 |
| `good-grouping-spacing-order` | SDC-ROUTE-002, SDC-LAYOUT-001, SDC-ORDER-002 |
| `good-shared-plane-staggered-turns` | SDC-ROUTE-003, SDC-ROUTE-002 |
| `good-concentric-nesting-45deg` | SDC-ROUTE-002, SDC-LAYOUT-001, SDC-GRID-001 |
| `good-mixed-color-merge-by-destination` | SDC-ROUTE-002 |
| `good-grouping-and-splitting` | SDC-ROUTE-002, SDC-ROUTE-001 |

### Bad

| ID | Primary SDC rules |
|----|-------------------|
| `bad-avoidable-crossings-same-direction-bend` | SDC-ROUTE-002, SDC-ORDER-002, SDC-ROUTE-003 |
| `bad-fiber-strand-same-lane-overlap` | SDC-ROUTE-003, SDC-LAYOUT-001 |
| `bad-center-routing-congestion-overlap` | SDC-ROUTE-001, SDC-ROUTE-003 |
| `bad-fanout-routing-clearance` | SDC-ROUTE-001, SDC-LAYOUT-002 |
| `bad-fiber-strand-diagonal-routing` | SDC-GRID-001, SDC-LAYOUT-001 |
| `bad-green-brown-reverse-loopback-spacing` | SDC-ROUTE-004, SDC-ROUTE-003 |
| `bad-missed-straight-horizontal-splice-routing` | SDC-LAYOUT-001, SDC-ROUTE-004 |
| `bad-strand-loopback-bend-spacing` | SDC-ROUTE-004, SDC-ROUTE-002 |
| `bad-unnecessary-horizontal-strand-jogs` | SDC-LAYOUT-001 |
| `bad-buffer-tubes-not-centered-origin` | SDC-LAYOUT-002 |

Full list and rule IDs: [`index.json`](./index.json).

## Legacy R-label migration

Examples migrated from the retired `routing-examples/` library use legacy **R1–R6** labels from [`docs/REFACTOR_PLAN.md`](../../REFACTOR_PLAN.md) section 4. Canonical entries:

| Legacy filename | Canonical entry |
|-----------------|-----------------|
| `good-01-grouping-spacing-order.png` | [`good-grouping-spacing-order`](./metadata/good-grouping-spacing-order.json) |
| `good-02-shared-plane-staggered-turns.png` | [`good-shared-plane-staggered-turns`](./metadata/good-shared-plane-staggered-turns.json) |
| `good-03-concentric-nesting-45deg.png` | [`good-concentric-nesting-45deg`](./metadata/good-concentric-nesting-45deg.json) |
| `good-04-mixed-color-merge-by-destination.png` | [`good-mixed-color-merge-by-destination`](./metadata/good-mixed-color-merge-by-destination.json) |
| `good-05-grouping-and-splitting.png` | [`good-grouping-and-splitting`](./metadata/good-grouping-and-splitting.json) |
| `bad-01-avoidable-crossings-same-direction.png` | [`bad-avoidable-crossings-same-direction-bend`](./metadata/bad-avoidable-crossings-same-direction-bend.json) |
| `bad-02-coincident-vertical-lanes.png` | [`bad-fiber-strand-same-lane-overlap`](./metadata/bad-fiber-strand-same-lane-overlap.json) |
