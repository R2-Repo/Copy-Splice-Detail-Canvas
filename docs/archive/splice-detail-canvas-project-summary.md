# Splice Detail Canvas App — Project Summary

## 1. Project Goal

The goal is to build a **front-end-only React web app** that can take a Bentley OpenComms Designer exported CSV/XLSX splice report, parse the fiber connection data, and generate a clean editable splice detail diagram.

The current Bentley process for creating final splice details is very tedious and feels dated. The desired workflow is:

```txt
Upload Bentley CSV/XLSX
→ Parse fiber splice connections
→ Generate an editable canvas diagram
→ Allow manual cleanup if needed
→ Export final splice detail as PDF
```

The app does not need to perfectly clone Bentley’s output. The goal is to produce a **clean, readable, efficient splice detail** that is close to the Bentley-style diagram but easier to generate and edit.

---

## 2. Source Files Provided

The project has three paired example sets:

```txt
Splice Detail Example #1 image ↔ CSV Splice Detail Example #1 spreadsheet
Splice Detail Example #2 image ↔ CSV Splice Detail Example #2 spreadsheet
Splice Detail Example #3 image ↔ CSV Splice Detail Example #3 spreadsheet
```

Difficulty increases from example 1 to example 3.

Additional reference images were also provided:

```txt
Screenshot of Bentley Splice and Fiber
6 Count Buffer Tube and Fiber Colors
288 Count Fiber Optic Buffer Tube and Fiber Colors
```

These images explain how the physical splice enclosure, fiber cable hierarchy, buffer tube colors, and fiber colors relate to the CSV data and final splice detail drawing.

---

## 3. What the Bentley CSV/XLSX Represents

The Bentley export is not a clean traditional table. It is more like a report export with:

- Metadata rows
- Section labels
- Blank rows
- Left and right report sections
- Inconsistent or missing headers
- Repeated/mirrored connection data
- Occasional blank fiber number values

The useful data begins around the `Left ---` and `Right ---` sections.

The CSV/spreadsheet describes **fiber splice connections**, not a full cable inventory.

This is critical:

```txt
The CSV only shows fibers that are spliced or represented in the splice detail.
It does not show every fiber in the cable.
```

For example, a 144-count cable may only show fibers 11 and 12 in the export. That does not mean the cable only has two fibers. It means only fibers 11 and 12 are involved in the splice detail. The rest of the fibers are likely expressed through the enclosure and untouched.

---

## 4. CSV Column Structure

The Bentley CSV has columns that roughly represent:

```txt
Left Device
Left Cable
Left Fiber Number
Left Buffer Color
Left Fiber Color
Right Cable
Right Fiber Number
Right Buffer Color
Right Fiber Color
Right Device
OS / Circuit Name
```

However, one important column is missing a header.

### Missing Header Column

The column immediately to the left of `Buffer` contains numeric values such as:

```txt
1, 2, 3, 4, 11, 12
```

That column is the **fiber number**.

Bentley consistently exports this fiber number column without a proper header.

Therefore, the parser cannot rely only on headers. It must use a positional schema.

Example normalized column interpretation:

```ts
Left side columns:
[
  "leftDevice",
  "leftCable",
  "leftFiberNumber",   // missing Bentley header
  "leftBufferColor",
  "leftFiberColor"
]

Right side columns:
[
  "rightCable",
  "rightFiberNumber",  // missing Bentley header
  "rightBufferColor",
  "rightFiberColor",
  "rightDevice",
  "circuitName"        // Bentley OS column
]
```

---

## 5. Device and OS Columns

Bentley includes columns named `Device`. These are lower-priority metadata for the first version of the app.

The `OS` column is more important long term.

### OS Column

The `OS` column represents the **circuit name** associated with a fiber.

A fiber may or may not have a circuit name. Circuit names help track services or circuits across the network.

For MVP:

```txt
Parse OS
Store OS
Do not require OS
Do not use OS for initial layout
Do not block rendering if OS is blank
```

Later, the circuit name should be displayable in the final splice detail or an inspector panel.

Example data model field:

