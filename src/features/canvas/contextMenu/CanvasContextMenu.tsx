import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type ContextMenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
};

export type CanvasContextMenuState = {
  x: number;
  y: number;
  items: ContextMenuItem[];
};

type Props = {
  state: CanvasContextMenuState | null;
  onClose: () => void;
};

/** Floating right-click menu. Closes on outside click, Escape, scroll, or resize. */
export function CanvasContextMenu({ state, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: state?.x ?? 0, y: state?.y ?? 0 });

  useLayoutEffect(() => {
    if (!state) return;
    const el = ref.current;
    if (!el) return;
    // Keep the menu inside the viewport.
    const { offsetWidth: w, offsetHeight: h } = el;
    const maxX = window.innerWidth - w - 8;
    const maxY = window.innerHeight - h - 8;
    setPos({
      x: Math.max(8, Math.min(state.x, maxX)),
      y: Math.max(8, Math.min(state.y, maxY)),
    });
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onClose, { passive: true });
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [state, onClose]);

  if (!state) return null;

  return (
    <div
      ref={ref}
      className="canvas-context-menu"
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {state.items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className="canvas-context-menu__item"
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            item.onSelect();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
