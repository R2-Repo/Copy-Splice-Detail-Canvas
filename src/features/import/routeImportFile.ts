import { looksLikeDiagramConfigText } from "@/features/export/parseDiagramConfig";

export type ImportFileRoute = "config" | "csv" | "unknown";

export const UNSUPPORTED_IMPORT_FILE_MESSAGE =
  "Unsupported file — use a Bentley CSV or saved diagram (.sdc.json)";

export function routeImportFile(text: string, fileName: string): ImportFileRoute {
  if (looksLikeDiagramConfigText(text)) return "config";
  if (fileName.toLowerCase().endsWith(".csv")) return "csv";
  return "unknown";
}
