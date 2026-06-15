import type { DiagramTitleBlock, SpliceReportHeader } from "@/types/splice";

const TITLE_FIELDS: (keyof DiagramTitleBlock)[] = [
  "street",
  "cityState",
  "poleNumber",
  "reportDate",
  "description",
  "location",
];

export function titleBlockFromHeader(
  header: SpliceReportHeader,
): DiagramTitleBlock {
  return {
    street: header.street ?? "",
    cityState: header.cityState ?? "",
    poleNumber: header.poleNumber ?? "",
    reportDate: header.reportDate ?? "",
    description: header.description || header.spliceNumber || "",
    location: header.location ?? "",
  };
}

/** Merge CSV defaults with user-edited overrides (empty string is a valid edit). */
export function resolveTitleBlock(
  header: SpliceReportHeader,
  overrides?: DiagramTitleBlock,
): DiagramTitleBlock {
  const defaults = titleBlockFromHeader(header);
  if (!overrides) return defaults;

  const merged = { ...defaults };
  for (const key of TITLE_FIELDS) {
    if (key in overrides && overrides[key] !== undefined) {
      merged[key] = overrides[key];
    }
  }
  return merged;
}