```ts
circuitName?: string;
```

Important rule:

```txt
OS / circuit name is fiber-level metadata, not cable-level metadata.
```

A cable contains many fibers. Each fiber can have no circuit, a different circuit, or a circuit value that changes over time.

---

## 6. Fiber Cable Hierarchy

The physical hierarchy is:

```txt
Fiber Cable
└── Buffer Tube
    └── Fiber Strand
```

This hierarchy must be reflected in the data model and the canvas rendering logic.

A fiber cable contains multiple buffer tubes.

Each buffer tube contains multiple individual fiber strands.

Each fiber strand has:

- A fiber number
- A fiber color
- A buffer tube color
- Possibly a circuit name
- Possibly a splice connection

Example model:

```ts
type FiberEndpoint = {
  cableLegId: string;
  bufferTubeNumber?: number;
  bufferTubeColor: string;
  bufferTubeStripe?: string;
  fiberNumber?: number;
  fiberColor: string;
  circuitName?: string;
};
```

---

## 7. Fiber Numbers, Fiber Colors, and Buffer Tubes

Fiber optic cables use standardized color code patterns.

Most cables in this project context use **12-count buffer tubes**.

That means:

```txt
Each buffer tube contains 12 fibers.
The fiber color sequence repeats inside every buffer tube.
The buffer tube colors also follow the same general color sequence.
```

### Standard 12-Color Fiber Sequence

The common 12-color sequence is:

```txt
1  Blue
2  Orange
3  Green
4  Brown
5  Slate
6  White
7  Red
8  Black
9  Yellow
10 Violet
11 Rose
12 Aqua
```

Common abbreviations:

```txt
BL = Blue
OR = Orange
GR = Green
BR = Brown
SL = Slate
WH = White
RD = Red
BK = Black
YL = Yellow
VI = Violet
RO = Rose
AQ = Aqua
```

---

## 8. Standard 12-Count Buffer Tube Logic

For a typical 12-count buffer tube cable:

```txt
Buffer Tube 1 = fibers 1–12
Buffer Tube 2 = fibers 13–24
Buffer Tube 3 = fibers 25–36
Buffer Tube 4 = fibers 37–48
...
```

Example:

```txt
Blue buffer tube / Blue fiber   = fiber 1
Blue buffer tube / Orange fiber = fiber 2
Blue buffer tube / Rose fiber   = fiber 11
Blue buffer tube / Aqua fiber   = fiber 12

Orange buffer tube / Blue fiber   = fiber 13
Orange buffer tube / Orange fiber = fiber 14
Orange buffer tube / Aqua fiber   = fiber 24
```

Formula for standard 12-count tubes:

```ts
fiberNumber = ((bufferTubeNumber - 1) * 12) + fiberColorIndex;
```

Where `fiberColorIndex` is 1 through 12 based on the standard color order.

---

## 9. Cable Counts

Common cable counts include:

```txt
6-count
12-count
24-count
48-count
96-count
144-count
288-count
```

For standard 12-count buffer tube cables:

```txt
12-count cable  = 1 buffer tube  × 12 fibers
24-count cable  = 2 buffer tubes × 12 fibers
48-count cable  = 4 buffer tubes × 12 fibers
144-count cable = 12 buffer tubes × 12 fibers
288-count cable = 24 buffer tubes × 12 fibers
```

The app should store the cable count separately from the fibers shown in the splice detail.

Example:

```ts
type CableLeg = {
  id: string;
  cableName: string;
  fiberCount?: number;
  fibersPerBufferTube: 6 | 12;
};
```

---

## 10. 288-Count and Striped Buffer Tubes

For cables above 144 fibers, such as 288-count cables, the color sequence repeats again, but the buffer tubes may include a stripe.

Example:

```txt
Tube 1:  Blue buffer tube             = fibers 1–12
Tube 13: Blue buffer tube with stripe = fibers 145–156
```

Physically, a striped buffer tube may have a black stripe to distinguish it from the earlier same-color tube.

This means the app cannot always identify a high-count buffer tube by color alone.

For high-count cables, the app may need:

