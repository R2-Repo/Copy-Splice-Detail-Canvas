"""Experimental layout search — Python generates candidates, TypeScript scores."""

from __future__ import annotations

import random
from typing import Any

from sdc.experimental.proxy import proxy_t0_reject, proxy_t1_score
from sdc.node_bridge import csv_path_payload, eval_command


SIDES = ("left", "right", "top", "bottom")


def _stack_order(cable_sides: dict[str, str]) -> dict[str, list[str]]:
    order: dict[str, list[str]] = {s: [] for s in SIDES}
    for cable, side in sorted(cable_sides.items()):
        if side in order:
            order[side].append(cable)
    return order


def random_candidate(
    cable_names: list[str],
    *,
    layout_width: float = 1200,
    rng: random.Random,
    allow_quad: bool = True,
) -> dict[str, Any]:
    sides = list(SIDES) if allow_quad else ["left", "right"]
    cable_sides = {name: rng.choice(sides) for name in cable_names}
    return {
        "cableSides": cable_sides,
        "stackOrder": _stack_order(cable_sides),
        "layoutWidth": layout_width,
        "layoutExpansion": {
            "centerGapPadding": 0,
            "cableGapExtra": 0,
            "tubeGroupGapExtra": 0,
        },
        "id": f"py-exp-{rng.randint(0, 1_000_000)}",
    }


def mutate_candidate(candidate: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    cable_sides = dict(candidate["cableSides"])
    name = rng.choice(list(cable_sides.keys()))
    cable_sides[name] = rng.choice(SIDES)
    out = dict(candidate)
    out["cableSides"] = cable_sides
    out["stackOrder"] = _stack_order(cable_sides)
    out["id"] = f"py-mut-{rng.randint(0, 1_000_000)}"
    return out


def experimental_search(
    csv_path: str,
    *,
    iterations: int = 64,
    validate_top: int = 5,
    seed: int = 42,
    layout_width: float = 1200,
    use_proxy: bool = True,
    search_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Generate random/mutated candidates; optionally proxy-filter; TS-evaluate top-K."""
    rng = random.Random(seed)
    parse_payload = csv_path_payload(csv_path)
    parsed = eval_command("parse", parse_payload)
    cable_names: list[str] = parsed["summary"]["cableNames"]

    scored_proxies: list[tuple[float, dict[str, Any]]] = []
    generated: list[dict[str, Any]] = []

    for i in range(iterations):
        cand = random_candidate(cable_names, layout_width=layout_width, rng=rng)
        if i > 0 and rng.random() < 0.5:
            cand = mutate_candidate(rng.choice(generated), rng)
        generated.append(cand)

        if use_proxy:
            if proxy_t0_reject(cand):
                continue
            proxy_score = proxy_t1_score(cand)
            scored_proxies.append((proxy_score, cand))
        else:
            scored_proxies.append((0.0, cand))

    scored_proxies.sort(key=lambda t: t[0])
    top = [c for _, c in scored_proxies[: max(validate_top, 1)]]

    evaluations: list[dict[str, Any]] = []
    for cand in top:
        payload = {**parse_payload, "candidate": cand}
        ev = eval_command("evaluate", payload)
        evaluations.append({"candidate": cand, "evaluation": ev.get("evaluation"), "wallMs": ev.get("wallMs")})

    evaluations.sort(key=lambda e: (e["evaluation"] or {}).get("score", float("inf")))

    incumbent_payload = {**parse_payload}
    if search_config:
        incumbent_payload["config"] = search_config
    incumbent = eval_command("search", incumbent_payload)

    return {
        "csvPath": csv_path,
        "iterations": iterations,
        "validateTop": validate_top,
        "useProxy": use_proxy,
        "experimentalBest": evaluations[0] if evaluations else None,
        "experimentalTop": evaluations,
        "incumbent": {
            "bestScore": (incumbent.get("result") or {}).get("bestScore"),
            "feasible": (incumbent.get("result") or {}).get("feasible"),
            "evaluations": (incumbent.get("result") or {}).get("evaluations"),
            "wallMs": (incumbent.get("result") or {}).get("wallMs"),
            "best": (incumbent.get("result") or {}).get("best"),
        },
    }


def compare_search(
    csv_path: str,
    *,
    iterations: int = 64,
    validate_top: int = 5,
    seed: int = 42,
    search_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Run experimental search vs incumbent TS layoutSearch."""
    result = experimental_search(
        csv_path,
        iterations=iterations,
        validate_top=validate_top,
        seed=seed,
        use_proxy=True,
        search_config=search_config,
    )
    exp_score = None
    if result["experimentalBest"]:
        exp_score = (result["experimentalBest"].get("evaluation") or {}).get("score")
    inc_score = result["incumbent"].get("bestScore")
    result["comparison"] = {
        "experimentalScore": exp_score,
        "incumbentScore": inc_score,
        "experimentalWins": exp_score is not None and inc_score is not None and exp_score < inc_score,
        "scoreDelta": (exp_score - inc_score) if exp_score is not None and inc_score is not None else None,
    }
    return result
