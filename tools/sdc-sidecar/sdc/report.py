"""HTML + JSON batch reports aligned with import-diagnostics run summaries."""

from __future__ import annotations

import html
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def format_ms(ms: float | int | None) -> str:
    if ms is None:
        return "—"
    ms = float(ms)
    if ms < 1000:
        return f"{round(ms)} ms"
    s = ms / 1000
    if s < 60:
        return f"{s:.1f} s"
    m = int(s // 60)
    return f"{m}m {s % 60:.1f}s"


def run_summary_from_search(
    csv_path: Path,
    response: dict[str, Any],
    *,
    source: str = "sdc-sidecar-headless",
) -> dict[str, Any]:
    result = response.get("result") or {}
    summary = response.get("summary") or {}
    diagnostics = result.get("diagnostics") or {}
    winner_eval = result.get("winnerEvaluation") or {}
    return {
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "csv": csv_path.name,
        "csvPath": str(csv_path),
        "heuristic": None,
        "total": format_ms(result.get("wallMs")),
        "nodes": None,
        "edges": None,
        "banner": None,
        "screenshot": None,
        "diagnosticsTotalMs": result.get("wallMs"),
        "summary": summary,
        "searchStats": {
            "evaluatedT0": diagnostics.get("evaluatedT0"),
            "evaluatedT1": diagnostics.get("evaluatedT1"),
            "evaluatedT2": diagnostics.get("evaluatedT2"),
            "rejectedByRule": diagnostics.get("rejectedByRule"),
        },
        "ruleRejectCounts": winner_eval.get("ruleRejectCounts")
        or result.get("ruleRejectCounts"),
        "bestScore": result.get("bestScore"),
        "feasible": result.get("feasible"),
        "evaluations": result.get("evaluations"),
        "bestCandidateId": (result.get("best") or {}).get("id"),
        "finalistSummaries": result.get("finalists"),
    }


def write_json_report(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_html_report(path: Path, rows: list[dict[str, Any]], title: str = "SDC batch report") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    headers = ["csv", "total", "feasible", "bestScore", "evaluations", "bestCandidateId"]
    tr_head = "".join(f"<th>{html.escape(h)}</th>" for h in headers)
    body_rows = []
    for row in rows:
        cells = []
        for h in headers:
            val = row.get(h, "—")
            cells.append(f"<td>{html.escape(str(val))}</td>")
        body_rows.append(f"<tr>{''.join(cells)}</tr>")
    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>{html.escape(title)}</title>
  <style>
    body {{ font-family: system-ui, sans-serif; margin: 1.5rem; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; }}
    th {{ background: #f4f4f4; }}
  </style>
</head>
<body>
  <h1>{html.escape(title)}</h1>
  <p>Generated {html.escape(datetime.now(timezone.utc).isoformat())}</p>
  <table>
    <thead><tr>{tr_head}</tr></thead>
    <tbody>
      {''.join(body_rows)}
    </tbody>
  </table>
</body>
</html>
"""
    path.write_text(doc, encoding="utf-8")