```ts
bufferTubeColor: "BL";
bufferTubeStripe?: "BK";
bufferTubeNumber: 13;
```

Important rule:

```txt
For 288-count cables, buffer color alone may be ambiguous.
Tube number and/or stripe information may be required.
```

---

## 11. 6-Count Buffer Tube Exception

Some older cables use 6-count buffer tubes.

For these:

```txt
Each buffer tube contains 6 fibers instead of 12.
```

The same general color code idea applies, but scaled down.

The app should support a cable-level property:

```ts
fibersPerBufferTube: 6 | 12;
```

For 6-count tubes:

```ts
fiberNumber = ((bufferTubeNumber - 1) * 6) + fiberColorIndex;
```

A simple first-pass assumption might be:

```ts
if cableCount <= 6:
  fibersPerBufferTube = 6
else:
  fibersPerBufferTube = 12
```

But this should be user-editable because real-world fiber records can vary.

---

## 12. Fiber Identity

A fiber should not be identified by color alone.

A fiber identity should include:

```txt
Cable leg
Buffer tube
Fiber number
Fiber color
Buffer color
```

Example:

```ts
type FiberIdentity = {
  cableLegId: string;
  fiberNumber?: number;
  bufferTubeColor: string;
  fiberColor: string;
};
```

For high-count cables, add:

```ts
bufferTubeNumber?: number;
bufferTubeStripe?: string;
```

Important:

```txt
Fiber colors repeat in every buffer tube.
Buffer colors repeat in larger cables.
Therefore, color alone is never enough.
```

---

## 13. Missing Fiber Numbers

Bentley sometimes exports blank fiber number values for some strands.

The app should not fail when a fiber number is missing.

Possible behavior:

```txt
1. Preserve the blank value from the CSV.
2. Attempt to infer the fiber number from buffer color + fiber color + cable count.
3. Flag inferred values as inferred, not original.
4. Let the user override the value manually.
```

Example:

```ts
type FiberEndpoint = {
  fiberNumber?: number;
  inferredFiberNumber?: number;
  fiberNumberSource: "csv" | "inferred" | "manual" | "missing";
};
```

Validation should be possible:

```txt
If fiber number exists and agrees with color code → valid
If fiber number is missing but inferable → infer and warn lightly
If fiber number conflicts with color code → flag for review
```

---

## 14. Spliced Fibers vs Expressed Fibers

The CSV/splice detail only shows fibers involved in the splice detail.

A 144-count cable may enter a splice enclosure, but only a few fibers are cut and spliced.

The other fibers remain untouched and pass through the enclosure. These are called **expressed-through fibers**.

Example:

```txt
144-count cable enters splice enclosure
Fibers 11 and 12 are accessed and spliced
Fibers 1–10 and 13–144 are expressed through and untouched
```

The export may only show fibers 11 and 12.

The app should distinguish:

```ts
type FiberState =
  | "spliced"
  | "expressed"
  | "unknown";
```

For MVP, the app should probably render only fibers present in the CSV.

Later, the app can show summaries like:

```txt
144ct Main Cable
Spliced: 2
Expressed through: 142
```

Important rule:

```txt
Missing rows do not mean missing fibers.
They usually mean those fibers are not touched in this splice detail.
```

---

## 15. Ring Cut / Mid-Sheath Splice Concept

Example #1 is likely a **ring cut** or **mid-sheath splice**.

A mainline cable continues through the splice enclosure, but only selected fibers are accessed, cut, and spliced to another cable such as a drop cable.

Example:

```txt
144-count mainline fiber runs east/west along a road
Splice enclosure is placed on the cable
Only fibers needed for a traffic signal drop are opened and spliced
The rest of the fibers remain untouched through the enclosure
```

This means one physical cable may appear visually as two directional legs in the splice detail.

---

## 16. Same Cable Name, Different Cable Legs

A major issue is that Bentley may use the exact same cable name for both directions of a mainline cable.

Example:

```txt
UDOT 144 SMF entering from west
UDOT 144 SMF leaving to east
```

Physically, this may be the same cable route. But inside the splice detail, it needs to be treated as two separate **cable legs**.

