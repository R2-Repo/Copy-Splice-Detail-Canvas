"""Checkpoint save/resume for long deep-search runs."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class SearchCheckpoint:
    def __init__(self, directory: Path) -> None:
        self.directory = directory
        self.directory.mkdir(parents=True, exist_ok=True)

    @property
    def path(self) -> Path:
        return self.directory / "checkpoint.json"

    def save(self, state: dict[str, Any]) -> None:
        self.path.write_text(json.dumps(state, indent=2), encoding="utf-8")

    def load(self) -> dict[str, Any] | None:
        if not self.path.exists():
            return None
        return json.loads(self.path.read_text(encoding="utf-8"))

    def exists(self) -> bool:
        return self.path.exists()
