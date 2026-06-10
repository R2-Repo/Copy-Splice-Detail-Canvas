import { useCallback, useEffect, useState } from "react";

type SpliceReportOverlayProps = {
  open: boolean;
  text: string;
  onClose: () => void;
};

export function SpliceReportOverlay({
  open,
  text,
  onClose,
}: SpliceReportOverlayProps) {
  const [copied, setCopied] = useState(false);

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

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [text]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (!open) return null;

  return (
    <div
      className="splice-report-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Splice connection report"
    >
      <div className="splice-report-overlay__backdrop" onClick={onClose} />
      <div className="splice-report-overlay__panel">
        <header className="splice-report-overlay__header">
          <h2 className="splice-report-overlay__title">Connection report</h2>
          <div className="splice-report-overlay__actions">
            <button
              type="button"
              className="csv-import__button csv-import__button--secondary"
              onClick={handleCopy}
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              className="csv-import__button csv-import__button--secondary"
              onClick={handlePrint}
            >
              Print
            </button>
            <button
              type="button"
              className="csv-import__button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </header>
        <pre className="splice-report-overlay__text">{text}</pre>
      </div>
    </div>
  );
}
