# Routing examples — superseded

> **Canonical library:** [`docs/reference/rule_examples/`](../rule_examples/README.md)  
> Use that folder for SDC-grounded metadata, [`index.json`](../rule_examples/index.json), and all new examples.

This folder is kept for **historical reference** only. Images here use legacy **R1–R6** labels from [`docs/REFACTOR_PLAN.md`](../../REFACTOR_PLAN.md) section 4.

## Migration map

| Legacy file | Canonical `rule_examples` entry |
|-------------|----------------------------------|
| `good-01-grouping-spacing-order.png` | [`good-grouping-spacing-order`](../rule_examples/metadata/good-grouping-spacing-order.json) |
| `good-02-shared-plane-staggered-turns.png` | [`good-shared-plane-staggered-turns`](../rule_examples/metadata/good-shared-plane-staggered-turns.json) |
| `good-03-concentric-nesting-45deg.png` | [`good-concentric-nesting-45deg`](../rule_examples/metadata/good-concentric-nesting-45deg.json) |
| `good-04-mixed-color-merge-by-destination.png` | [`good-mixed-color-merge-by-destination`](../rule_examples/metadata/good-mixed-color-merge-by-destination.json) |
| `good-05-grouping-and-splitting.png` | [`good-grouping-and-splitting`](../rule_examples/metadata/good-grouping-and-splitting.json) |
| `bad-01-avoidable-crossings-same-direction.png` | [`bad-avoidable-crossings-same-direction-bend`](../rule_examples/metadata/bad-avoidable-crossings-same-direction-bend.json) (identical bytes) |
| `bad-02-coincident-vertical-lanes.png` | [`bad-fiber-strand-same-lane-overlap`](../rule_examples/metadata/bad-fiber-strand-same-lane-overlap.json) (same failure class) |

## Original annotations (legacy R-labels)

<details>
<summary>Legacy README content — click to expand</summary>

### Good examples (do this)

#### good-01-grouping-spacing-order.png
Fibers route together as groups until their destinations diverge, then peel off. Shows consistent
spacing between groups, clean nesting, and overall order/organization.
Rules: **R1, R3, R5, R6.**

#### good-02-shared-plane-staggered-turns.png
A red and a black fiber share the same horizontal plane and route the same direction, but never
stack: each takes its own vertical lane and turns vertical (at staggered X) before the horizontal
segments would overlap.
Rules: **R3, R4.**

#### good-03-concentric-nesting-45deg.png
A ~10-strand bundle turns a 90 degree corner as concentric parallel corners; bend points march
diagonally at 45 degrees (isotropic pitch).
Rules: **R3, R5.**

#### good-04-mixed-color-merge-by-destination.png
Fibers from different tubes/cables turn vertical and converge onto a new shared horizontal group
of mixed colors. A group is defined by shared path/destination, not color.
Rules: **R5.**

#### good-05-grouping-and-splitting.png
Full diagram: routing spreads across the entire vertical extent into stacked regions; groups form,
travel together, and split when destinations diverge.
Rules: **R1, R5.**

### Bad examples (never do this)

#### bad-01-avoidable-crossings-same-direction.png
Avoidable crossings/overlaps in same-direction bend groups. Violates: **R6 / F1.**

#### bad-02-coincident-vertical-lanes.png
Two strands on the same vertical X, spacing zero. Violates: **R3 / F2.**

</details>
