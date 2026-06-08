import type { FiberColorAbbrev, TubeColorCode } from "@/types/splice";

export type FiberColorDef = {
  index: number;
  name: string;
  abbrev: FiberColorAbbrev;
  hex: string;
};

/** TIA-598 12-color sequence (tube and fiber). */
export const TIA_12_COLORS: readonly FiberColorDef[] = [
  { index: 1, name: "Blue", abbrev: "BL", hex: "#2563eb" },
  { index: 2, name: "Orange", abbrev: "OR", hex: "#ea580c" },
  { index: 3, name: "Green", abbrev: "GR", hex: "#16a34a" },
  { index: 4, name: "Brown", abbrev: "BR", hex: "#92400e" },
  { index: 5, name: "Slate", abbrev: "SL", hex: "#64748b" },
  { index: 6, name: "White", abbrev: "WH", hex: "#f8fafc" },
  { index: 7, name: "Red", abbrev: "RD", hex: "#dc2626" },
  { index: 8, name: "Black", abbrev: "BK", hex: "#171717" },
  { index: 9, name: "Yellow", abbrev: "YL", hex: "#eab308" },
  { index: 10, name: "Violet", abbrev: "VI", hex: "#7c3aed" },
  { index: 11, name: "Rose", abbrev: "RO", hex: "#f472b6" },
  { index: 12, name: "Aqua", abbrev: "AQ", hex: "#06b6d4" },
] as const;

const ABBREV_SET = new Set(TIA_12_COLORS.map((c) => c.abbrev));

export function isFiberColorAbbrev(value: string): value is FiberColorAbbrev {
  return ABBREV_SET.has(value as FiberColorAbbrev);
}

export function fiberColorFromIndex(index1to12: number): FiberColorDef {
  const idx = ((index1to12 - 1) % 12) + 1;
  return TIA_12_COLORS[idx - 1]!;
}

/** 144-count: fiber N → tube ceil(N/12), fiber color (N-1)%12+1. */
export function fiberNumberToTube(fiberNumber: number): number {
  return Math.ceil(fiberNumber / 12);
}

export function fiberNumberToColorIndex(fiberNumber: number): number {
  return ((fiberNumber - 1) % 12) + 1;
}

export function fibersPerBufferTubeFromCableName(cable: string): 6 | 12 {
  if (/\bDK-?6\b/i.test(cable) || /\b6[\s-]?(DROP|SMF|COUNT)/i.test(cable)) {
    return 6;
  }
  return 12;
}

export function fiberNumberFromTubeAndColor(
  tubeColor: TubeColorCode,
  fiberColor: FiberColorAbbrev,
  fibersPerTube: 6 | 12 = 12,
): number {
  const tubeIndex = TIA_TUBE_ORDER.indexOf(tubeColor);
  const colorIndex = TIA_12_COLORS.findIndex((c) => c.abbrev === fiberColor);
  if (tubeIndex === -1 || colorIndex === -1) return Number.NaN;
  if (fibersPerTube === 6 && colorIndex >= 6) return Number.NaN;
  return tubeIndex * fibersPerTube + colorIndex + 1;
}

export function fiberNumberToAbbrev(fiberNumber: number): FiberColorAbbrev {
  return fiberColorFromIndex(fiberNumberToColorIndex(fiberNumber)).abbrev;
}

export function parseTubeColorCode(raw: string): TubeColorCode | null {
  const code = raw.trim().toUpperCase();
  if (isFiberColorAbbrev(code)) return code;
  const striped = /^([A-Z]{2})-BK$/.exec(code);
  if (striped && isFiberColorAbbrev(striped[1]!)) {
    return `${striped[1]}-BK` as TubeColorCode;
  }
  return null;
}

export function isStripedTube(code: TubeColorCode): boolean {
  return code.endsWith("-BK");
}

/** Solid TIA tubes 1–12, then striped tubes 13–24 (288-count). */
export const TIA_TUBE_ORDER: readonly TubeColorCode[] = [
  "BL",
  "OR",
  "GR",
  "BR",
  "SL",
  "WH",
  "RD",
  "BK",
  "YL",
  "VI",
  "RO",
  "AQ",
  "BL-BK",
  "OR-BK",
  "GR-BK",
  "BR-BK",
  "SL-BK",
  "WH-BK",
  "RD-BK",
  "BK-BK",
  "YL-BK",
  "VI-BK",
  "RO-BK",
  "AQ-BK",
] as const;

export function compareTubeColorsTia(
  a: TubeColorCode,
  b: TubeColorCode,
): number {
  const ia = TIA_TUBE_ORDER.indexOf(a);
  const ib = TIA_TUBE_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

export function tubeColorHex(code: TubeColorCode): string {
  const base = code.split("-")[0] as FiberColorAbbrev;
  return colorHex(base);
}

export function colorHex(abbrev: FiberColorAbbrev): string {
  const def = TIA_12_COLORS.find((c) => c.abbrev === abbrev);
  return def?.hex ?? "#94a3b8";
}

export function colorName(abbrev: FiberColorAbbrev): string {
  const def = TIA_12_COLORS.find((c) => c.abbrev === abbrev);
  return def?.name ?? abbrev;
}

/** Dark edge on light TIA colors so strands/tubes stay visible on white canvas. */
export const FIBER_CONTRAST_OUTLINE = "rgba(0, 0, 0, 0.4)";

export function needsFiberContrastOutline(abbrev: FiberColorAbbrev): boolean {
  return abbrev === "WH";
}

export function needsFiberContrastOutlineHex(hex: string): boolean {
  return hex.toLowerCase() === colorHex("WH").toLowerCase();
}
