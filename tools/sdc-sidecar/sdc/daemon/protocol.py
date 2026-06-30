"""NDJSON / HTTP protocol types for the TS eval daemon."""

from __future__ import annotations

from typing import Any, TypedDict


class DaemonRequest(TypedDict, total=False):
    id: str
    command: str
    payload: dict[str, Any]


class DaemonResponse(TypedDict, total=False):
    id: str
    ok: bool
    error: str
    command: str
    sessionKey: str


DEFAULT_DAEMON_PORT = 18765
DEFAULT_SERVE_PORT = 18780