Bad model:

```ts
cableId = cableName;
```

Better model:

```ts
cableLegId = cableName + enclosure context + visual role/direction;
```

Example:

```ts
{
  cableName: "UDOT 144 SMF",
  cableLegId: "udot-144-smf-west-leg",
  legRole: "mainline-west",
  canvasSide: "left"
}

{
  cableName: "UDOT 144 SMF",
  cableLegId: "udot-144-smf-east-leg",
  legRole: "mainline-east",
  canvasSide: "right"
}
```

Important rule:

```txt
Cable name is not a unique identifier.
Cable leg is the correct splice-detail object.
```

---

## 17. Cable Name vs Cable Leg vs Canvas Group

The app should separate these concepts:

```txt
Cable name  = Bentley/network asset name
Cable leg   = how that cable appears at this splice enclosure
Canvas node = how that cable leg is drawn in the splice detail
```

This distinction is required because:

- Same cable name may appear multiple times.
- The same physical cable can behave as separate east/west legs at an enclosure.
- The canvas layout may move cables to improve readability.
- Bentley’s CSV side does not always equal the best visual side.

---

## 18. Bentley Left and Right CSV Sections

The CSV has `Left` and `Right` sections.

However, these sections should not be treated as final drawing positions.

The CSV left/right structure is more like Bentley’s report view of splice relationships.

Many rows appear to be mirrored:

```txt
Left section:
Drop fiber 1 → 144 fiber 11

Right section:
144 fiber 11 → Drop fiber 1
```

These are likely the same physical splice shown from opposite directions.

Therefore:

```txt
CSV Left/Right = import/report hint
Canvas Left/Right = optimized visual placement
```

---

## 19. Deduplicating Mirrored CSV Rows

Because the CSV often shows mirrored rows, the parser should:

```txt
1. Parse both Left and Right sections.
2. Normalize both endpoints.
3. Compare endpoint pairs independent of direction.
4. Deduplicate mirrored pairs.
5. Create one internal SpliceConnection.
```

Example normalized splice:

```ts
type SpliceConnection = {
  id: string;
  endpointA: FiberEndpoint;
  endpointB: FiberEndpoint;
  circuitName?: string;
  sourceRows: SourceRowReference[];
};
```

Important warning:

Deduplication cannot rely only on:

```txt
same cable name + same fiber number
```

Because same cable names can represent different legs.

Deduplication should use resolved cable leg identity once possible.

---

## 20. Final Splice Detail Image Structure

The provided Bentley splice detail images have a consistent visual architecture:

```txt
LEFT CABLE GROUPS              CENTER SPLICE AREA              RIGHT CABLE GROUPS

Cable cylinder/node            Fusion splice dots              Cable cylinder/node
Buffer tubes                   Fiber lines                     Buffer tubes
Individual fibers              Center alignment                Individual fibers
```

The images show:

- Fiber cable objects, often drawn like cylinders.
- Buffer tubes coming out of the cable.
- Individual colored fiber strands coming out of the buffer tubes.
- Fiber strands routed toward the center.
- A center fusion splice dot when two strands are physically spliced.
- Lines continuing to the opposite side or looping as needed.
- Dashed gray lines for existing/protect-in-place connections.

The app should recreate a similar logic, not necessarily an exact Bentley visual clone.

---

## 21. Fusion Splice Dot

In the Bentley diagrams, the dot in the center represents a physical fusion splice.

Visual concept:

```txt
fiber strand ───────── ● ───────── fiber strand
```

Rules:

```txt
Solid/new splice = show center fusion splice dot
Existing/protected line = no fusion splice dot
```

The two fibers being spliced do not need to match colors.

Example valid splice:

```txt
Blue buffer / Rose fiber → Blue buffer / Blue fiber
```

The app must not enforce matching colors across a splice.

---

## 22. Dashed Gray Lines / Existing Protect-in-Place

The Bentley-style images sometimes show dashed or gray lines.

These represent existing fibers or connections that are present in the splice enclosure but are not part of the new work.

They are often understood as:

