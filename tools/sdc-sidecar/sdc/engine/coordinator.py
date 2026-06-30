"""Search coordinator — tiered eval pipeline."""

from __future__ import annotations

import hashlib
import json
import random
import sys
import time
from typing import Any, Callable

from sdc.cache.checkpoint import SearchCheckpoint
from sdc.cache.score_cache import ScoreCache
from sdc.engine.candidates import candidate_geometry_key
from sdc.engine.ray_pool import evaluate_batch_parallel
from sdc.engine.session import SearchSession
from sdc.engine.strategies import SearchStrategy, run_incumbent_search, strategy_by_name
from sdc.engine.t0_mirror import fiber_pairs_from_affinities, mirror_prefilter
from sdc.engine.topology import constraints_from_topology
from sdc.node_bridge import eval_command

INFEASIBLE = 1.0e15


def _csv_hash(csv_path: str) -> str:
    return hashlib.sha256(csv_path.encode()).hexdigest()[:16]


def _emit_progress(payload: dict[str, Any], *, on_progress: Callable[[dict[str, Any]], None] | None) -> None:
    line = json.dumps(payload)
    print(line, file=sys.stderr)
    if on_progress:
        on_progress(payload)


class SearchCoordinator:
    def __init__(
        self,
        session: SearchSession,
        *,
        strategy: SearchStrategy | str = "evolutionary",
        t0_max: int = 300,
        t1_max: int = 40,
        t2_max: int = 8,
        population_size: int = 128,
        max_generations: int = 50,
        time_budget_ms: int | None = None,
        seed: int = 42,
        use_cache: bool = True,
        use_ray: bool = True,
        checkpoint_dir: str | None = None,
        resume: bool = False,
        on_progress: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        self.session = session
        self.strategy = strategy_by_name(strategy) if isinstance(strategy, str) else strategy
        self.t0_max = t0_max
        self.t1_max = t1_max
        self.t2_max = t2_max
        self.population_size = population_size
        self.max_generations = max_generations
        self.time_budget_ms = time_budget_ms
        self.rng = random.Random(seed)
        self.use_cache = use_cache
        self.use_ray = use_ray
        self.on_progress = on_progress
        self.cache = ScoreCache() if use_cache else None
        self.csv_hash = _csv_hash(session.csv_path)
        self.checkpoint = SearchCheckpoint(__import__("pathlib").Path(checkpoint_dir)) if checkpoint_dir else None
        self.resume = resume
        self.evaluations = 0
        self.best: dict[str, Any] | None = None
        self.best_score = INFEASIBLE
        self.generation = 0

    def _tier_eval_batch(
        self,
        candidates: list[dict[str, Any]],
        max_tier: str,
        limit: int,
    ) -> list[tuple[float, dict[str, Any], dict[str, Any]]]:
        constraints = constraints_from_topology(self.session.topology)
        fiber_pairs = fiber_pairs_from_affinities(self.session.affinities)

        mirrored = mirror_prefilter(candidates, constraints, fiber_pairs, top_n=None)
        if limit and len(mirrored) > limit * 3:
            mirrored = mirrored[: limit * 3]

        to_eval = [c for _, c in mirrored]
        if not to_eval:
            return []

        results = evaluate_batch_parallel(
            self.session.eval_payload(),
            to_eval,
            max_tier=max_tier,
            best_score=self.best_score,
            use_ray=self.use_ray,
        )

        scored: list[tuple[float, dict[str, Any], dict[str, Any]]] = []
        for item in results:
            cand_id = item.get("candidateId")
            tier_result = item.get("result") or {}
            score = float(tier_result.get("score") or INFEASIBLE)
            feasible = bool(tier_result.get("feasible"))
            cand = next((c for c in to_eval if c.get("id") == cand_id), None)
            if cand is None and to_eval:
                cand = to_eval[0]
            if cand is None:
                continue
            self.evaluations += 1
            if self.cache:
                gkey = candidate_geometry_key(cand)
                self.cache.put(
                    gkey,
                    self.csv_hash,
                    max_tier,
                    score=score,
                    feasible=feasible,
                    wall_ms=float(item.get("wallMs") or 0),
                )
            scored.append((score, cand, tier_result))
            if feasible and score < self.best_score:
                self.best_score = score
                self.best = {"candidate": cand, "evaluation": tier_result, "tier": max_tier}
        scored.sort(key=lambda t: t[0])
        return scored[:limit] if limit else scored

    def run(self) -> dict[str, Any]:
        start = time.monotonic()
        population: list[dict[str, Any]] = []

        if self.checkpoint and self.resume and self.checkpoint.exists():
            state = self.checkpoint.load() or {}
            self.generation = int(state.get("generation") or 0)
            self.best_score = float(state.get("bestScore") or INFEASIBLE)
            self.best = state.get("best")
            population = list(state.get("population") or [])
            if state.get("seed") is not None:
                self.rng = random.Random(int(state["seed"]))

        if not population:
            population = self.strategy.initial_population(
                self.session,
                self.rng,
                population_size=self.population_size,
            )

        while self.generation < self.max_generations:
            if self.time_budget_ms is not None:
                elapsed_ms = (time.monotonic() - start) * 1000
                if elapsed_ms >= self.time_budget_ms:
                    break

            t0_scored = self._tier_eval_batch(population, "T0", self.t0_max)
            t1_input = [c for _, c, ev in t0_scored if ev.get("feasible")]
            if not t1_input:
                t1_input = [c for _, c, _ in t0_scored]

            t1_scored = self._tier_eval_batch(t1_input, "T1", self.t1_max) if t1_input else []
            t2_input = [c for _, c, _ in t1_scored if _[2].get("feasible")] if t1_scored else []
            if not t2_input:
                t2_input = [c for _, c, _ in t1_scored]

            t2_scored = self._tier_eval_batch(t2_input, "T2", self.t2_max) if t2_input else []

            all_scored = t2_scored or t1_scored or t0_scored

            _emit_progress(
                {
                    "type": "progress",
                    "phase": "optimizing",
                    "generation": self.generation,
                    "evaluations": self.evaluations,
                    "bestScore": self.best_score if self.best_score < INFEASIBLE else None,
                    "feasible": self.best is not None and (self.best.get("evaluation") or {}).get("feasible"),
                    "elapsedMs": int((time.monotonic() - start) * 1000),
                },
                on_progress=self.on_progress,
            )

            if self.checkpoint:
                self.checkpoint.save(
                    {
                        "generation": self.generation,
                        "bestScore": self.best_score,
                        "best": self.best,
                        "population": population,
                        "seed": self.rng.randint(0, 2**31),
                    },
                )

            self.generation += 1
            if self.generation >= self.max_generations:
                break

            population = self.strategy.next_generation(
                self.session,
                population,
                all_scored,
                self.rng,
                population_size=self.population_size,
            )

        wall_ms = int((time.monotonic() - start) * 1000)
        return {
            "csvPath": self.session.csv_path,
            "strategy": self.strategy.__class__.__name__,
            "generations": self.generation,
            "evaluations": self.evaluations,
            "wallMs": wall_ms,
            "bestScore": self.best_score if self.best_score < INFEASIBLE else None,
            "best": self.best,
        }


def deep_search(
    csv_path: str,
    *,
    strategy: str = "evolutionary",
    search_config: dict[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    session = SearchSession.from_csv(csv_path)
    if strategy == "incumbent":
        resp = run_incumbent_search(session, search_config=search_config)
        result = resp.get("result") or {}
        return {
            "csvPath": csv_path,
            "strategy": "incumbent",
            "incumbent": result,
            "bestScore": result.get("bestScore"),
            "best": {"candidate": result.get("best"), "evaluation": result.get("winnerEvaluation")},
            "wallMs": result.get("wallMs"),
        }

    coord = SearchCoordinator(session, strategy=strategy, **kwargs)
    py_result = coord.run()

    incumbent_resp = run_incumbent_search(session, search_config=search_config)
    incumbent = incumbent_resp.get("result") or {}
    py_score = py_result.get("bestScore")
    inc_score = incumbent.get("bestScore")
    py_result["incumbent"] = {
        "bestScore": inc_score,
        "feasible": incumbent.get("feasible"),
        "wallMs": incumbent.get("wallMs"),
        "evaluations": incumbent.get("evaluations"),
    }
    if py_score is not None and inc_score is not None:
        py_result["comparison"] = {
            "pythonScore": py_score,
            "incumbentScore": inc_score,
            "pythonWins": py_score < inc_score,
            "scoreDelta": py_score - inc_score,
        }
    return py_result


def calibrate_t0_mirror(csv_path: str, *, sample_size: int = 64, seed: int = 42) -> dict[str, Any]:
    """Compare Python T0 mirror rejects vs TS T0 — expect zero false rejects."""
    from sdc.engine.candidates import random_candidate
    from sdc.engine.t0_mirror import mirror_t0_reject
    from sdc.engine.topology import constraints_from_topology

    session = SearchSession.from_csv(csv_path)
    constraints = constraints_from_topology(session.topology)
    rng = random.Random(seed)
    false_rejects = 0
    checked = 0
    for _ in range(sample_size):
        cand = random_candidate(session.cable_names, constraints, rng)
        if not cand:
            continue
        if mirror_t0_reject(cand, constraints):
            continue
        resp = eval_command(
            "evaluate-tier",
            session.eval_payload({"candidate": cand, "maxTier": "T0"}),
        )
        tier = resp.get("result") or {}
        ts_feasible = bool(tier.get("feasible"))
        checked += 1
        if not ts_feasible:
            false_rejects += 1
    return {
        "csvPath": csv_path,
        "checked": checked,
        "falseRejects": false_rejects,
        "ok": false_rejects == 0,
    }
