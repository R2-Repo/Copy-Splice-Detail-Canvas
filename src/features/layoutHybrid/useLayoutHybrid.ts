import { useCallback, useRef } from "react";
import type { Node } from "@xyflow/react";

import type { LayoutOverrides } from "@/types/splice";

import { onEditLock, clearAllHybridLocks, unlockHybridItem } from "./onEditLock";

export type UseLayoutHybridOptions = {
  overrides: LayoutOverrides | undefined;
  onOverridesChange: (next: LayoutOverrides) => void;
  reportKey: string;
};

/**
 * Always-on auto layout with lock-on-edit (SDC-UX-001).
 * Replaces the Auto/Manual toggle — manual edits become locked constraints.
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
      const cableId = node.id.replace(/^cable-/, "");
      const base = overridesRef.current ?? {
        reportKey: options.reportKey,
        positions: {},
      };
      const next = onEditLock(base, "cable", { cableId, position });
      options.onOverridesChange(next);
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
    (kind: "cable" | "tubeGroup" | "segment", key: string) => {
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
