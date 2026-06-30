"""Lightweight T0/T1-style proxies for fast candidate rejection (experimental only)."""

from __future__ import annotations

from typing import Any

# Penalties tuned for ordering only — not authoritative; TS evaluate is always final.


def sides_used(candidate: dict[str, Any]) -> int:
    sides = set(candidate.get("cableSides", {}).values())
    return len(sides)


def proxy_t0_reject(candidate: dict[str, Any]) -> bool:
    """Reject obviously bloated placements (extra sides without need)."""
    cable_sides: dict[str, str] = candidate.get("cableSides", {})
    if not cable_sides:
        return True
    used = sides_used(candidate)
    if used >= 4 and len(cable_sides) <= 2:
        return True
    stack: dict[str, list[str]] = candidate.get("stackOrder", {})
    for side, cables in stack.items():
        seen = set()
        for c in cables:
            if c in seen:
                return True
            seen.add(c)
            if cable_sides.get(c) != side:
                return True
    return False


def proxy_t1_score(candidate: dict[str, Any]) -> float:
    """Lower is better — mirrors soft-score priorities at coarse granularity."""
    cable_sides: dict[str, str] = candidate.get("cableSides", {})
    score = 0.0
    score += sides_used(candidate) * 50.0
    score += max(0, candidate.get("layoutWidth", 1200) - 1200) * 0.5
    left = sum(1 for s in cable_sides.values() if s == "left")
    right = sum(1 for s in cable_sides.values() if s == "right")
    score += abs(left - right) * 10.0
    top = sum(1 for s in cable_sides.values() if s in ("top", "bottom"))
    score += top * 25.0
    return score
