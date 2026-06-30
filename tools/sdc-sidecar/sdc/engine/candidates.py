"""Topology-aware layout candidate generation."""

from __future__ import annotations

import random
from typing import Any

from sdc.engine.topology import (
    SIDES,
    apply_locks,
    constraints_from_topology,
    dominant_affinity_pairs,
    forbidden_pairs,
    searchable_cables,
    stack_order_from_sides,
    violates_forbidden,
)

DEFAULT_EXPANSION = {
    "centerGapPadding": 0,
    "cableGapExtra": 0,
    "tubeGroupGapExtra": 0,
}


def _normalize_candidate(
    cable_sides: dict[str, str],
    *,
    layout_width: float,
    constraints: dict[str, Any],
    cand_id: str,
) -> dict[str, Any] | None:
    sides = apply_locks(cable_sides, constraints)
    forbidden = forbidden_pairs(constraints)
    if violates_forbidden(sides, forbidden):
        return None
    return {
        "cableSides": sides,
        "stackOrder": stack_order_from_sides(sides),
        "layoutWidth": layout_width,
        "layoutExpansion": dict(DEFAULT_EXPANSION),
        "id": cand_id,
    }


def baseline_lr_candidate(
    cable_names: list[str],
    constraints: dict[str, Any],
    *,
    layout_width: float = 1200,
) -> dict[str, Any]:
    sides: dict[str, str] = {}
    for i, name in enumerate(sorted(cable_names)):
        sides[name] = "left" if i % 2 == 0 else "right"
    return _normalize_candidate(
        sides,
        layout_width=layout_width,
        constraints=constraints,
        cand_id="seed-baseline-lr",
    ) or {}


def dominant_pair_split(
    cable_names: list[str],
    topology: dict[str, Any],
    constraints: dict[str, Any],
    *,
    layout_width: float = 1200,
) -> dict[str, Any] | None:
    affinities = topology.get("affinities") or []
    pairs = dominant_affinity_pairs(affinities, top_n=1)
    sides: dict[str, str] = {name: "left" for name in cable_names}
    if pairs:
        a, b, _ = pairs[0]
        sides[a] = "left"
        sides[b] = "right"
        for name in cable_names:
            if name not in (a, b):
                sides[name] = "right" if sides.get(name) == "left" and name != a else sides.get(name, "left")
    return _normalize_candidate(
        sides,
        layout_width=layout_width,
        constraints=constraints,
        cand_id="seed-dominant-pair",
    )


def hub_satellite_split(
    cable_names: list[str],
    constraints: dict[str, Any],
    *,
    layout_width: float = 1200,
) -> dict[str, Any] | None:
    hubs = list(constraints.get("hubCables") or [])
    satellites = list(constraints.get("satelliteCables") or [])
    sides: dict[str, str] = {}
    for name in cable_names:
        if name in hubs:
            sides[name] = "left"
        elif name in satellites:
            sides[name] = "right"
        else:
            sides[name] = "left"
    return _normalize_candidate(
        sides,
        layout_width=layout_width,
        constraints=constraints,
        cand_id="seed-hub-satellite",
    )


def quad_relief_candidate(
    cable_names: list[str],
    constraints: dict[str, Any],
    *,
    layout_width: float = 1200,
) -> dict[str, Any] | None:
    if len(cable_names) < 3:
        return None
    sides: dict[str, str] = {}
    for i, name in enumerate(sorted(cable_names)):
        if i == 0:
            sides[name] = "top"
        elif i == len(cable_names) - 1:
            sides[name] = "bottom"
        else:
            sides[name] = "left" if i % 2 else "right"
    return _normalize_candidate(
        sides,
        layout_width=layout_width,
        constraints=constraints,
        cand_id="seed-quad-relief",
    )