```txt
existing connection
protect in place
do not touch
```

Visual behavior:

```txt
Dashed gray line
No center fusion splice dot
Still shown for awareness
```

Important:

```txt
The Bentley CSV does not tell us whether a splice is new or existing/protect-in-place.
```

This must be user-defined in the app.

Suggested connection status:

```ts
type ConnectionStatus =
  | "new_splice"
  | "existing_protect_in_place"
  | "remove"
  | "unknown";
```

Rendering rules:

```ts
if status === "new_splice":
  lineStyle = "solid"
  showFusionDot = true

if status === "existing_protect_in_place":
  lineStyle = "dashed"
  showFusionDot = false
```

---

## 23. Why a Node Canvas Makes Sense

A node-based canvas is a good fit because the splice detail is made of connected objects:

```txt
Fiber cable node
→ Buffer tube group
→ Fiber strand handles
→ Connection lines
→ Splice nodes/dots
```

The advantage is that objects can be draggable and editable.

Example:

```txt
Drag a fiber cable node
→ its buffer tubes move with it
→ its fiber handles move with it
→ attached splice lines reroute automatically
```

This supports the desired workflow:

```txt
Auto-generate most of the layout
Allow manual correction only when needed
Export finished PDF
```

---

## 24. Hybrid Node + Structured Layout Model

The app should not make every small visual object a fully independent draggable node.

For example, a 288-count cable could have:

```txt
24 buffer tubes
288 fibers
many splice lines
```

If every fiber and buffer tube were a separate top-level node, the canvas would become chaotic.

Recommended model:

```txt
Cable = top-level draggable node
Buffer tubes = structured children inside cable node
Fibers = selectable rows/ports/handles inside buffer tube groups
Splice dots = center splice nodes or edge markers
```

This gives structure and editability.

---

## 25. Recommended Canvas Object Types

Possible node types:

```ts
type NodeType =
  | "cableNode"
  | "spliceNode"
  | "noteNode"
  | "labelNode";
```

Possible edge types:

```ts
type EdgeType =
  | "fiberSpliceEdge"
  | "protectedExistingEdge"
  | "bufferTubeBreakoutEdge";
```

For MVP, only these may be needed:

```txt
CableNode
SpliceConnection edge
Optional center splice dot marker
```

---

## 26. Cable Node Rendering

A cable node should visually contain buffer tube and fiber rows.

Example:

```txt
[ UDOT 144 SMF ]
   BL buffer tube
     fiber 11  RO  ─ handle
     fiber 12  AQ  ─ handle
   OR buffer tube
     fiber 13  BL  ─ handle
```

Each visible fiber has a connection handle.

Only fibers involved in the imported splice detail should be rendered at first.

Do not render all 144 or 288 fibers by default in MVP.

---

## 27. Canvas Rendering Hierarchy

The visual rendering should follow:

```txt
Cable node
└── Buffer tube visual group
    └── Fiber row / fiber port / fiber handle
        └── Fiber splice edge
            └── Center splice dot
                └── Fiber splice edge
                    └── Opposite fiber handle
```

This mirrors the physical structure:

```txt
Cable
→ Buffer tube
→ Fiber strand
→ Fusion splice
→ Fiber strand
→ Buffer tube
→ Cable
```

---

## 28. Canvas Left/Right Is an Optimization Decision

Bentley has an export menu that lets the user choose which fibers/cables are left or right. This can help the CSV look better, but it is not perfect.

For complex splice details, Bentley’s left/right export can become confusing or messy.

Therefore, the app should not blindly trust the CSV left/right layout.

Instead:

```txt
Bentley CSV side = initial placement hint
App canvas side = optimized visual layout
```

A cable that Bentley exported on the left may be moved to the right if that reduces crossovers and improves readability.

---

## 29. Layout Optimization Goal

The main visual goal is:

```txt
Maximize straight, readable left-to-right fiber paths.
Minimize crossovers.
Keep cable/buffer/fiber groups organized.
```

Crossovers are bad because they make the splice detail hard to follow.

Layout priorities:

