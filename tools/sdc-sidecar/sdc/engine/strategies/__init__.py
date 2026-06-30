"""Search strategy implementations."""

from __future__ import annotations

import random
from abc import ABC, abstractmethod
from typing import Any, Callable

from sdc.engine.candidates import (
    generate_seed_candidates,
    mutate_candidate,
    random_candidate,
)
from sdc.engine.session import SearchSession
from sdc.engine.topology import constraints_from_topology
from sdc.node_bridge import eval_command


class SearchStrategy(ABC):
    @abstractmethod
    def initial_population(
        self,
        session: SearchSession,
        rng: random.Random,
        *,
        population_size: int,
    ) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    def next_generation(
        self,
        session: SearchSession,
        population: list[dict[str, Any]],
        scored: list[tuple[float, dict[str, Any], dict[str, Any]]],
        rng: random.Random,
        *,
        population_size: int,
    ) -> list[dict[str, Any]]:
        ...


class EvolutionaryStrategy(SearchStrategy):
    def initial_population(
        self,
        session: SearchSession,
        rng: random.Random,
        *,
        population_size: int,
    ) -> list[dict[str, Any]]:
        constraints = constraints_from_topology(session.topology)
        seeds = generate_seed_candidates(
            session.cable_names,
            session.topology,
            layout_widths=session.layout_widths,
        )
        pop = list(seeds)
        width = session.layout_widths[0] if session.layout_widths else 1200
        while len(pop) < population_size:
            if pop and rng.random() < 0.6:
                parent = rng.choice(pop)
                child = mutate_candidate(parent, constraints, rng)
                if child:
                    pop.append(child)
            else:
                cand = random_candidate(
                    session.cable_names,
                    constraints,
                    rng,
                    layout_width=width,
                )
                if cand:
                    pop.append(cand)
        return pop[:population_size]

    def next_generation(
        self,
        session: SearchSession,
        population: list[dict[str, Any]],
        scored: list[tuple[float, dict[str, Any], dict[str, Any]]],
        rng: random.Random,
        *,
        population_size: int,
    ) -> list[dict[str, Any]]:
        constraints = constraints_from_topology(session.topology)
        scored.sort(key=lambda t: t[0])
        elite_count = max(2, population_size // 5)
        next_pop = [t[1] for t in scored[:elite_count]]
        while len(next_pop) < population_size:
            if scored and rng.random() < 0.7:
                _, parent, _ = rng.choice(scored[: max(elite_count * 2, 1)])
                child = mutate_candidate(parent, constraints, rng)
                if child:
                    next_pop.append(child)
            else:
                cand = random_candidate(
                    session.cable_names,
                    constraints,
                    rng,
                    layout_width=session.layout_widths[0] if session.layout_widths else 1200,
                )
                if cand:
                    next_pop.append(cand)
        return next_pop[:population_size]


class PythonBeamStrategy(SearchStrategy):
    def __init__(self, beam_width: int = 10) -> None:
        self.beam_width = beam_width

    def initial_population(
        self,
        session: SearchSession,
        rng: random.Random,
        *,
        population_size: int,
    ) -> list[dict[str, Any]]:
        constraints = constraints_from_topology(session.topology)
        seeds = generate_seed_candidates(
            session.cable_names,
            session.topology,
            layout_widths=session.layout_widths,
        )
        pop = list(seeds)
        while len(pop) < min(population_size, self.beam_width * 4):
            cand = random_candidate(
                session.cable_names,
                constraints,
                rng,
                layout_width=session.layout_widths[0] if session.layout_widths else 1200,
            )
            if cand:
                pop.append(cand)
        return pop[:population_size]

    def next_generation(
        self,
        session: SearchSession,
        population: list[dict[str, Any]],
        scored: list[tuple[float, dict[str, Any], dict[str, Any]]],
        rng: random.Random,
        *,
        population_size: int,
    ) -> list[dict[str, Any]]:
        constraints = constraints_from_topology(session.topology)
        scored.sort(key=lambda t: t[0])
        beam = [t[1] for t in scored[: self.beam_width]]
        next_pop = list(beam)
        for parent in beam:
            for _ in range(2):
                child = mutate_candidate(parent, constraints, rng)
                if child:
                    next_pop.append(child)
        return next_pop[:population_size]


class HybridStrategy(SearchStrategy):
    """Python seeds + mutations; TS search handles refinement separately."""

    def __init__(self) -> None:
        self._evo = EvolutionaryStrategy()

    def initial_population(
        self,
        session: SearchSession,
        rng: random.Random,
        *,
        population_size: int,
    ) -> list[dict[str, Any]]:
        return self._evo.initial_population(session, rng, population_size=population_size)

    def next_generation(
        self,
        session: SearchSession,
        population: list[dict[str, Any]],
        scored: list[tuple[float, dict[str, Any], dict[str, Any]]],
        rng: random.Random,
        *,
        population_size: int,
    ) -> list[dict[str, Any]]:
        return self._evo.next_generation(
            session, population, scored, rng, population_size=population_size,
        )


def run_incumbent_search(
    session: SearchSession,
    *,
    search_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = session.eval_payload()
    if search_config:
        payload["config"] = search_config
    return eval_command("search", payload)


def strategy_by_name(name: str) -> SearchStrategy:
    if name == "evolutionary":
        return EvolutionaryStrategy()
    if name == "python_beam":
        return PythonBeamStrategy()
    if name == "hybrid":
        return HybridStrategy()
    if name == "incumbent":
        raise ValueError("incumbent strategy uses run_incumbent_search directly")
    raise ValueError(f"Unknown strategy: {name}")