def generate_seed_candidates(
    cable_names: list[str],
    topology: dict[str, Any],
    *,
    layout_widths: list[float] | None = None,
) -> list[dict[str, Any]]:
    constraints = constraints_from_topology(topology)
    width = (layout_widths or [1200])[0]
    seeds: list[dict[str, Any]] = []
    for fn, cid in (
        (lambda: baseline_lr_candidate(cable_names, constraints, layout_width=width), "seed-baseline"),
        (lambda: dominant_pair_split(cable_names, topology, constraints, layout_width=width), "seed-dominant"),
        (lambda: hub_satellite_split(cable_names, constraints, layout_width=width), "seed-hub"),
        (lambda: quad_relief_candidate(cable_names, constraints, layout_width=width), "seed-quad"),
    ):
        cand = fn()
        if cand:
            cand["id"] = cid
            seeds.append(cand)
    for w in (layout_widths or [1200])[1:]:
        base = baseline_lr_candidate(cable_names, constraints, layout_width=w)
        if base:
            base["id"] = f"seed-baseline-w{int(w)}"
            seeds.append(base)
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for cand in seeds:
        key = candidate_geometry_key(cand)
        if key in seen:
            continue
        seen.add(key)
        unique.append(cand)
    return unique


def candidate_geometry_key(candidate: dict[str, Any]) -> str:
    stack = candidate.get("stackOrder") or {}
    sides = candidate.get("cableSides") or {}
    exp = candidate.get("layoutExpansion") or DEFAULT_EXPANSION
    side_items = ",".join(f"{k}:{sides[k]}" for k in sorted(sides))
    return (
        f"T[{','.join(stack.get('top', []))}]"
        f"B[{','.join(stack.get('bottom', []))}]"
        f"L[{','.join(stack.get('left', []))}]"
        f"R[{','.join(stack.get('right', []))}]"
        f"S{{{side_items}}}"
        f"E{{{exp.get('centerGapPadding', 0)}|{exp.get('cableGapExtra', 0)}|{exp.get('tubeGroupGapExtra', 0)}}}"
    )


def mutate_candidate(
    candidate: dict[str, Any],
    constraints: dict[str, Any],
    rng: random.Random,
) -> dict[str, Any] | None:
    cable_sides = dict(candidate.get("cableSides") or {})
    searchable = searchable_cables(constraints, list(cable_sides.keys()))
    if not searchable:
        return None

    roll = rng.random()
    if roll < 0.4:
        name = rng.choice(searchable)
        cable_sides[name] = rng.choice(SIDES)
    elif roll < 0.65:
        side = rng.choice(SIDES)
        stack = dict(candidate.get("stackOrder") or stack_order_from_sides(cable_sides))
        cables = list(stack.get(side) or [])
        if len(cables) >= 2:
            i, j = rng.sample(range(len(cables)), 2)
            cables[i], cables[j] = cables[j], cables[i]
            stack[side] = cables
            out = dict(candidate)
            out["stackOrder"] = stack
            out["id"] = f"mut-stack-{rng.randint(0, 999999)}"
            return out
    elif roll < 0.85:
        layout_width = float(candidate.get("layoutWidth") or 1200)
        layout_width = max(800, layout_width + rng.choice([-67, 0, 67]))
        return _normalize_candidate(
            cable_sides,
            layout_width=layout_width,
            constraints=constraints,
            cand_id=f"mut-width-{rng.randint(0, 999999)}",
        )
    else:
        exp = dict(candidate.get("layoutExpansion") or DEFAULT_EXPANSION)
        key = rng.choice(list(exp.keys()))
        exp[key] = int(exp.get(key, 0)) + rng.choice([0, 24, 48])
        out = dict(candidate)
        out["layoutExpansion"] = exp
        out["id"] = f"mut-exp-{rng.randint(0, 999999)}"
        return _normalize_candidate(
            cable_sides,
            layout_width=float(candidate.get("layoutWidth") or 1200),
            constraints=constraints,
            cand_id=out["id"],
        )

    layout_width = float(candidate.get("layoutWidth") or 1200)
    return _normalize_candidate(
        cable_sides,
        layout_width=layout_width,
        constraints=constraints,
        cand_id=f"mut-{rng.randint(0, 999999)}",
    )


def random_candidate(
    cable_names: list[str],
    constraints: dict[str, Any],
    rng: random.Random,
    *,
    layout_width: float = 1200,
    allow_quad: bool = True,
) -> dict[str, Any] | None:
    sides_pool = list(SIDES) if allow_quad else ["left", "right"]
    cable_sides = {name: rng.choice(sides_pool) for name in cable_names}
    return _normalize_candidate(
        cable_sides,
        layout_width=layout_width,
        constraints=constraints,
        cand_id=f"rand-{rng.randint(0, 999999)}",
    )
