"""HTTP client for a single TS sdc-eval daemon."""

from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from typing import Any

from sdc.daemon.protocol import DEFAULT_DAEMON_PORT, DaemonRequest
from sdc.node_bridge import NodeBridgeError, repo_root


class DaemonClient:
    """Talk to one long-lived TS eval daemon over HTTP."""

    def __init__(self, port: int = DEFAULT_DAEMON_PORT, *, proc: subprocess.Popen[str] | None = None) -> None:
        self.port = port
        self.base_url = f"http://127.0.0.1:{port}"
        self._proc = proc
        self._request_count = 0

    @property
    def alive(self) -> bool:
        if self._proc is not None and self._proc.poll() is not None:
            return False
        try:
            self.ping()
            return True
        except (NodeBridgeError, OSError, urllib.error.URLError):
            return False

    def ping(self) -> dict[str, Any]:
        return self.call("ping", {})

    def call(self, command: str, payload: dict[str, Any], *, timeout_s: float = 600) -> dict[str, Any]:
        req_id = str(uuid.uuid4())
        body = json.dumps({"id": req_id, "command": command, "payload": payload}).encode("utf-8")
        request = urllib.request.Request(
            self.base_url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout_s) as resp:
                raw = resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8") if exc.fp else str(exc)
            raise NodeBridgeError(raw) from exc
        except urllib.error.URLError as exc:
            raise NodeBridgeError(f"Daemon on port {self.port} unreachable: {exc}") from exc

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise NodeBridgeError(f"Invalid JSON from daemon: {raw[:500]}") from exc

        if not parsed.get("ok"):
            raise NodeBridgeError(parsed.get("error") or raw)
        self._request_count += 1
        return parsed

    def shutdown(self) -> None:
        try:
            self.call("shutdown", {}, timeout_s=5)
        except NodeBridgeError:
            pass
        if self._proc is not None:
            try:
                self._proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._proc.kill()

    @classmethod
    def spawn(cls, port: int = DEFAULT_DAEMON_PORT, *, wait_s: float = 15) -> DaemonClient:
        root = repo_root()
        tsx_name = "tsx.cmd" if sys.platform == "win32" else "tsx"
        tsx = root / "node_modules" / ".bin" / tsx_name
        if not tsx.exists():
            raise NodeBridgeError(f"tsx not found at {tsx}. Run npm install in {root} first.")

        env = dict(**{k: v for k, v in __import__("os").environ.items()})
        env["SDC_DAEMON_PORT"] = str(port)
        env["SDC_DAEMON_HTTP"] = "1"
        env["SDC_REPO_ROOT"] = str(root)

        proc = subprocess.Popen(
            [
                str(tsx),
                "--tsconfig",
                "tools/sdc-eval/tsconfig.json",
                "tools/sdc-eval/daemon.ts",
            ],
            cwd=str(root),
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )

        client = cls(port, proc=proc)
        deadline = time.monotonic() + wait_s
        last_err: Exception | None = None
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                err = proc.stderr.read() if proc.stderr else ""
                raise NodeBridgeError(f"Daemon exited early on port {port}: {err}")
            try:
                client.ping()
                return client
            except (NodeBridgeError, OSError, urllib.error.URLError) as exc:
                last_err = exc
                time.sleep(0.2)
        client.shutdown()
        raise NodeBridgeError(f"Daemon failed to start on port {port}: {last_err}")
