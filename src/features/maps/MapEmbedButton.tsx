import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ToolbarActionButton } from "@/components/toolbar/ToolbarSegmentedControl";
import { buildArcGisWebAppUrl } from "@/features/maps/buildArcGisWebAppUrl";
import {
  buildGoogleMapsEmbedUrl,
} from "@/features/maps/buildGoogleMapsUrls";
import { parseSpliceLocation } from "@/features/maps/parseSpliceLocation";

type MapTab = "uplan" | "googleMaps";

type MapEmbedButtonProps = {
  location?: string;
  spliceLabel?: string;
  disabled?: boolean;
  icon: ReactNode;
};

const TAB_LABELS: Record<MapTab, string> = {
  uplan: "uPlan",
  googleMaps: "Google Maps",
};

export function MapEmbedButton({
  location,
  spliceLabel,
  disabled = false,
  icon,
}: MapEmbedButtonProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MapTab>("uplan");
  const coords = useMemo(() => parseSpliceLocation(location), [location]);

  const urls = useMemo(() => {
    if (!coords) return null;
    return {
      uplan: buildArcGisWebAppUrl(coords, spliceLabel),
      mapsEmbed: buildGoogleMapsEmbedUrl(coords),
    };
  }, [coords, spliceLabel]);
  const activePanelId = `map-embed-panel-${activeTab}`;

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
    <div className="map-embed-anchor" ref={anchorRef}>
      <ToolbarActionButton
        label="Show splice location on map"
        icon={icon}
        pressed={open}
        expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      />
      {open ? (
        <section
          className="map-embed-popover"
          role="dialog"
          aria-modal="false"
          aria-label="Splice location maps"
        >
          <div className="map-embed-popover__tabs" role="tablist" aria-label="Map views">
            {(["uplan", "googleMaps"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                id={`map-embed-tab-${tab}`}
                role="tab"
                className={`map-embed-popover__tab${activeTab === tab ? " map-embed-popover__tab--active" : ""}`}
                aria-selected={activeTab === tab}
                aria-controls={`map-embed-panel-${tab}`}
                onClick={() => setActiveTab(tab)}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
          <div
            className="map-embed-popover__body"
            role="tabpanel"
            id={activePanelId}
            aria-labelledby={`map-embed-tab-${activeTab}`}
          >
            {!coords ? (
              <p className="map-embed-popover__fallback">No location in CSV header.</p>
            ) : activeTab === "uplan" ? (
              <iframe
                title="uPlan ArcGIS map"
                className="map-embed-popover__iframe"
                src={urls?.uplan}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <iframe
                title="Google Maps satellite preview"
                className="map-embed-popover__iframe"
                src={urls?.mapsEmbed}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </div>
          {coords ? (
            <p className="map-embed-popover__meta">
              {spliceLabel?.trim() || "Splice"} · {coords.lat.toFixed(6)},{" "}
              {coords.lon.toFixed(6)}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
