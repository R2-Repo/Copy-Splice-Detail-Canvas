"""Deprecated experimental search — delegates to deep_search."""

from __future__ import annotations

import warnings
from typing import Any

from sdc.deep_search import deep_search


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
    warnings.warn("experimental_search is deprecated — use deep_search", DeprecationWarning, stacklevel=2)
    return deep_search(
        csv_path,
        strategy="evolutionary",
        search_config=search_config,
        seed=seed,
        population_size=max(iterations, validate_top * 4),
        max_generations=3,
        time_budget_ms=60_000,
    )


def compare_search(
    csv_path: str,
    *,
    iterations: int = 64,
    validate_top: int = 5,
    seed: int = 42,
    search_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    warnings.warn("compare_search is deprecated — use deep_search", DeprecationWarning, stacklevel=2)
    return deep_search(
        csv_path,
        strategy="evolutionary",
        search_config=search_config,
        seed=seed,
        population_size=max(iterations, validate_top * 4),
        max_generations=3,
        time_budget_ms=60_000,
    )