```txt
1. Minimize fiber crossovers
2. Maximize straight left-to-right runs
3. Keep fibers grouped by cable → buffer tube → fiber number
4. Keep related splice dots vertically aligned
5. Preserve readable spacing
6. Respect Bentley left/right only when it does not hurt clarity
```

---

## 30. Layout Scoring Model

The app can generate multiple candidate layouts and choose the cleanest one.

Possible scoring:

```ts
const score =
  crossings * 1000 +
  bends * 100 +
  diagonalLength * 10 +
  sideChanges * 5 +
  verticalSpread * 1;
```

Lower score is better.

The app could test:

```txt
Original Bentley side layout
Mirrored side layout
High-count cables top
Small/drop cables bottom
Mainline left/right layout
Sorted by fiber number
Sorted by buffer tube
Sorted by connection group
```

Then it keeps the lowest-scoring layout.

---

## 31. Cable Placement Model

Imported side and final canvas side should be stored separately.

Example:

```ts
type CableLegPlacement = {
  cableLegId: string;

  importedSide?: "left" | "right";
  canvasSide: "left" | "right";

  importedOrder?: number;
  canvasOrder: number;

  locked?: boolean;
};
```

This allows the app to say:

```txt
Bentley placed this cable on the left,
but the optimized canvas placed it on the right.
```

---

## 32. User Overrides and Manual Editing

The app should generate the diagram automatically, but users must be able to fix edge cases.

Manual editing should include:

```txt
Move cable node left/right
Move cable node up/down
Reorder cable nodes
Reorder buffer tubes
Reorder visible fiber rows
Mark connection as new splice
Mark connection as existing/protect-in-place
Lock node position
Unlock node position
Re-run layout around locked nodes
Reset layout
```

The lock feature is important.

If a user manually fixes a cable position, the optimizer should not move it unless the user unlocks it.

---

## 33. Same-Side Connections

Not all connections are clean left-to-right relationships.

There may be multiple cables on the same side.

A connection may effectively go:

```txt
right cable → right cable
left cable → left cable
left cable → right cable
```

Traditionally, these are still brought toward the center so the splice relationship is clear.

The app should support routing through a center splice area even when both endpoints are on the same side.

---

## 34. Center Splice Spine

A useful layout concept is a vertical center spine.

```txt
Left cable nodes       Center splice spine       Right cable nodes
fiber rows  ─────────────── ● ─────────────── fiber rows
```

Each splice gets a center point/dot, ideally aligned vertically with the connected fibers when possible.

This helps keep the diagram organized and consistent.

---

## 35. Data Model Summary

A possible normalized data model:

```ts
type Project = {
  enclosure?: SpliceEnclosure;
  cableLegs: CableLeg[];
  spliceConnections: SpliceConnection[];
  placements: CableLegPlacement[];
};

type SpliceEnclosure = {
  id?: string;
  name?: string;
  location?: string;
};

type CableLeg = {
  id: string;
  cableName: string;
  displayName?: string;
  fiberCount?: number;
  fibersPerBufferTube: 6 | 12;
  legRole?: "mainline" | "drop" | "lateral" | "through" | "unknown";
  directionHint?: "east" | "west" | "north" | "south" | "unknown";
};

type FiberEndpoint = {
  id: string;
  cableLegId: string;
  fiberNumber?: number;
  fiberNumberSource: "csv" | "inferred" | "manual" | "missing";
  bufferTubeNumber?: number;
  bufferTubeColor?: string;
  bufferTubeStripe?: string;
  fiberColor?: string;
  circuitName?: string;
};

type SpliceConnection = {
  id: string;
  endpointA: FiberEndpoint;
  endpointB: FiberEndpoint;
  status: "new_splice" | "existing_protect_in_place" | "remove" | "unknown";
  circuitName?: string;
  sourceRows: SourceRowReference[];
};

type SourceRowReference = {
  sheetName?: string;
  section: "left" | "right" | "unknown";
  rowIndex: number;
};

type CableLegPlacement = {
  cableLegId: string;
  importedSide?: "left" | "right";
  canvasSide: "left" | "right";
  importedOrder?: number;
  canvasOrder: number;
  locked?: boolean;
};
```

