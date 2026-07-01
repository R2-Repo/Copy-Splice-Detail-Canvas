import { useCallback, useRef } from "react";
import type { Node } from "@xyflow/react";

import type { LayoutOverrides } from "@/types/splice";

import { clearAllHybridLocks, unlockHybridItem } from "./onEditLock";

export type UseLayoutHybridOptions = {
  overrides: LayoutOverrides | undefined;
  onOverridesChange: (next: LayoutOverrides) => void;
  reportKey: string;
};

/**
 * Always-on auto layout (SDC-UX-001).
 * Tube, leg, and fusion-dot edits lock in place; cable drags save position only.
 */
export function useLayoutHybrid(options: UseLayoutHybridOptions) {
  const overridesRef = useRef(options.overrides);
  overridesRef.current = options.overrides;

  const persistOverrides = useCallback(
    (patch: Partial<LayoutOverrides>) => {
      const base = overridesRef.current ?? {
        reportKey: options.reportKey,
        positions: {},
      };
      options.onOverridesChange({ ...base, ...patch });
    },
    [options],
  );

  const onCableDragStop = useCallback(
    (node: Node, position: { x: number; y: number }) => {
      const base = overridesRef.current ?? {
        reportKey: options.reportKey,
        positions: {},
      };
      options.onOverridesChange({
        ...base,
        positions: { ...base.positions, [node.id]: position },
      });
    },
    [options],
  );

  const onUnlockAll = useCallback(() => {
    const base = overridesRef.current ?? {
      reportKey: options.reportKey,
      positions: {},
    };
    options.onOverridesChange(clearAllHybridLocks(base));
  }, [options]);

  const onUnlockItem = useCallback(
    (kind: "tubeGroup" | "segment" | "fusionDot", key: string) => {
      const base = overridesRef.current ?? {
        reportKey: options.reportKey,
        positions: {},
      };
      options.onOverridesChange(unlockHybridItem(base, kind, key));
    },
    [options],
  );

  return {
    /** Auto layout is always active in hybrid mode. */
    autoLayoutAlwaysOn: true,
    onCableDragStop,
    onUnlockAll,
    onUnlockItem,
    persistOverrides,
  };
}
