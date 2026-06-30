"""Parallel evaluation with optional Ray; falls back to sequential batches."""

from __future__ import annotations

import logging
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Any, Callable

logger = logging.getLogger(__name__)

_ray_initialized = False


def _ensure_ray() -> bool:
    global _ray_initialized
    try:
        import ray

        if not _ray_initialized:
            ray.init(ignore_reinit_error=True, logging_level=logging.WARNING)
            _ray_initialized = True
        return True
    except Exception as exc:
        logger.warning("Ray unavailable (%s) — using sequential batch eval", exc)
        return False


def evaluate_batch_parallel(
    session_payload: dict[str, Any],
    candidates: list[dict[str, Any]],
    *,
    max_tier: str = "T0",
    best_score: float = 1e15,
    use_ray: bool = True,
    chunk_size: int = 32,
) -> list[dict[str, Any]]:
    """Evaluate candidates in chunks via TS evaluate-batch."""
    from sdc.node_bridge import eval_command

    if not candidates:
        return []

    results: list[dict[str, Any]] = []
    chunks = [candidates[i : i + chunk_size] for i in range(0, len(candidates), chunk_size)]

    if use_ray and _ensure_ray() and len(chunks) > 1:
        import ray

        @ray.remote
        def _eval_chunk(payload: dict[str, Any]) -> list[dict[str, Any]]:
            from sdc.node_bridge import eval_command as ec

            resp = ec("evaluate-batch", payload, use_daemon=True)
            return list(resp.get("results") or [])

        futures = []
        for chunk in chunks:
            payload = {
                **session_payload,
                "candidates": chunk,
                "maxTier": max_tier,
                "bestScore": best_score,
            }
            futures.append(_eval_chunk.remote(payload))
        for part in ray.get(futures):
            results.extend(part)
        return results

    for chunk in chunks:
        payload = {
            **session_payload,
            "candidates": chunk,
            "maxTier": max_tier,
            "bestScore": best_score,
        }
        resp = eval_command("evaluate-batch", payload)
        for item in resp.get("results") or []:
            results.append(item)
            tier_result = item.get("result") or {}
            if tier_result.get("feasible") and tier_result.get("score", 1e15) < best_score:
                best_score = tier_result["score"]
    return results


def map_parallel(
    fn: Callable[[Any], Any],
    items: list[Any],
    *,
    use_ray: bool = True,
) -> list[Any]:
    if use_ray and _ensure_ray() and len(items) > 1:
        import ray

        @ray.remote
        def _remote(x: Any) -> Any:
            return fn(x)

        return ray.get([_remote.remote(x) for x in items])

    if len(items) > 1:
        with ProcessPoolExecutor(max_workers=min(4, len(items))) as pool:
            return list(pool.map(fn, items))
    return [fn(x) for x in items]
