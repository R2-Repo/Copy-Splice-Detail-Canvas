import { createContext, useContext, type ReactNode } from "react";

import {
  CALLOUT_AUTO_ZOOM_DEFAULT,
  CALLOUT_SCALE_DEFAULT,
  effectiveCalloutScale,
} from "@/features/canvas/callouts/calloutScale";

export type CalloutScaleContextValue = {
  userScale: number;
  autoZoomCompensate: boolean;
  isPrinting: boolean;
  setUserScale: (scale: number) => void;
  setAutoZoomCompensate: (enabled: boolean) => void;
  effectiveScale: (zoom: number) => number;
};

const defaultValue: CalloutScaleContextValue = {
  userScale: CALLOUT_SCALE_DEFAULT,
  autoZoomCompensate: CALLOUT_AUTO_ZOOM_DEFAULT,
  isPrinting: false,
  setUserScale: () => {},
  setAutoZoomCompensate: () => {},
  effectiveScale: (zoom) =>
    effectiveCalloutScale(CALLOUT_SCALE_DEFAULT, zoom, {
      autoZoomCompensate: CALLOUT_AUTO_ZOOM_DEFAULT,
      isPrinting: false,
    }),
};

export const CalloutScaleContext =
  createContext<CalloutScaleContextValue>(defaultValue);

export function CalloutScaleProvider({
  value,
  children,
}: {
  value: CalloutScaleContextValue;
  children: ReactNode;
}) {
  return (
    <CalloutScaleContext.Provider value={value}>
      {children}
    </CalloutScaleContext.Provider>
  );
}

export function useCalloutScale(): CalloutScaleContextValue {
  return useContext(CalloutScaleContext);
}
