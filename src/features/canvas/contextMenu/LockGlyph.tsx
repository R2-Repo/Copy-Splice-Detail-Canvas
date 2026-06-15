/** Small padlock glyph used for lock badges/indicators. */
export function LockGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        fill="currentColor"
      />
      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
