import { createContext, useContext, type ReactNode } from "react";

import type { TubeManualOverride, TubeOverrideKey } from "@/types/splice";

export type ManualLayoutGuideLine = {
  id: string;
  orientation: "horizontal" | "vertical";
  value: number;
};

export type ManualLayoutContextValue = {
  manualAdjustEnabled: boolean;
  alignedStemX?: number;
  onFiberAnchorClick?: (
    connectionId: string,
    event: { shiftKey: boolean },
  ) => void;
  snapTipTargets: number[];
  onTubeOverrideCommit: (
    tubeKey: TubeOverrideKey,
    patch: TubeManualOverride,
  ) => void;
  activeGuides: ManualLayoutGuideLine[];
  setActiveGuides: (guides: ManualLayoutGuideLine[]) => void;
};

const ManualLayoutContext = createContext<ManualLayoutContextValue | null>(
  null,
);

export function ManualLayoutProvider({
  value,
  children,
}: {
  value: ManualLayoutContextValue;
  children: ReactNode;
}) {
  return (
    <ManualLayoutContext.Provider value={value}>
      {children}
    </ManualLayoutContext.Provider>
  );
}

export function useManualLayout(): ManualLayoutContextValue | null {
  return useContext(ManualLayoutContext);
}
