import type { LayoutOverrides, SpliceReport } from "@/types/splice";

export const DIAGRAM_CONFIG_SCHEMA_VERSION = 1;

export const DIAGRAM_CONFIG_FILE_EXTENSION = ".sdc.json";

export type DiagramConfigViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type DiagramConfigSource = {
  fileName?: string;
  spliceNumber?: string;
};

/** Layout overrides stored in config — reportKey omitted, regenerated on import. */
export type DiagramConfigLayout = Omit<LayoutOverrides, "reportKey">;

export type DiagramConfigFile = {
  schemaVersion: typeof DIAGRAM_CONFIG_SCHEMA_VERSION;
  exportedAt: string;
  appVersion?: string;
  source?: DiagramConfigSource;
  report: SpliceReport;
  cableSides: Record<string, "left" | "right">;
  layout: DiagramConfigLayout;
  viewport?: DiagramConfigViewport;
};
