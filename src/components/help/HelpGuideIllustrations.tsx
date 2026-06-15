type IllustrationProps = {
  className?: string;
};

const svgClass = "help-guide-illustration";

export function MiniSpliceDiagram({ className }: IllustrationProps) {
  return (
    <svg
      className={className ? `${svgClass} ${className}` : svgClass}
      viewBox="0 0 80 32"
      width="80"
      height="32"
      aria-hidden
    >
      <rect x="2" y="10" width="10" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 16h8" stroke="#e67e22" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20 16h6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="30" cy="16" r="3" fill="currentColor" />
      <path d="M33 16h6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M39 16h8" stroke="#3498db" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="68" y="10" width="10" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function DragCableIllustration({ className }: IllustrationProps) {
  return (
    <svg
      className={className ? `${svgClass} ${className}` : svgClass}
      viewBox="0 0 72 40"
      width="72"
      height="40"
      aria-hidden
    >
      <rect x="4" y="14" width="14" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M22 20h20" stroke="currentColor" strokeWidth="1.25" strokeDasharray="3 2" />
      <rect x="46" y="14" width="14" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M18 8l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M50 8l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M54 12H44" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M32 32h8" stroke="var(--neo-accent, #5b8def)" strokeWidth="2" strokeLinecap="round" markerEnd="url(#arrow)" />
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6" fill="var(--neo-accent, #5b8def)" />
        </marker>
      </defs>
    </svg>
  );
}

export function ClickProtectIllustration({ className }: IllustrationProps) {
  return (
    <svg
      className={className ? `${svgClass} ${className}` : svgClass}
      viewBox="0 0 72 40"
      width="72"
      height="40"
      aria-hidden
    >
      <path d="M8 20h24" stroke="#e67e22" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="36" cy="20" r="3" fill="currentColor" />
      <path d="M39 20h24" stroke="#3498db" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M28 20h8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d="M22 10v4M26 12h-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="26" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function TubeTipIllustration({ className }: IllustrationProps) {
  return (
    <svg
      className={className ? `${svgClass} ${className}` : svgClass}
      viewBox="0 0 48 48"
      width="48"
      height="48"
      aria-hidden
    >
      <rect x="6" y="18" width="10" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 24h12" stroke="#e67e22" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="30" cy="24" r="3" fill="currentColor" stroke="none" />
      <path d="M30 10v6M27 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M30 34v6M27 37h6" stroke="var(--neo-accent, #5b8def)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LegDragIllustration({ className }: IllustrationProps) {
  return (
    <svg
      className={className ? `${svgClass} ${className}` : svgClass}
      viewBox="0 0 56 40"
      width="56"
      height="40"
      aria-hidden
    >
      <circle cx="8" cy="20" r="3" fill="#e67e22" stroke="none" />
      <path d="M11 20h10v-8h10" stroke="#e67e22" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <circle cx="33" cy="20" r="3" fill="currentColor" />
      <path d="M36 20h10" stroke="#3498db" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 8l-3 3 3 3" stroke="var(--neo-accent, #5b8def)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M15 11h6" stroke="var(--neo-accent, #5b8def)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function DotDragIllustration({ className }: IllustrationProps) {
  return (
    <svg
      className={className ? `${svgClass} ${className}` : svgClass}
      viewBox="0 0 56 32"
      width="56"
      height="32"
      aria-hidden
    >
      <path d="M4 16h16" stroke="#e67e22" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="16" r="4" fill="currentColor" />
      <path d="M28 16h16" stroke="#3498db" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 24h8" stroke="var(--neo-accent, #5b8def)" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 24l4 4 4-4" stroke="var(--neo-accent, #5b8def)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M36 8l-4 4 4 4" stroke="var(--neo-accent, #5b8def)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function HandleShiftClickIllustration({ className }: IllustrationProps) {
  return (
    <svg
      className={className ? `${svgClass} ${className}` : svgClass}
      viewBox="0 0 40 48"
      width="40"
      height="48"
      aria-hidden
    >
      <circle cx="20" cy="12" r="4" fill="#e67e22" stroke="none" opacity="0.5" />
      <circle cx="20" cy="24" r="4" fill="#e67e22" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20" cy="36" r="4" fill="#e67e22" stroke="none" opacity="0.5" />
      <path d="M28 24h6M31 21v6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function BoxSelectIllustration({ className }: IllustrationProps) {
  return (
    <svg
      className={className ? `${svgClass} ${className}` : svgClass}
      viewBox="0 0 56 40"
      width="56"
      height="40"
      aria-hidden
    >
      <rect x="4" y="4" width="48" height="32" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <rect x="14" y="10" width="28" height="20" rx="1" fill="none" stroke="var(--neo-accent, #5b8def)" strokeWidth="1.5" strokeDasharray="4 2" />
      <circle cx="20" cy="16" r="2.5" fill="#e67e22" />
      <circle cx="28" cy="20" r="2.5" fill="#e67e22" />
      <circle cx="36" cy="24" r="2.5" fill="#e67e22" />
    </svg>
  );
}

export function BundleDoubleClickIllustration({ className }: IllustrationProps) {
  return (
    <svg
      className={className ? `${svgClass} ${className}` : svgClass}
      viewBox="0 0 56 48"
      width="56"
      height="48"
      aria-hidden
    >
      <path d="M8 16h8v8h8" stroke="#e67e22" strokeWidth="1.75" fill="none" strokeLinejoin="round" />
      <path d="M8 32h8v-8h8" stroke="#e67e22" strokeWidth="1.75" fill="none" strokeLinejoin="round" />
      <circle cx="28" cy="24" r="3" fill="currentColor" />
      <path d="M32 16h8v8h8" stroke="#3498db" strokeWidth="1.75" fill="none" strokeLinejoin="round" />
      <path d="M32 32h8v-8h8" stroke="#3498db" strokeWidth="1.75" fill="none" strokeLinejoin="round" />
      <text x="4" y="8" fontSize="7" fill="currentColor" fontFamily="system-ui">2×</text>
    </svg>
  );
}

export function DropFileIllustration({ className }: IllustrationProps) {
  return (
    <svg
      className={className ? `${svgClass} ${className}` : svgClass}
      viewBox="0 0 56 40"
      width="56"
      height="40"
      aria-hidden
    >
      <rect x="6" y="8" width="44" height="28" rx="3" fill="none" stroke="currentColor" strokeWidth="1.25" opacity="0.4" />
      <rect x="18" y="2" width="16" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M22 14h8M26 10v8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M26 24v6M23 29h6" stroke="var(--neo-accent, #5b8def)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CircuitFlashIllustration({ className }: IllustrationProps) {
  return (
    <svg
      className={className ? `${svgClass} ${className}` : svgClass}
      viewBox="0 0 56 40"
      width="56"
      height="40"
      aria-hidden
    >
      <rect x="4" y="6" width="18" height="28" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 12h10M8 17h10M8 22h10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.5" />
      <path d="M8 27h10" stroke="var(--neo-accent, #5b8def)" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 20h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M38 14v12M35 17l3-3 3 3M35 23l3 3 3-3" stroke="var(--neo-accent, #5b8def)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="20" r="3" fill="#e67e22" opacity="0.8" />
    </svg>
  );
}

export function ZoomControlsIllustration({ className }: IllustrationProps) {
  return (
    <svg
      className={className ? `${svgClass} ${className}` : svgClass}
      viewBox="0 0 32 56"
      width="32"
      height="56"
      aria-hidden
    >
      <rect x="4" y="4" width="24" height="48" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 14h8M16 10v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 28h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="10" y="36" width="12" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export function ScrollZoomIllustration({ className }: IllustrationProps) {
  return (
    <svg
      className={className ? `${svgClass} ${className}` : svgClass}
      viewBox="0 0 40 48"
      width="40"
      height="48"
      aria-hidden
    >
      <rect x="10" y="6" width="14" height="22" rx="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M17 14v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 36h24" stroke="var(--neo-accent, #5b8def)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 32l-2 4 2 4M26 32l2 4-2 4" stroke="var(--neo-accent, #5b8def)" strokeWidth="1.25" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
