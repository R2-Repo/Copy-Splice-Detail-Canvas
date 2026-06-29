# Suggested Additional Rule Documents

## 1. CSV Import, Normalization, and Bentley Compatibility
Suggested Rule ID: SDC-IMPORT-001

Purpose:
Define how Bentley OpenComms Designer CSV exports are parsed, normalized, validated, and protected from corruption after user edits.

Should include:
- Required headers.
- Accepted delimiters and line endings.
- Encoding handling.
- Quoted fields.
- Empty rows.
- Hidden/special columns.
- Cable identity normalization.
- Connection pairing extraction.
- Error messages when a modified CSV cannot be parsed.
- Confidence/warning behavior when data is inferred.

Why it matters:
Routing quality depends on correct imported data. This rule should run before [SDC-DATA-001].

## 2. Fusion Splice Dot and Connection Pairing
Suggested Rule ID: SDC-CONNECT-001

Purpose:
Define how imported connection rows create fusion splice dots and how each dot is placed, ordered, locked, and validated.

Should include:
- One splice dot per physical splice pair.
- Dot placement order.
- Dot spacing.
- Dot-to-strand endpoint mapping.
- Dot lock behavior.
- Multi-edge connection behavior when the optimizer places cables on top or bottom edges.
- Handling missing or one-sided/unconnected strands.

Why it matters:
Current rules define strands routing to fusion splice dots, but dot creation and placement need their own source of truth.

## 3. Route Scoring, Retry Layout, and Rule Priority
Suggested Rule ID: SDC-SCORE-001

Purpose:
Define how the app scores layouts and chooses between multiple valid attempts.

Should include:
- Hard failures vs soft warnings.
- Score weights for overlaps, crossings, bends, path length, congestion, nesting quality, fanout spacing, and manual locks.
- Retry layout limits.
- Tie-breaking rules.
- Deterministic output requirement.

Why it matters:
Many rules say the engine should choose the cleanest layout. Scoring needs a dedicated rule so the app behaves predictably.

## 4. Label Placement and Text Collision
Suggested Rule ID: SDC-LABEL-001

Purpose:
Define placement, size, truncation, collision handling, and reserved grid areas for OS circuit names, fiber abbreviations, cable labels, and buffer tube labels.

Should include:
- Label anchor points.
- Side-based orientation.
- Truncation behavior.
- Font size limits.
- Collision detection.
- Label reserved areas.
- PDF export legibility.

Why it matters:
Several rules mention labels, but label behavior is currently spread across fanout, spacing, and routing zone rules.

## 5. Orthogonal Path Geometry and Bend Limits
Suggested Rule ID: SDC-ROUTE-004

Purpose:
Define the exact allowed shape of fiber routes.

Should include:
- Horizontal/vertical segment rules.
- Approved bend types.
- Bend count limits.
- Bend clearance around splice dots.
- Segment simplification.
- How routes connect to fanout exits and splice dots.

Why it matters:
The grid rule implies orthogonal paths, but route geometry should be explicit for implementation.

## 6. Side Assignment and Cable Placement (partially covered)
Suggested Rule ID: SDC-LAYOUT-003

Purpose:
Define how the app chooses left/right/top/bottom cable placement during auto layout and retry layout.

**Current state:** Side assignment is driven by the routing-first import optimizer [SDC-SCORE-001], [SDC-CORE-001]. There is no user two-sided vs four-sided toggle. A dedicated SDC-LAYOUT-003 rule may still formalize retry-layout side moves and user drag side changes [SDC-UX-001].

Should include:
- Optimizer side scoring and seed strategies.
- Cable ordering on each populated edge.
- Side move behavior references [SDC-UX-001].
- Cleanest-side selection.

Why it matters:
The grid and glossary rules define multi-edge geometry, but side-assignment scoring and retry behavior deserve explicit documentation.

## 7. Validation Messages and Severity Levels
Suggested Rule ID: SDC-VALIDATE-001

Purpose:
Define standard validation output for AI agents and UI messages.

Should include:
- Error vs warning vs info.
- Rule ID included in every validation result.
- Object IDs included in every result.
- Suggested fix text.
- Whether PDF export is blocked or allowed.

Why it matters:
This makes rule failures actionable during development and user cleanup.

## 8. Persistence, Config, PDF Export, and Reimport
Suggested Rule ID: SDC-EXPORT-001

Purpose:
Define how the app saves the diagram, manual locks, layout state, and export metadata.

Should include:
- JSON config schema.
- PDF export requirements.
- Optional embedded JSON in PDF.
- Security considerations.
- Reimport behavior.
- Versioning/migrations.

Why it matters:
Manual locks and layout choices must survive reloads and exports [SDC-UX-001].

## 9. Visual Color Rendering and Legend
Suggested Rule ID: SDC-VISUAL-001

Purpose:
Define exact rendered colors, stroke widths, strand layering, striped tube styling, and legend behavior.

Should include:
- Fiber strand colors.
- Buffer tube colors.
- Striped tube rendering.
- Stroke width.
- Selection/hover styles.
- Layer order for controlled crossings [SDC-ROUTE-003].

Why it matters:
The current rules define color order and abbreviations, but not exact visual rendering.
