"""Fast T0 mirror — prefilter only; TS evaluate-tier T0 is authoritative."""

from __future__ import annotations

from typing import Any

import numpy as np

from sdc.engine.candidates import candidate_geometry_key
from sdc.engine.topology import (
    SIDES,
    forbidden_pairs,
    locked_sides,
    violates_forbidden,
)

INFEASIBLE = 1.0e15
WEIGHTS = {
    "crossings": 1000,
    "sameSideLoopbacks": 500,
    "sidesUsed": 50,
    "heightImbalance": 10,
    "adjacent": 25,
}


def mirror_t0_reject(candidate: dict[str, Any], constraints: dict[str, Any]) -> bool:
    cable_sides: dict[str, str] = candidate.get("cableSides") or {}
    if not cable_sides:
        return True

    for cable, side in locked_sides(constraints).items():
        if cable_sides.get(cable) != side:
            return True

    if violates_forbidden(cable_sides, forbidden_pairs(constraints)):
        return True

    stack: dict[str, list[str]] = candidate.get("stackOrder") or {}
    for side, cables in stack.items():
        seen: set[str] = set()
        for c in cables:
            if c in seen:
                return True
            seen.add(c)
            if cable_sides.get(c) != side:
                return True
    return False


def _side_index(side: str) -> int:
    return SIDES.index(side) if side in SIDES else 0


def _side_pair_kind(a: str, b: str) -> str:
    if a == b:
        return "same"
    ia, ib = _side_index(a), _side_index(b)
    if (ia + 1) % 4 == ib or (ib + 1) % 4 == ia:
        return "adjacent"
    return "opposite"


def mirror_t0_score(
    candidate: dict[str, Any],
    fiber_pairs: list[tuple[str, str]] | None = None,
) -> float:
    cable_sides: dict[str, str] = candidate.get("cableSides") or {}
    score = 0.0

    used = len({s for s in cable_sides.values() if s})
    score += used * WEIGHTS["sidesUsed"]

    left = sum(1 for s in cable_sides.values() if s == "left")
    right = sum(1 for s in cable_sides.values() if s == "right")
    score += abs(left - right) * 10.0

    top = sum(1 for s in cable_sides.values() if s in ("top", "bottom"))
    score += top * 15.0

    score += max(0, float(candidate.get("layoutWidth") or 1200) - 1200) * 0.5

    if fiber_pairs:
        for a, b in fiber_pairs:
            sa = cable_sides.get(a, "left")
            sb = cable_sides.get(b, "right")
            kind = _side_pair_kind(sa, sb)
            if kind == "same":
                score += WEIGHTS["sameSideLoopbacks"]
            elif kind == "adjacent":
                score += WEIGHTS["adjacent"]

    stack = candidate.get("stackOrder") or {}
    heights = [len(stack.get(s) or []) for s in SIDES if stack.get(s)]
    if len(heights) > 1:
        score += (max(heights) - min(heights)) * WEIGHTS["heightImbalance"]

    return score


def mirror_prefilter(
    candidates: list[dict[str, Any]],
    constraints: dict[str, Any],
    fiber_pairs: list[tuple[str, str]] | None = None,
    *,
    top_n: int | None = None,
) -> list[tuple[float, dict[str, Any]]]:
    scored: list[tuple[float, dict[str, Any]]] = []
    for cand in candidates:
        if mirror_t0_reject(cand, constraints):
            continue
        scored.append((mirror_t0_score(cand, fiber_pairs), cand))
    scored.sort(key=lambda t: t[0])
    if top_n is not None:
        return scored[:top_n]
    return scored


def fiber_pairs_from_affinities(affinities: list[dict[str, Any]]) -> list[tuple[str, str]]:
    return [(a.get("cableA", ""), a.get("cableB", "")) for a in affinities if a.get("cableA") and a.get("cableB")]


def batch_mirror_scores(candidates: list[dict[str, Any]], constraints: dict[str, Any]) -> np.ndarray:
    return np.array([mirror_t0_score(c, None) for c in candidates if not mirror_t0_reject(c, constraints)])
