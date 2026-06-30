"""Parallel batch CSV runs via headless TS search."""

from __future__ import annotations

import json
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from sdc.node_bridge import csv_path_payload, eval_command, repo_root
from sdc.report import run_summary_from_search, write_html_report, write_json_report


def _search_one(args: tuple[str, dict[str, Any] | None, float | None]) -> dict[str, Any]:
    csv_str, config, timeout_s = args
    path = Path(csv_str)
    payload: dict[str, Any] = csv_path_payload(path)
    if config:
        payload["config"] = config
    try:
        response = eval_command("search", payload, timeout_s=timeout_s)
        summary = run_summary_from_search(path, response)
        return {"ok": True, "csv": str(path), "summary": summary, "response": response}
    except Exception as exc:
        return {"ok": False, "csv": str(path), "error": str(exc)}


def run_batch(
    csv_paths: list[Path],
    *,
    workers: int = 1,
    config: dict[str, Any] | None = None,
    timeout_s: float | None = None,
    out_dir: Path | None = None,
) -> list[dict[str, Any]]:
    paths = [p.resolve() for p in csv_paths]
    task_args = [(str(p), config, timeout_s) for p in paths]
    results: list[dict[str, Any]] = []

    if workers <= 1:
        for args in task_args:
            results.append(_search_one(args))
    else:
        with ProcessPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(_search_one, a): a[0] for a in task_args}
            for fut in as_completed(futures):
                results.append(fut.result())

    results.sort(key=lambda r: r.get("csv", ""))

    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
        summaries = []
        for item in results:
            stem = Path(item["csv"]).stem
            if item.get("ok"):
                write_json_report(out_dir / f"{stem}-run-summary.json", item["summary"])
                if "response" in item:
                    write_json_report(
                        out_dir / f"{stem}-search-response.json",
                        item["response"],
                    )
                summaries.append(
                    {
                        "csv": Path(item["csv"]).name,
                        "total": item["summary"].get("total"),
                        "feasible": item["summary"].get("feasible"),
                        "bestScore": item["summary"].get("bestScore"),
                        "evaluations": item["summary"].get("evaluations"),
                        "bestCandidateId": item["summary"].get("bestCandidateId"),
                    }
                )
            else:
                write_json_report(
                    out_dir / f"{stem}-error.json",
                    {"csv": item["csv"], "error": item.get("error")},
                )
                summaries.append(
                    {
                        "csv": Path(item["csv"]).name,
                        "total": "FAILED",
                        "feasible": False,
                        "bestScore": "—",
                        "evaluations": "—",
                        "bestCandidateId": item.get("error", "")[:80],
                    }
                )
        write_html_report(out_dir / "batch-report.html", summaries)
        write_json_report(out_dir / "batch-summary.json", {"results": summaries})

    return results


def print_batch_json(results: list[dict[str, Any]]) -> None:
    print(json.dumps({"results": results}, indent=2))
