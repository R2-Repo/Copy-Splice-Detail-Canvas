"""SQLite score cache for candidate evaluations."""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path
from typing import Any

from sdc.node_bridge import repo_root


class ScoreCache:
    def __init__(self, db_path: Path | None = None) -> None:
        if db_path is None:
            db_path = repo_root() / "tools" / "sdc-sidecar" / ".sdc-cache" / "score-cache.sqlite"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db_path = db_path
        self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scores (
              geometry_key TEXT NOT NULL,
              csv_hash TEXT NOT NULL,
              tier TEXT NOT NULL,
              score REAL,
              feasible INTEGER,
              wall_ms REAL,
              updated_at REAL,
              PRIMARY KEY (geometry_key, csv_hash, tier)
            )
            """,
        )
        self._conn.commit()

    def get(self, geometry_key: str, csv_hash: str, tier: str) -> dict[str, Any] | None:
        row = self._conn.execute(
            "SELECT score, feasible, wall_ms FROM scores WHERE geometry_key=? AND csv_hash=? AND tier=?",
            (geometry_key, csv_hash, tier),
        ).fetchone()
        if not row:
            return None
        return {"score": row[0], "feasible": bool(row[1]), "wallMs": row[2]}

    def put(
        self,
        geometry_key: str,
        csv_hash: str,
        tier: str,
        *,
        score: float,
        feasible: bool,
        wall_ms: float,
    ) -> None:
        self._conn.execute(
            """
            INSERT INTO scores (geometry_key, csv_hash, tier, score, feasible, wall_ms, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(geometry_key, csv_hash, tier) DO UPDATE SET
              score=excluded.score,
              feasible=excluded.feasible,
              wall_ms=excluded.wall_ms,
              updated_at=excluded.updated_at
            """,
            (geometry_key, csv_hash, tier, score, int(feasible), wall_ms, time.time()),
        )
        self._conn.commit()

    def stats(self) -> dict[str, Any]:
        count = self._conn.execute("SELECT COUNT(*) FROM scores").fetchone()[0]
        return {"entries": count, "path": str(self.db_path)}

    def clear(self, csv_hash: str | None = None) -> int:
        if csv_hash:
            cur = self._conn.execute("DELETE FROM scores WHERE csv_hash=?", (csv_hash,))
        else:
            cur = self._conn.execute("DELETE FROM scores")
        self._conn.commit()
        return cur.rowcount

    def close(self) -> None:
        self._conn.close()
