import { createContext, useContext } from "react";

type CalloutPersistContextValue = {
  onTextChange: (calloutId: string, text: string) => void;
};

export const CalloutPersistContext = createContext<CalloutPersistContextValue>(
  {
    onTextChange: () => {},
  },
);

export function useCalloutPersist(): CalloutPersistContextValue {
  return useContext(CalloutPersistContext);
}
