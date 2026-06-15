import type { Edge } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  isConnectionExisting,
  setConnectionsExisting,
} from "@/features/canvas/edges/existingToggle";
import { bundleConnectionIds } from "@/features/manualAdjust/smartSelect";

/** Hold this long to toggle the pressed splice "existing" (single). */
const SINGLE_MS = 450;
/** Keep holding this long to escalate to the whole tube bundle. */
const GROUP_MS = 1100;
/** Pointer travel that turns the press into a drag (cancels the long-press). */
const MOVE_TOLERANCE = 6;

export type ExistingChargeTier = "single" | "group";

type PressState = {
  connectionId: string;
  startX: number;
  startY: number;
  startTime: number;
};

export type ExistingLongPress = {
  /** Begin a long-press on a leg/butt (called from edge + overlay pointerdown). */
  beginLongPress: (
    connectionId: string,
    clientX: number,
    clientY: number,
  ) => void;
  /** Connections currently "charging" (for live highlight feedback). */
  chargingConnectionIds: ReadonlySet<string>;
  chargingTier: ExistingChargeTier | null;
};

const EMPTY: ReadonlySet<string> = new Set();

export function useExistingLongPress({
  enabled,
  getEdges,
  setEdges,
  persist,
}: {
  enabled: boolean;
  getEdges: () => Edge[];
  setEdges: (next: Edge[]) => void;
  persist: (edges: Edge[]) => void;
}): ExistingLongPress {
  const [charge, setCharge] = useState<{
    connectionIds: Set<string>;
    tier: ExistingChargeTier;
  } | null>(null);
  const pressRef = useRef<PressState | null>(null);
  const timersRef = useRef<number[]>([]);
  const moveRef = useRef<(e: PointerEvent) => void>(() => {});
  const upRef = useRef<(e: PointerEvent) => void>(() => {});
  // Stable wrappers so add/removeEventListener always match the SAME function
  // even though the inner logic (moveRef/upRef) is reassigned each render.
  const moveListener = useRef((e: PointerEvent) => moveRef.current(e));
  const upListener = useRef((e: PointerEvent) => upRef.current(e));

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  const detach = useCallback(() => {
    window.removeEventListener("pointermove", moveListener.current);
    window.removeEventListener("pointerup", upListener.current);
    window.removeEventListener("pointercancel", upListener.current);
  }, []);

  const cancel = useCallback(() => {
    clearTimers();
    detach();
    pressRef.current = null;
    setCharge(null);
  }, [clearTimers, detach]);

  const applyTier = useCallback(
    (connectionId: string, tier: ExistingChargeTier) => {
      const edges = getEdges();
      if (tier === "group") {
        const bundle = bundleConnectionIds(edges, connectionId);
        const allExisting = bundle.every((id) =>
          isConnectionExisting(edges, id),
        );
        const next = setConnectionsExisting(edges, bundle, !allExisting);
        if (next === edges) return;
        setEdges(next);
        persist(next);
        return;
      }
      const value = !isConnectionExisting(edges, connectionId);
      const next = setConnectionsExisting(edges, [connectionId], value);
      if (next === edges) return;
      setEdges(next);
      persist(next);
    },
    [getEdges, persist, setEdges],
  );

  moveRef.current = (event: PointerEvent) => {
    const press = pressRef.current;
    if (!press) return;
    const dist = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (dist > MOVE_TOLERANCE) cancel();
  };

  upRef.current = () => {
    const press = pressRef.current;
    clearTimers();
    detach();
    pressRef.current = null;
    setCharge(null);
    if (!press) return;
    const elapsed = Date.now() - press.startTime;
    if (elapsed >= GROUP_MS) applyTier(press.connectionId, "group");
    else if (elapsed >= SINGLE_MS) applyTier(press.connectionId, "single");
  };

  const beginLongPress = useCallback(
    (connectionId: string, clientX: number, clientY: number) => {
      if (!enabled) return;
      // Restart cleanly if a press was somehow still active.
      clearTimers();
      detach();
      pressRef.current = {
        connectionId,
        startX: clientX,
        startY: clientY,
        startTime: Date.now(),
      };
      setCharge(null);
      timersRef.current.push(
        window.setTimeout(() => {
          setCharge({ connectionIds: new Set([connectionId]), tier: "single" });
        }, SINGLE_MS),
        window.setTimeout(() => {
          const bundle = bundleConnectionIds(getEdges(), connectionId);
          setCharge({ connectionIds: new Set(bundle), tier: "group" });
        }, GROUP_MS),
      );
      window.addEventListener("pointermove", moveListener.current);
      window.addEventListener("pointerup", upListener.current);
      window.addEventListener("pointercancel", upListener.current);
    },
    [clearTimers, detach, enabled, getEdges],
  );

  useEffect(() => cancel, [cancel]);

  return {
    beginLongPress,
    chargingConnectionIds: charge?.connectionIds ?? EMPTY,
    chargingTier: charge?.tier ?? null,
  };
}
