import type { FiberEndpoint } from "@/types/splice";

export type SpliceReportOptions = {
  existingConnectionIds?: ReadonlySet<string>;
};

export type SpliceConnectionLine = {
  connectionId: string;
  near: FiberEndpoint;
  far: FiberEndpoint;
  circuitName?: string;
  existing?: boolean;
  inferredNear?: boolean;
  inferredFar?: boolean;
  fullButt?: boolean;
};
