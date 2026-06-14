import type { ReactNode } from "react";

export type SegmentOption = {
  value: string;
  label: string;
  icon: ReactNode;
};

type ToolbarSegmentedControlProps = {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

export function ToolbarSegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  className,
}: ToolbarSegmentedControlProps) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === value),
  );

  const rootClass = [
    "toolbar-segment",
    disabled ? "toolbar-segment--disabled" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClass}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      data-selected-index={selectedIndex}
      data-option-count={options.length}
    >
      <span className="toolbar-segment__indicator" aria-hidden />
      {options.map((opt) => {
        const checked = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            className="toolbar-segment__option"
            aria-checked={checked}
            aria-label={opt.label}
            title={opt.label}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}

type ToolbarActionButtonProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  expanded?: boolean;
};

export function ToolbarActionButton({
  label,
  icon,
  onClick,
  pressed = false,
  disabled = false,
  expanded,
}: ToolbarActionButtonProps) {
  return (
    <button
      type="button"
      className={`toolbar-action${pressed ? " toolbar-action--pressed" : ""}`}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}
