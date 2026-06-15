export const CALLOUT_SCALE_DEFAULT = 1;
export const CALLOUT_SCALE_MIN = 0.5;
export const CALLOUT_SCALE_MAX = 3;
export const CALLOUT_EFFECTIVE_MIN = 0.5;
export const CALLOUT_EFFECTIVE_MAX = 5;
export const CALLOUT_AUTO_ZOOM_DEFAULT = true;

export function clampCalloutScale(value: number): number {
  return Math.min(CALLOUT_SCALE_MAX, Math.max(CALLOUT_SCALE_MIN, value));
}

export function clampEffectiveCalloutScale(value: number): number {
  return Math.min(CALLOUT_EFFECTIVE_MAX, Math.max(CALLOUT_EFFECTIVE_MIN, value));
}

export type EffectiveCalloutScaleOptions = {
  autoZoomCompensate: boolean;
  isPrinting: boolean;
};

export function effectiveCalloutScale(
  userScale: number,
  zoom: number,
  options: EffectiveCalloutScaleOptions,
): number {
  const user = clampCalloutScale(userScale);
  if (options.isPrinting || !options.autoZoomCompensate) {
    return clampEffectiveCalloutScale(user);
  }
  const safeZoom = zoom > 0 ? zoom : 1;
  return clampEffectiveCalloutScale(user / safeZoom);
}

export function calloutScalePercent(userScale: number): number {
  return Math.round(clampCalloutScale(userScale) * 100);
}
