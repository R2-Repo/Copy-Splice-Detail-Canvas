import fs from "node:fs";

const path = "src/features/canvas/edges/spliceEdgeRouting.ts";
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);

const removeRanges = [
  [2662, 3075],
  [1153, 2500],
  [202, 254],
];

const remove = new Set();
for (const [a, b] of removeRanges) {
  for (let i = a; i <= b; i++) remove.add(i - 1);
}

const kept = lines.filter((_, i) => !remove.has(i));

const reexport = `
export {
  assignCenterLanes,
  assignSpliceMidXLanes,
  assignSpliceRoutingLanes,
  assignSpliceRoutingLanesFromHandleEntries,
  assignSpliceRoutingLanesFromLiveHandles,
  bundleMidOrderInverts,
  handleEntriesToCandidates,
  idealSpliceMidXFromRowOffset,
  normalizeVisualCableIdForRouting,
  packMidXLanes,
  recomputeRowOffsetsFromHandleYs,
  spliceRoutingZoneKey,
  spliceTubeBundleKey,
  type MidXLaneCandidate,
} from "@/features/diagram/spliceCenterLanes";
`;

// Insert after buildSpliceHandleEntries closing brace — find line with "export function sortSpliceRouteEntries"
const insertIdx = kept.findIndex((l) =>
  l.includes("export function sortSpliceRouteEntries"),
);
if (insertIdx < 0) throw new Error("insert point not found");

kept.splice(insertIdx, 0, reexport);

fs.writeFileSync(path, kept.join("\n"));
console.log("removed", remove.size, "lines; new length", kept.length);
