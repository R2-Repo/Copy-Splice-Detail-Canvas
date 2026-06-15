import type { ReactNode } from "react";

import {
  AutoIcon,
  CalloutIcon,
  CollapseIcon,
  ExportConfigIcon,
  FolderPlusIcon,
  HorizontalLayoutIcon,
  InspectIcon,
  ListIcon,
  ManualIcon,
  MapIcon,
  PrintIcon,
  QuadLayoutIcon,
  ReportIcon,
} from "@/components/toolbar/ToolbarIcon";
import {
  BoxSelectIllustration,
  BundleDoubleClickIllustration,
  CircuitFlashIllustration,
  ClickProtectIllustration,
  DotDragIllustration,
  DragCableIllustration,
  DropFileIllustration,
  HandleShiftClickIllustration,
  LegDragIllustration,
  MiniSpliceDiagram,
  ScrollZoomIllustration,
  TubeTipIllustration,
  ZoomControlsIllustration,
} from "@/components/help/HelpGuideIllustrations";

function KeyBadge({ children }: { children: ReactNode }) {
  return <span className="help-guide-overlay__key-badge">{children}</span>;
}

function HelpCard({
  visual,
  caption,
  badge,
}: {
  visual: ReactNode;
  caption: string;
  badge?: ReactNode;
}) {
  return (
    <div className="help-guide-overlay__card">
      {badge ? <div className="help-guide-overlay__card-badge">{badge}</div> : null}
      <div className="help-guide-overlay__card-visual">{visual}</div>
      <span className="help-guide-overlay__card-caption">{caption}</span>
    </div>
  );
}

function StepArrow() {
  return <span className="help-guide-overlay__step-arrow" aria-hidden>→</span>;
}

function HelpSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="help-guide-overlay__section">
      <h3 className="help-guide-overlay__section-title">{title}</h3>
      {children}
    </section>
  );
}

function ToolbarMapItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="help-guide-overlay__toolbar-item">
      <span className="help-guide-overlay__toolbar-icon">{icon}</span>
      <span className="help-guide-overlay__toolbar-label">{label}</span>
    </div>
  );
}

export function HelpGuideContent() {
  return (
    <div className="help-guide-overlay__content">
      <HelpSection title="Get started">
        <div className="help-guide-overlay__step-flow">
          <HelpCard visual={<FolderPlusIcon />} caption="Import file" />
          <StepArrow />
          <HelpCard visual={<MiniSpliceDiagram />} caption="Diagram builds" />
          <StepArrow />
          <HelpCard
            visual={
              <span className="help-guide-overlay__dual-icon">
                <AutoIcon />
                <ManualIcon />
              </span>
            }
            caption="Adjust"
          />
        </div>
        <div className="help-guide-overlay__card-grid help-guide-overlay__card-grid--compact">
          <HelpCard visual={<DropFileIllustration />} caption="Drop file on canvas" />
        </div>
      </HelpSection>

      <HelpSection title="Auto adjust">
        <div className="help-guide-overlay__card-grid">
          <HelpCard visual={<DragCableIllustration />} caption="Drag cable ↔" />
          <HelpCard visual={<ClickProtectIllustration />} caption="Hold line → protect" />
        </div>
      </HelpSection>

      <HelpSection title="Manual adjust">
        <div className="help-guide-overlay__card-grid">
          <HelpCard visual={<TubeTipIllustration />} caption="Tube tip ↕" />
          <HelpCard visual={<LegDragIllustration />} caption="Leg ↔ ↕" />
          <HelpCard visual={<DotDragIllustration />} caption="Dot ↔" />
          <HelpCard
            badge={<KeyBadge>Shift</KeyBadge>}
            visual={<HandleShiftClickIllustration />}
            caption="Add row"
          />
          <HelpCard visual={<BoxSelectIllustration />} caption="Box select" />
          <HelpCard
            badge={
              <span className="help-guide-overlay__key-badge-row">
                <KeyBadge>Ctrl</KeyBadge>
                <KeyBadge>⌘</KeyBadge>
              </span>
            }
            visual={<LegDragIllustration />}
            caption="Add splice"
          />
          <HelpCard
            badge={<span className="help-guide-overlay__dbl-badge">2×</span>}
            visual={<BundleDoubleClickIllustration />}
            caption="Tube bundle"
          />
          <HelpCard badge={<KeyBadge>Esc</KeyBadge>} visual={<BoxSelectIllustration />} caption="Clear pick" />
        </div>
      </HelpSection>

      <HelpSection title="Toolbar">
        <div className="help-guide-overlay__toolbar-map">
          <ToolbarMapItem icon={<CollapseIcon />} label="Tubes" />
          <ToolbarMapItem icon={<CalloutIcon />} label="Callouts" />
          <ToolbarMapItem icon={<ListIcon />} label="Circuits" />
          <ToolbarMapItem icon={<AutoIcon />} label="Auto" />
          <ToolbarMapItem icon={<ManualIcon />} label="Manual" />
          <ToolbarMapItem icon={<HorizontalLayoutIcon />} label="L/R" />
          <ToolbarMapItem icon={<QuadLayoutIcon />} label="4-side" />
          <ToolbarMapItem icon={<MapIcon />} label="Map" />
          <ToolbarMapItem icon={<ReportIcon />} label="Report" />
          <ToolbarMapItem icon={<InspectIcon />} label="Inspect" />
          <ToolbarMapItem icon={<ExportConfigIcon />} label="Export" />
          <ToolbarMapItem icon={<FolderPlusIcon />} label="Import" />
          <ToolbarMapItem icon={<PrintIcon />} label="Print" />
        </div>
        <p className="help-guide-overlay__toolbar-note">
          Print diagram opens your system print dialog — choose tabloid landscape
          and Save as PDF or your printer.
        </p>
      </HelpSection>

      <HelpSection title="Circuits">
        <div className="help-guide-overlay__card-grid help-guide-overlay__card-grid--compact">
          <HelpCard visual={<CircuitFlashIllustration />} caption="Click circuit → flash" />
        </div>
      </HelpSection>

      <HelpSection title="Keys & canvas">
        <div className="help-guide-overlay__card-grid">
          <HelpCard badge={<KeyBadge>Esc</KeyBadge>} visual={<span className="help-guide-overlay__esc-hint">✕</span>} caption="Close / clear" />
          <HelpCard visual={<ScrollZoomIllustration />} caption="Scroll zoom" />
          <HelpCard visual={<ZoomControlsIllustration />} caption="Corner controls" />
        </div>
      </HelpSection>
    </div>
  );
}
