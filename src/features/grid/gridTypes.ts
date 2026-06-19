/** Internal routing grid — lane lines, segments, zones, and route storage. */

export type SegmentStatus =
  | "available"
  | "reserved"
  | "occupied"
  | "blocked"
  | "manual-locked";

export type GridPoint = { x: number; y: number };

export type GridZone = "left" | "right" | "top" | "bottom" | "center";

export type RoutingZoneBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  leftX: number;
  rightX: number;
  topY: number;
  bottomY: number;
};

export type GridSegment = {
  id: string;
  axis: "horizontal" | "vertical";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  status: SegmentStatus;
  zone: GridZone;
  connectionId?: string;
};

export type GridMap = {
  pitch: number;
  laneSep: number;
  routingZone: RoutingZoneBounds;
  horizontalLines: number[];
  verticalLines: number[];
  segments: Map<string, GridSegment>;
  layoutMode: "horizontal" | "quad";
};

export type GridRoute = {
  connectionId: string;
  points: GridPoint[];
  segmentIds: string[];
};

export type GridLocks = {
  segments: string[];
  dots: string[];
  cables: string[];
  tubeGroups: string[];
};

export type GridAnchorRef = { x: number; y: number; side: "left" | "right" | "top" | "bottom" };
