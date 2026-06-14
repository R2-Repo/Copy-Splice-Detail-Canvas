type ToolbarPillToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
};

export function ToolbarPillToggle({
  label,
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: ToolbarPillToggleProps) {
  return (
    <div
      className={`toolbar-pill-toggle${disabled ? " toolbar-pill-toggle--disabled" : ""}`}
    >
      <span className="toolbar-pill-toggle__label">{label}</span>
      <button
        type="button"
        role="switch"
        className="toolbar-pill-toggle__switch"
        aria-label={ariaLabel}
        aria-checked={checked}
        title={ariaLabel}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="toolbar-pill-toggle__track" aria-hidden>
          <span
            className={`toolbar-pill-toggle__indicator${checked ? " toolbar-pill-toggle__indicator--on" : ""}`}
          >
            <span className="toolbar-pill-toggle__knob" />
          </span>
        </span>
      </button>
    </div>
  );
}
