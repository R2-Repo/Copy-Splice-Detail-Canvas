import type { ManualLayoutGuideLine } from "@/features/canvas/ManualLayoutContext";

export function ManualLayoutGuideOverlay({
  guides,
}: {
  guides: ManualLayoutGuideLine[];
}) {
  if (guides.length === 0) return null;
  return (
    <svg className="manual-layout-guides" aria-hidden>
      {guides.map((guide) =>
        guide.orientation === "horizontal" ? (
          <line
            key={guide.id}
            x1={0}
            y1={guide.value}
            x2="100%"
            y2={guide.value}
          />
        ) : (
          <line
            key={guide.id}
            x1={guide.value}
            y1={0}
            x2={guide.value}
            y2="100%"
          />
        ),
      )}
    </svg>
  );
}
