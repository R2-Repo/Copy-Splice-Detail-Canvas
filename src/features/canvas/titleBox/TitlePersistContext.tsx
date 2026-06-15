import { createContext, useContext } from "react";

import type { DiagramTitleBlock } from "@/types/splice";

type TitleField = keyof DiagramTitleBlock;

type TitlePersistContextValue = {
  onFieldChange: (field: TitleField, value: string) => void;
};

export const TitlePersistContext = createContext<TitlePersistContextValue>({
  onFieldChange: () => {},
});

export function useTitlePersist(): TitlePersistContextValue {
  return useContext(TitlePersistContext);
}
