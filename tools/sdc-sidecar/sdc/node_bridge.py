"""Spawn the TypeScript sdc-eval CLI and parse JSON responses."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any


class NodeBridgeError(RuntimeError):
    pass


def repo_root() -> Path:
    env = os.environ.get("SDC_REPO_ROOT")
    if env:
        return Path(env).resolve()
    start = Path(__file__).resolve().parents[1]
    for candidate in [start, *start.parents]:
        if (candidate / "package.json").is_file() and (candidate / "src").is_dir():
            return candidate
    return Path(__file__).resolve().parents[3]


def eval_command(command: str, payload: dict[str, Any], *, timeout_s: float | None = None) -> dict[str, Any]:
    """Run tools/sdc-eval/cli.ts with JSON on stdin."""
    root = repo_root()
    tsx_name = "tsx.cmd" if sys.platform == "win32" else "tsx"
    tsx = root / "node_modules" / ".bin" / tsx_name
    if not tsx.exists():
        raise NodeBridgeError(
            f"tsx not found at {tsx}. Run npm install in {root} first.",
        )
    proc = subprocess.run(
        [
            str(tsx),
            "--tsconfig",
            "tools/sdc-eval/tsconfig.json",
            "tools/sdc-eval/cli.ts",
            command,
        ],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        cwd=str(root),
        timeout=timeout_s,
        check=False,
        shell=False,
    )
    if proc.returncode != 0:
        err = proc.stderr.strip() or proc.stdout.strip() or f"exit {proc.returncode}"
        raise NodeBridgeError(err)
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise NodeBridgeError(f"Invalid JSON from sdc:eval: {exc}\n{proc.stdout[:500]}") from exc


def csv_path_payload(csv_path: str | Path) -> dict[str, str]:
    path = Path(csv_path)
    if not path.is_absolute():
        path = (Path.cwd() / path).resolve()
    else:
        path = path.resolve()
    if not path.exists():
        raise FileNotFoundError(path)
    root = repo_root()
    try:
        rel = path.relative_to(root)
    except ValueError:
        rel = path
    return {"csvPath": str(rel).replace("\\", "/")}
