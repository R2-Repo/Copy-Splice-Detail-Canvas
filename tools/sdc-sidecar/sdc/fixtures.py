"""Default CSV fixture lists for batch QA."""

from __future__ import annotations

from pathlib import Path

from sdc.node_bridge import repo_root


def preset_paths(name: str) -> list[Path]:
    root = repo_root()
    examples = root / "docs/reference/examples"
    legacy = examples / "old csv examples"

    if name == "qa":
        return [
            examples / "Left-SP-3254.5.csv",
            examples / "Left-STATE_OFFICE.csv",
            root / "public/qa-fixtures/example-2.csv",
        ]
    if name == "left":
        return [
            examples / "Left-STATE_OFFICE.csv",
            examples / "Left-SPI-215_I-80.csv",
            examples / "Left-SP-3254.5.csv",
        ]
    if name == "contract":
        candidates = [
            legacy / "CSV Splice Detail Example #1.csv",
            legacy / "CSV Splice Detail Example #2.csv",
            legacy / "CSV Splice Detail Example #3.csv",
            root / "public/qa-fixtures/example-1.csv",
            root / "public/qa-fixtures/example-2.csv",
            root / "public/qa-fixtures/example-3.csv",
        ]
        return [p for p in candidates if p.exists()]
    raise ValueError(f"Unknown preset: {name!r} (use qa, left, contract)")
