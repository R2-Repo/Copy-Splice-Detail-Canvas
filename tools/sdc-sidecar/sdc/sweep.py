"""Hyperparameter sweep across configs and CSV fixtures."""

from __future__ import annotations

import itertools
import json
import random
from pathlib import Path
from typing import Any

from sdc.deep_search import deep_search
from sdc.fixtures import preset_paths
from sdc.report import write_html_report, write_json_report


def _grid_configs(
    *,
    t0_max: list[int] | None = None,
    t1_max: list[int] | None = None,
    t2_max: list[int] | None = None,
    population_size: list[int] | None = None,
    max_generations: list[int] | None = None,
) -> list[dict[str, Any]]:
    t0_max = t0_max or [200, 300]
    t1_max = t1_max or [30, 40]
    t2_max = t2_max or [6, 8]
    population_size = population_size or [64, 128]
    max_generations = max_generations or [5, 10]
    configs: list[dict[str, Any]] = []
    for t0, t1, t2, pop, gen in itertools.product(
        t0_max, t1_max, t2_max, population_size, max_generations,
    ):
        configs.append(
            {
                "t0_max": t0,
                "t1_max": t1,
                "t2_max": t2,
                "population_size": pop,
                "max_generations": gen,
            },
        )
    return configs


def run_sweep(
    csv_paths: list[Path],
    *,
    out_dir: Path,
    time_budget_ms: int = 30_000,
    seed: int = 42,
    max_configs: int | None = 8,
    use_ray: bool = True,
) -> list[dict[str, Any]]:
    out_dir.mkdir(parents=True, exist_ok=True)
    configs = _grid_configs()
    rng = random.Random(seed)
    if max_configs and len(configs) > max_configs:
        configs = rng.sample(configs, max_configs)

    results: list[dict[str, Any]] = []
    for csv_path in csv_paths:
        best_for_csv: dict[str, Any] | None = None
        for cfg in configs:
            run = deep_search(
                str(csv_path),
                strategy="evolutionary",
                time_budget_ms=time_budget_ms,
                seed=seed,
                use_ray=use_ray,
                **cfg,
            )
            entry = {
                "csv": csv_path.name,
                "config": cfg,
                "bestScore": run.get("bestScore"),
                "incumbentScore": (run.get("incumbent") or {}).get("bestScore"),
                "wallMs": run.get("wallMs"),
            }
            results.append(entry)
            if best_for_csv is None or (
                entry["bestScore"] is not None
                and (
                    best_for_csv.get("bestScore") is None
                    or entry["bestScore"] < best_for_csv["bestScore"]
                )
            ):
                best_for_csv = entry

        if best_for_csv:
            write_json_report(out_dir / f"{csv_path.stem}-best-config.json", best_for_csv)

    write_json_report(out_dir / "sweep-summary.json", {"results": results})

    html_rows = [
        {
            "csv": r["csv"],
            "bestScore": r.get("bestScore"),
            "incumbentScore": r.get("incumbentScore"),
            "config": json.dumps(r.get("config")),
            "wallMs": r.get("wallMs"),
        }
        for r in results
    ]
    write_html_report(out_dir / "sweep-report.html", html_rows)
    return results