---

## 36. Parser Pipeline

Suggested import pipeline:

```txt
1. Load CSV/XLSX.
2. Detect report metadata rows.
3. Find Left and Right sections.
4. Use positional schema to read columns.
5. Treat missing-header numeric column as fiber number.
6. Extract raw splice rows.
7. Normalize cable names, buffer colors, fiber colors, fiber numbers, devices, and OS values.
8. Detect possible mirrored rows.
9. Deduplicate mirrored splice pairs.
10. Detect duplicate cable names that may need separate cable legs.
11. Infer missing fiber numbers when possible.
12. Build cable leg objects.
13. Build fiber endpoint objects.
14. Build splice connection objects.
15. Generate initial optimized canvas placement.
```

---

## 37. MVP Scope Recommendation

The first development version should focus on:

```txt
Upload XLSX/CSV
Parse Bentley-style splice report
Recognize missing fiber number column
Extract splice rows
Normalize fiber endpoints
Preserve OS/circuit values
Create cable leg nodes
Render only fibers that appear in the splice data
Group fibers by cable and buffer tube
Draw splice connections through a center area
Show solid lines and splice dots
Allow cable nodes to be dragged
Allow basic PDF export
```

Do not try to solve everything at once.

MVP should not require:

```txt
Perfect Bentley clone
Full 288-fiber rendering
Advanced circuit labeling
Automated existing/protect-in-place detection
Perfect duplicate cable leg resolution
Full construction package styling
```

---

## 38. Future Features

Later versions should add:

```txt
Circuit name labels from OS column
Fiber inspector panel
Manual cable leg direction assignment
Existing/protect-in-place dashed lines
Connection status editing
Expressed-through fiber summaries
Advanced layout optimizer
Locked node layout reruns
Template-based PDF styling
Cable count detection from cable names
6-count vs 12-count buffer tube override
288-count striped buffer tube support
Conflict detection for fiber number vs color code
Manual splice editing
Add/remove connection rows
Export cleaned normalized CSV/JSON
```

---

## 39. Key Conceptual Separations

The app should keep these concepts separate:

```txt
Raw Bentley CSV side
Physical cable leg
Visual canvas side
Splice connection status
Circuit metadata
```

This is one of the most important architectural ideas.

Bentley tells us some information, but not everything needed for the cleanest final drawing.

The app should import Bentley’s data, preserve its source information, then generate an optimized visual model.

---

## 40. Most Important Rules to Remember

```txt
1. The CSV is a splice report, not a full cable inventory.
2. Missing fiber rows usually mean untouched/expressed fibers, not missing data.
3. The missing-header numeric column is the fiber number.
4. Fiber identity requires cable leg + buffer tube + fiber number/color.
5. Fiber colors repeat in every buffer tube.
6. Buffer colors repeat in high-count cables.
7. Cable name is not unique enough; use cable legs.
8. CSV left/right is only a hint, not final canvas placement.
9. The layout should optimize readability and minimize crossovers.
10. Solid lines with center dots represent physical fusion splices.
11. Dashed gray lines without center dots represent existing/protect-in-place connections.
12. The CSV does not indicate new vs existing/protect-in-place; the user must define that.
13. OS is the circuit name and should be preserved for later.
14. Device columns are lower priority but should not be discarded.
15. The canvas should be hierarchical, not hundreds of loose independent fiber nodes.
```

---

## 41. Working Mental Model

The app should be thought of as a **splice detail generator and editor**.

It converts messy Bentley report data into a clean model:

```txt
Cable legs
→ Buffer tubes
→ Fiber strands
→ Splice connections
→ Optimized canvas layout
→ Editable splice detail
→ PDF output
```

The app should be smart enough to place most items correctly, but flexible enough for manual adjustment when real-world fiber records or Bentley exports are messy.

The goal is not simply to draw lines from a CSV.

The goal is to understand the fiber hierarchy well enough to create a readable splice enclosure diagram that saves time compared with Bentley’s current workflow.
