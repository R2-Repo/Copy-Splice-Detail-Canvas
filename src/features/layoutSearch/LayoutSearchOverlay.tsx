import type { LayoutSearchProgress } from "@/features/layoutSearch/layoutSearch";

type LayoutSearchOverlayProps = {
  progress: LayoutSearchProgress;
  onCancel: () => void;
};

export function LayoutSearchOverlay({
  progress,
  onCancel,
}: LayoutSearchOverlayProps) {
  const scoreLabel =
    progress.feasible && Number.isFinite(progress.bestScore)
      ? Math.round(progress.bestScore).toLocaleString()
      : "—";

  return (
    <div className="layout-search-overlay" role="status" aria-live="polite">
      <div className="layout-search-overlay__panel">
        <p className="layout-search-overlay__title">Optimizing layout…</p>
        <p className="layout-search-overlay__detail">
          Round {progress.round} · best score {scoreLabel}
        </p>
        <button
          type="button"
          className="layout-search-overlay__cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
