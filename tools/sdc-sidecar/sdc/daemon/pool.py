"""Pool of TS eval daemons with round-robin dispatch."""

from __future__ import annotations

import os
import threading
from typing import Any

from sdc.daemon.client import DaemonClient
from sdc.daemon.protocol import DEFAULT_DAEMON_PORT
from sdc.node_bridge import NodeBridgeError

_pool: "DaemonPool | None" = None
_pool_lock = threading.Lock()


class DaemonPool:
    def __init__(self, clients: list[DaemonClient]) -> None:
        self._clients = clients
        self._lock = threading.Lock()
        self._index = 0

    @property
    def size(self) -> int:
        return len(self._clients)

    @property
    def ports(self) -> list[int]:
        return [c.port for c in self._clients]

    def _next_client(self) -> DaemonClient:
        with self._lock:
            n = len(self._clients)
            for _ in range(n):
                client = self._clients[self._index % n]
                self._index += 1
                if client.alive:
                    return client
            raise NodeBridgeError("All daemons in pool are dead")

    def call(self, command: str, payload: dict[str, Any], *, timeout_s: float = 600) -> dict[str, Any]:
        client = self._next_client()
        try:
            return client.call(command, payload, timeout_s=timeout_s)
        except NodeBridgeError:
            if client.alive:
                raise
            replacement = DaemonClient.spawn(client.port)
            client.shutdown()
            with self._lock:
                for i, c in enumerate(self._clients):
                    if c.port == client.port:
                        self._clients[i] = replacement
                        break
            return replacement.call(command, payload, timeout_s=timeout_s)

    def ping_all(self) -> list[dict[str, Any]]:
        return [c.ping() for c in self._clients if c.alive]

    def shutdown(self) -> None:
        for client in self._clients:
            client.shutdown()
        self._clients.clear()

    @classmethod
    def start(cls, workers: int | None = None, base_port: int = DEFAULT_DAEMON_PORT) -> DaemonPool:
        count = workers if workers is not None else max(1, (os.cpu_count() or 2))
        clients: list[DaemonClient] = []
        for i in range(count):
            port = base_port + i
            clients.append(DaemonClient.spawn(port))
        return cls(clients)

    def status(self) -> dict[str, Any]:
        alive = sum(1 for c in self._clients if c.alive)
        return {
            "workers": self.size,
            "alive": alive,
            "ports": self.ports,
        }


def get_pool(*, workers: int | None = None, auto_start: bool = True) -> DaemonPool | None:
    global _pool
    with _pool_lock:
        if _pool is not None and _pool.size > 0 and any(c.alive for c in _pool._clients):
            return _pool
        if not auto_start:
            return None
        _pool = DaemonPool.start(workers=workers)
        return _pool


def shutdown_pool() -> None:
    global _pool
    with _pool_lock:
        if _pool is not None:
            _pool.shutdown()
            _pool = None
