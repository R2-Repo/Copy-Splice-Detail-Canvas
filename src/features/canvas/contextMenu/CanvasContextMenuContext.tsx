import { createContext, useContext } from "react";

/** What the user right-clicked on the canvas. */
export type ContextMenuTarget =
  | { kind: "cable"; visualCableId: string }
  | { kind: "tubeGroup"; visualCableId: string; tubeColor: string }
  | { kind: "fusionDot"; connectionId: string };

export type CanvasContextMenuValue = {
  /** Open the canvas context menu for `target` at the given screen position. */
  openMenu: (target: ContextMenuTarget, clientX: number, clientY: number) => void;
};

const noop: CanvasContextMenuValue = { openMenu: () => {} };

const CanvasContextMenuContext = createContext<CanvasContextMenuValue>(noop);

export function CanvasContextMenuProvider({
  value,
  children,
}: {
  value: CanvasContextMenuValue;
  children: React.ReactNode;
}) {
  return (
    <CanvasContextMenuContext.Provider value={value}>
      {children}
    </CanvasContextMenuContext.Provider>
  );
}

export function useCanvasContextMenu(): CanvasContextMenuValue {
  return useContext(CanvasContextMenuContext);
}
