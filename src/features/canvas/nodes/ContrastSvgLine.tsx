import { FIBER_CONTRAST_OUTLINE } from "@/features/diagram/colorCode";

type ContrastSvgLineProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  contrastOutline?: boolean;
  strokeLinecap?: "round" | "butt" | "square";
  strokeDasharray?: string;
  className?: string;
};

export function ContrastSvgLine({
  contrastOutline = false,
  stroke,
  strokeWidth,
  ...rest
}: ContrastSvgLineProps) {
  return (
    <>
      {contrastOutline ? (
        <line
          {...rest}
          stroke={FIBER_CONTRAST_OUTLINE}
          strokeWidth={strokeWidth + 2}
        />
      ) : null}
      <line {...rest} stroke={stroke} strokeWidth={strokeWidth} />
    </>
  );
}
