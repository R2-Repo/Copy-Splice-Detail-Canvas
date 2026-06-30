"""Search session — parsed graph + topology cached for one CSV run."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sdc.node_bridge import csv_path_payload, eval_command


@dataclass
class SearchSession:
    csv_path: str
    csv_payload: dict[str, str]
    summary: dict[str, Any]
    session_key: str
    topology: dict[str, Any]
    constraints: dict[str, Any]
    cable_names: list[str]
    layout_widths: list[float]
    affinities: list[dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_csv(cls, csv_path: str) -> SearchSession:
        payload = csv_path_payload(csv_path)
        parsed = eval_command("parse", payload)
        topo = eval_command("analyze-topology", payload)
        analysis = topo.get("analysis") or {}
        constraints = analysis.get("constraints") or {}
        return cls(
            csv_path=csv_path,
            csv_payload=payload,
            summary=parsed.get("summary") or {},
            session_key=topo.get("sessionKey") or "",
            topology=analysis,
            constraints=constraints,
            cable_names=list((parsed.get("summary") or {}).get("cableNames") or []),
            layout_widths=list(topo.get("layoutWidths") or [1200]),
            affinities=list(analysis.get("affinities") or []),
        )

    def eval_payload(self, extra: dict[str, Any] | None = None) -> dict[str, Any]:
        out = dict(self.csv_payload)
        if self.session_key:
            out["sessionKey"] = self.session_key
        if extra:
            out.update(extra)
        return out
