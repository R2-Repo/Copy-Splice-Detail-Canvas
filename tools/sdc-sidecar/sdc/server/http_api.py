"""Localhost HTTP API for PWA deep-search stub."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable
from urllib.parse import urlparse

from sdc.daemon.pool import get_pool
from sdc.deep_search import deep_search
from sdc.daemon.protocol import DEFAULT_SERVE_PORT

_active_search: dict[str, threading.Event] = {}


class _Handler(BaseHTTPRequestHandler):
    server_version = "SDCSidecar/0.2"

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "http://localhost:5173")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/health":
            pool = get_pool(auto_start=False)
            status = pool.status() if pool else {"workers": 0, "alive": 0}
            self._json(200, {"ok": True, "daemons": status, "ray": True})
            return
        self._json(404, {"ok": False, "error": "Not found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "Invalid JSON"})
            return

        if path == "/cancel":
            req_id = body.get("id", "default")
            ev = _active_search.get(req_id)
            if ev:
                ev.set()
            self._json(200, {"ok": True, "cancelled": req_id})
            return

        if path == "/deep-search":
            csv_path = body.get("csvPath")
            if not csv_path:
                self._json(400, {"ok": False, "error": "csvPath required"})
                return
            config = body.get("config") or {}
            req_id = body.get("id", "default")
            cancel = threading.Event()
            _active_search[req_id] = cancel

            def on_progress(p: dict[str, Any]) -> None:
                pass

            try:
                result = deep_search(
                    csv_path,
                    strategy=config.get("strategy", "evolutionary"),
                    time_budget_ms=config.get("timeBudgetMs"),
                    max_generations=config.get("maxGenerations", 20),
                    population_size=config.get("populationSize", 64),
                    t0_max=config.get("t0Max", 300),
                    t1_max=config.get("t1Max", 40),
                    t2_max=config.get("t2Max", 8),
                    seed=config.get("seed", 42),
                    on_progress=on_progress,
                )
                self._json(
                    200,
                    {
                        "type": "done",
                        "id": req_id,
                        "ok": True,
                        "result": result,
                    },
                )
            except Exception as exc:
                self._json(500, {"type": "error", "id": req_id, "ok": False, "message": str(exc)})
            finally:
                _active_search.pop(req_id, None)
            return

        self._json(404, {"ok": False, "error": "Not found"})


def serve(port: int = DEFAULT_SERVE_PORT) -> None:
    get_pool(auto_start=True)
    server = ThreadingHTTPServer(("127.0.0.1", port), _Handler)
    print(json.dumps({"ok": True, "servePort": port, "url": f"http://127.0.0.1:{port}"}))
    server.serve_forever()
