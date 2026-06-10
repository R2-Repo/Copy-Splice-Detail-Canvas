import { useMemo, useState } from "react";

import type { CircuitIndex } from "@/features/canvas/circuitIndex";
import { pairCountForCircuit } from "@/features/canvas/circuitIndex";
import { useCircuitHighlight } from "@/features/canvas/CircuitHighlightContext";

type CircuitListPanelProps = {
  circuitIndex: CircuitIndex | null;
};

export function CircuitListPanel({ circuitIndex }: CircuitListPanelProps) {
  const { highlightedCircuit, toggleHighlightedCircuit, clearHighlight } =
    useCircuitHighlight();
  const [filter, setFilter] = useState("");

  const filteredNames = useMemo(() => {
    if (!circuitIndex) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return circuitIndex.names;
    return circuitIndex.names.filter((name) => name.toLowerCase().includes(q));
  }, [circuitIndex, filter]);

  if (!circuitIndex || circuitIndex.names.length === 0) {
    return (
      <aside className="diagram-inspector circuit-panel">
        <h3>OS circuits</h3>
        <p className="diagram-inspector__empty circuit-panel__empty">
          No circuit names in this diagram.
        </p>
      </aside>
    );
  }

  return (
    <aside className="diagram-inspector circuit-panel">
      <div className="circuit-panel__header">
        <h3>OS circuits</h3>
        {highlightedCircuit ? (
          <button
            type="button"
            className="circuit-panel__clear"
            onClick={clearHighlight}
          >
            Clear
          </button>
        ) : null}
      </div>
      <p className="circuit-panel__hint">
        Click a circuit to flash matching strands and splice paths. Expand full
        butt splices to see per-fiber detail.
      </p>
      <input
        type="search"
        className="circuit-panel__search"
        placeholder="Filter circuits…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Filter circuit list"
      />
      <ul className="circuit-panel__list" role="listbox" aria-label="OS circuits">
        {filteredNames.map((name) => {
          const pairCount = pairCountForCircuit(circuitIndex, name);
          const active = highlightedCircuit === name;
          return (
            <li key={name}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                className={`circuit-panel__item${active ? " circuit-panel__item--active" : ""}`}
                onClick={() => toggleHighlightedCircuit(name)}
              >
                <span className="circuit-panel__name">{name}</span>
                <span className="circuit-panel__count">
                  {pairCount} pair{pairCount === 1 ? "" : "s"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {filteredNames.length === 0 ? (
        <p className="diagram-inspector__empty">No matches for &ldquo;{filter}&rdquo;</p>
      ) : null}
    </aside>
  );
}
