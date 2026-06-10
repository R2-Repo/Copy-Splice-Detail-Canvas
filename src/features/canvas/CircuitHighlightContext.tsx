import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CircuitIndex } from "@/features/canvas/circuitIndex";
import { connectionMatchesHighlight } from "@/features/canvas/circuitIndex";

type CircuitHighlightContextValue = {
  highlightedCircuit: string | null;
  highlightedConnectionIds: ReadonlySet<string>;
  setHighlightedCircuit: (name: string | null) => void;
  toggleHighlightedCircuit: (name: string) => void;
  clearHighlight: () => void;
  isConnectionHighlighted: (connectionId: string) => boolean;
  isFiberHighlighted: (
    connectionId: string,
    spliceConnectionIds?: string[],
  ) => boolean;
  isEdgeHighlighted: (edgeId: string, pairIds?: string[]) => boolean;
};

const CircuitHighlightContext = createContext<CircuitHighlightContextValue | null>(
  null,
);

export function CircuitHighlightProvider({
  circuitIndex,
  children,
}: {
  circuitIndex: CircuitIndex | null;
  children: ReactNode;
}) {
  const [highlightedCircuit, setHighlightedCircuitState] = useState<
    string | null
  >(null);

  const highlightedConnectionIds = useMemo(() => {
    if (!highlightedCircuit || !circuitIndex) return new Set<string>();
    return new Set(circuitIndex.byName.get(highlightedCircuit) ?? []);
  }, [highlightedCircuit, circuitIndex]);

  const setHighlightedCircuit = useCallback((name: string | null) => {
    setHighlightedCircuitState(name);
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedCircuitState(null);
  }, []);

  const toggleHighlightedCircuit = useCallback((name: string) => {
    setHighlightedCircuitState((current) => (current === name ? null : name));
  }, []);

  const isConnectionHighlighted = useCallback(
    (connectionId: string) => highlightedConnectionIds.has(connectionId),
    [highlightedConnectionIds],
  );

  const isFiberHighlighted = useCallback(
    (connectionId: string, spliceConnectionIds?: string[]) =>
      connectionMatchesHighlight(
        connectionId,
        spliceConnectionIds,
        highlightedConnectionIds,
      ),
    [highlightedConnectionIds],
  );

  const isEdgeHighlighted = useCallback(
    (edgeId: string, pairIds?: string[]) => {
      if (highlightedConnectionIds.size === 0) return false;
      if (edgeId.startsWith("splice-left-")) {
        return highlightedConnectionIds.has(edgeId.slice("splice-left-".length));
      }
      if (edgeId.startsWith("splice-right-")) {
        return highlightedConnectionIds.has(edgeId.slice("splice-right-".length));
      }
      if (edgeId.startsWith("splice-")) {
        return highlightedConnectionIds.has(edgeId.slice("splice-".length));
      }
      if (edgeId.startsWith("butt-") && pairIds?.length) {
        return pairIds.some((id) => highlightedConnectionIds.has(id));
      }
      return false;
    },
    [highlightedConnectionIds],
  );

  const value = useMemo(
    (): CircuitHighlightContextValue => ({
      highlightedCircuit,
      highlightedConnectionIds,
      setHighlightedCircuit,
      toggleHighlightedCircuit,
      clearHighlight,
      isConnectionHighlighted,
      isFiberHighlighted,
      isEdgeHighlighted,
    }),
    [
      highlightedCircuit,
      highlightedConnectionIds,
      setHighlightedCircuit,
      toggleHighlightedCircuit,
      clearHighlight,
      isConnectionHighlighted,
      isFiberHighlighted,
      isEdgeHighlighted,
    ],
  );

  return (
    <CircuitHighlightContext.Provider value={value}>
      {children}
    </CircuitHighlightContext.Provider>
  );
}

export function useCircuitHighlight(): CircuitHighlightContextValue {
  const ctx = useContext(CircuitHighlightContext);
  if (!ctx) {
    throw new Error(
      "useCircuitHighlight must be used within CircuitHighlightProvider",
    );
  }
  return ctx;
}

/** Safe for optional highlight wiring outside provider (returns no-op). */
export function useOptionalCircuitHighlight(): CircuitHighlightContextValue | null {
  return useContext(CircuitHighlightContext);
}
