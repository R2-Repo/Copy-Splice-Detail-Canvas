"""Topology helpers for candidate generation."""

from __future__ import annotations

from typing import Any

SIDES = ("left", "right", "top", "bottom")
ADJACENT = {("left", "top"), ("top", "right"), ("right", "bottom"), ("bottom", "left")}


def constraints_from_topology(topology: dict[str, Any]) -> dict[str, Any]:
    return topology.get("constraints") or topology


def locked_sides(constraints: dict[str, Any]) -> dict[str, str]:
    return dict(constraints.get("lockedCableSides") or {})


def searchable_cables(constraints: dict[str, Any], cable_names: list[str]) -> list[str]:
    listed = constraints.get("searchableCables")
    if listed:
        return list(listed)
    locked = locked_sides(constraints)
    return [c for c in cable_names if c not in locked]


def forbidden_pairs(constraints: dict[str, Any]) -> set[tuple[str, str]]:
    out: set[tuple[str, str]] = set()
    for pair in constraints.get("forbiddenSameSidePairs") or []:
        a = pair.get("cableA", "")
        b = pair.get("cableB", "")
        if a and b:
            key = (a, b) if a < b else (b, a)
            out.add(key)
    return out


def violates_forbidden(candidate_sides: dict[str, str], forbidden: set[tuple[str, str]]) -> bool:
    for a, b in forbidden:
        if candidate_sides.get(a) == candidate_sides.get(b):
            sa = candidate_sides.get(a)
            sb = candidate_sides.get(b)
            if sa and sb and sa == sb:
                return True
    return False


def apply_locks(
    cable_sides: dict[str, str],
    constraints: dict[str, Any],
) -> dict[str, str]:
    out = dict(cable_sides)
    for cable, side in locked_sides(constraints).items():
        out[cable] = side
    return out


def stack_order_from_sides(cable_sides: dict[str, str]) -> dict[str, list[str]]:
    order: dict[str, list[str]] = {s: [] for s in SIDES}
    for cable, side in sorted(cable_sides.items()):
        if side in order:
            order[side].append(cable)
    return order


def dominant_affinity_pairs(affinities: list[dict[str, Any]], top_n: int = 3) -> list[tuple[str, str, float]]:
    ranked = sorted(
        affinities,
        key=lambda a: (-(a.get("connectionCount") or 0), a.get("cableA", ""), a.get("cableB", "")),
    )
    out: list[tuple[str, str, float]] = []
    for item in ranked[:top_n]:
        out.append(
            (
                item.get("cableA", ""),
                item.get("cableB", ""),
                float(item.get("connectionCount") or 0),
            ),
        )
    return out
