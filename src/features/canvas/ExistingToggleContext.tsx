import { createContext, useContext, type ReactNode } from "react";

import type { ExistingChargeTier } from "./useExistingLongPress";

export type ExistingToggleContextValue = {
  /** Begin a long-press on a leg/butt edge (toggles "existing" on release). */
  beginLongPress: (
    connectionId: string,
    clientX: number,
    clientY: number,
  ) => void;
  /** Whether a connection is currently "charging" (for live highlight). */
  isCharging: (connectionId: string) => boolean;
  chargingTier: ExistingChargeTier | null;
};

const ExistingToggleContext = createContext<ExistingToggleContextValue | null>(
  null,
);

export function ExistingToggleProvider({
  value,
  children,
}: {
  value: ExistingToggleContextValue;
  children: ReactNode;
}) {
  return (
    <ExistingToggleContext.Provider value={value}>
      {children}
    </ExistingToggleContext.Provider>
  );
}

/** Null-safe: edges render in tests without the provider. */
export function useOptionalExistingToggle(): ExistingToggleContextValue | null {
  return useContext(ExistingToggleContext);
}
