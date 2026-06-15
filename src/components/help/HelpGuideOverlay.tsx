import { useEffect } from "react";

import { HelpGuideContent } from "@/components/help/HelpGuideContent";

type HelpGuideOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function HelpGuideOverlay({ open, onClose }: HelpGuideOverlayProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="help-guide-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Help and guide"
    >
      <div className="help-guide-overlay__backdrop" onClick={onClose} />
      <div className="help-guide-overlay__panel">
        <header className="help-guide-overlay__header">
          <h2 className="help-guide-overlay__title">Help &amp; guide</h2>
          <button
            type="button"
            className="csv-import__button"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <div className="help-guide-overlay__body">
          <HelpGuideContent />
        </div>
      </div>
    </div>
  );
}
