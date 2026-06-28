import type { LayoutSearchProgress } from "@/features/layoutSearch/layoutSearchTypes";

type LayoutSearchOverlayProps = {
  progress: LayoutSearchProgress;
  onCancel: () => void;
};

function phaseTitle(phase: LayoutSearchProgress["phase"]): string {
  switch (phase) {
    case "parsing":
      return "Reading CSV…";
    case "analyzing":
      return "Analyzing connections…";
    case "heuristic_paint":
      return "Building initial layout…";
    case "optimizing":
      return "Optimizing layout…";
    case "finalizing":
      return "Finishing…";
  }
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatEvalRate(rate: number | undefined): string {
  if (rate === undefined || !Number.isFinite(rate) || rate <= 0) return "—";
  return `${rate.toLocaleString()}/s`;
}

export function LayoutSearchOverlay({
  progress,
  onCancel,
}: LayoutSearchOverlayProps) {
  const scoreLabel =
    progress.feasible && Number.isFinite(progress.bestScore)
      ? Math.round(progress.bestScore).toLocaleString()
      : "—";

  const budgetKnown = progress.evaluationBudget > 0;
  const barPercent = budgetKnown
    ? Math.min(
        100,
        Math.round(
          (progress.evaluations / progress.evaluationBudget) * 100,
        ),
      )
    : undefined;

  const isFinalizing = progress.phase === "finalizing";
  const showFeasibility = progress.feasible && progress.phase === "optimizing";

  const statsParts = [
    `Round ${progress.round}`,
    `${progress.evaluations.toLocaleString()}${budgetKnown ? ` / ${progress.evaluationBudget.toLocaleString()}` : ""} evals`,
    formatElapsed(progress.elapsedMs),
    formatEvalRate(progress.evalsPerSecond),
  ];

  const contextLine =
    progress.message ??
    `${progress.strandCount.toLocaleString()} fibers · ${progress.cableCount} cables`;

  return (
    <div className="layout-search-overlay" role="status" aria-live="polite">
      <div
        className={`layout-search-overlay__panel${isFinalizing ? " layout-search-overlay__panel--pulse" : ""}`}
      >
        <p className="layout-search-overlay__title">
          {phaseTitle(progress.phase)}
        </p>
        <p className="layout-search-overlay__context">{contextLine}</p>

        <div
          className="layout-search-overlay__bar-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={barPercent ?? undefined}
          aria-label="Layout search progress"
        >
          <div
            className={`layout-search-overlay__bar-fill${barPercent === undefined ? " layout-search-overlay__bar-fill--indeterminate" : ""}`}
            style={
              barPercent !== undefined
                ? { width: `${barPercent}%` }
                : undefined
            }
          />
          <span className="layout-search-overlay__bar-shimmer" aria-hidden />
        </div>

        <p className="layout-search-overlay__detail">
          {statsParts.join(" · ")} · best score {scoreLabel}
        </p>

        {showFeasibility ? (
          <p className="layout-search-overlay__feasible">
            Feasible layout found
          </p>
        ) : null}

        {progress.diagnostics &&
        typeof import.meta !== "undefined" &&
        import.meta.env?.DEV ? (
          <p className="layout-search-overlay__diagnostics">
            T/B tried: T1 {progress.diagnostics.topOrBottomReachedT1} · T2{" "}
            {progress.diagnostics.topOrBottomReachedT2} ·{" "}
            {progress.diagnostics.selectedCandidateReason}
          </p>
        ) : null}

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
