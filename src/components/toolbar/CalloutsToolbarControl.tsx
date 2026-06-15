import { useEffect, useRef, useState } from "react";

import {
  CALLOUT_SCALE_DEFAULT,
  CALLOUT_SCALE_MAX,
  CALLOUT_SCALE_MIN,
  calloutScalePercent,
  clampCalloutScale,
} from "@/features/canvas/callouts/calloutScale";

type CalloutsToolbarControlProps = {
  disabled?: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  userScale: number;
  onUserScaleChange: (scale: number) => void;
  autoZoomCompensate: boolean;
  onAutoZoomChange: (enabled: boolean) => void;
};

export function CalloutsToolbarControl({
  disabled = false,
  checked,
  onCheckedChange,
  userScale,
  onUserScaleChange,
  autoZoomCompensate,
  onAutoZoomChange,
}: CalloutsToolbarControlProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const settingsDisabled = disabled || !checked;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (anchorRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div
      className={`callouts-toolbar-control${disabled ? " callouts-toolbar-control--disabled" : ""}`}
      ref={anchorRef}
    >
      <div className="callouts-toolbar-control__pill">
        <span className="toolbar-pill-toggle__label">Callouts</span>
        <div className="callouts-toolbar-control__row">
          <button
            type="button"
            role="switch"
            className="toolbar-pill-toggle__switch"
            aria-label="Show cable callouts when on, hide when off"
            aria-checked={checked}
            title="Show cable callouts when on, hide when off"
            disabled={disabled}
            onClick={() => onCheckedChange(!checked)}
          >
            <span className="toolbar-pill-toggle__track" aria-hidden>
              <span
                className={`toolbar-pill-toggle__indicator${checked ? " toolbar-pill-toggle__indicator--on" : ""}`}
              >
                <span className="toolbar-pill-toggle__knob" />
              </span>
            </span>
          </button>
          <button
            type="button"
            className="callouts-toolbar-control__menu-btn"
            aria-label="Callout size settings"
            aria-expanded={open}
            aria-haspopup="dialog"
            title="Callout size settings"
            disabled={settingsDisabled}
            onClick={() => setOpen((prev) => !prev)}
          >
            ▾
          </button>
        </div>
      </div>
      {open ? (
        <section
          className="callouts-scale-popover"
          role="dialog"
          aria-modal="false"
          aria-label="Callout size settings"
        >
          <label className="callouts-scale-popover__slider-row">
            <span className="callouts-scale-popover__label">Size</span>
            <input
              type="range"
              className="callouts-scale-popover__range"
              min={CALLOUT_SCALE_MIN}
              max={CALLOUT_SCALE_MAX}
              step={0.1}
              value={clampCalloutScale(userScale)}
              disabled={settingsDisabled}
              onChange={(event) =>
                onUserScaleChange(Number.parseFloat(event.target.value))
              }
            />
            <span className="callouts-scale-popover__value">
              {calloutScalePercent(userScale)}%
            </span>
          </label>
          <label className="callouts-scale-popover__check">
            <input
              type="checkbox"
              checked={autoZoomCompensate}
              disabled={settingsDisabled}
              onChange={(event) => onAutoZoomChange(event.target.checked)}
            />
            <span>Keep readable when zoomed</span>
          </label>
          <button
            type="button"
            className="callouts-scale-popover__reset"
            disabled={
              settingsDisabled ||
              (userScale === CALLOUT_SCALE_DEFAULT && autoZoomCompensate)
            }
            onClick={() => {
              onUserScaleChange(CALLOUT_SCALE_DEFAULT);
              onAutoZoomChange(true);
            }}
          >
            Reset
          </button>
        </section>
      ) : null}
    </div>
  );
}
