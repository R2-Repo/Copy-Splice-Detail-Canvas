import { visualCableIdFromNodeId } from "@/features/diagram/cableDisplaySide";
import type { CableNodeData } from "@/features/canvas/nodes/types";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import {
  ALL_LAYOUT_SIDES,
  type LayoutCandidate,
  type LayoutSide,
} from "@/features/layoutSearch/layoutCandidate";

import type { SdcRule, SdcRuleContext } from "./types";
import { fail, pass } from "./helpers";

/** Stack order must match per-cable side assignment. */
export function validateCandidateStackSides(
  candidate: LayoutCandidate,
): string[] {
  const failures: string[] = [];

  for (const [cable, side] of Object.entries(candidate.cableSides)) {
    if (!ALL_LAYOUT_SIDES.includes(side as LayoutSide)) {
      failures.push(`${cable}: invalid side ${side}`);
      continue;
    }
    if (!candidate.stackOrder[side as LayoutSide].includes(cable)) {
      failures.push(`${cable} on ${side} but missing from ${side} stack`);
    }
  }

  for (const side of ALL_LAYOUT_SIDES) {
    for (const cable of candidate.stackOrder[side]) {
      if (candidate.cableSides[cable] !== side) {
        failures.push(
          `${cable} listed on ${side} stack but cableSides is ${candidate.cableSides[cable] ?? "unset"}`,
        );
      }
    }
  }

  return failures;
}

/** Painted cable nodes must match optimizer candidate sides. */
export function validateRenderedSideAssignment(ctx: SdcRuleContext): string[] {
  const candidate = ctx.overrides?.optimizedLayoutCandidate;
  if (!candidate || !ctx.reactFlow) return [];

  const failures: string[] = [];
  for (const node of ctx.reactFlow.nodes) {
    if (node.type !== "cable") continue;
    const vcId = visualCableIdFromNodeId(node.id);
    if (!vcId) continue;
    const data = node.data as CableNodeData;
    const renderedSide = data.quadSide ?? data.side;
    const vc = ctx.visualCables?.find((v) => v.id === vcId);
    if (!vc) continue;
    const key = cableNameKey(vc.cable);
    const expected = candidate.cableSides[key];
    if (expected && renderedSide !== expected) {
      failures.push(
        `${vc.cable}: rendered ${renderedSide}, candidate expects ${expected}`,
      );
    }
  }
  return failures;
}

/** SDC-LAYOUT-003 — Side assignment and cable placement. */
export const sdcLayout003: SdcRule = {
  id: "SDC-LAYOUT-003",
  title: "Side assignment and cable placement",
  dependencies: ["SDC-CORE-001"],
  requires: ["graph"],
  tiers: ["candidate-screen", "proxy-route", "final-layout"],
  check(ctx) {
    const candidate = ctx.overrides?.optimizedLayoutCandidate;
    if (!candidate) {
      return [pass("SDC-LAYOUT-003", "No optimizer candidate in context")];
    }

    const stackFailures = validateCandidateStackSides(candidate);
    const renderFailures = validateRenderedSideAssignment(ctx);
    const failures = [...stackFailures, ...renderFailures];

    if (failures.length) {
      return [
        fail(
          "SDC-LAYOUT-003",
          failures.slice(0, 6).join("; "),
          failures,
        ),
      ];
    }
    return [pass("SDC-LAYOUT-003")];
  },
};
