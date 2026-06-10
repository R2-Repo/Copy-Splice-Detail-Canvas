import { FIBER_CONTRAST_OUTLINE } from "@/features/diagram/colorCode";

type ContrastSvgPathProps = {
  d: string;
  stroke: string;
  strokeWidth: number;
  contrastOutline?: boolean;
  strokeLinecap?: "round" | "butt" | "square";
  strokeLinejoin?: "round" | "miter" | "bevel";
  strokeDasharray?: string;
  className?: string;
};

export function ContrastSvgPath({
  contrastOutline = false,
  stroke,
  strokeWidth,
  ...rest
}: ContrastSvgPathProps) {
  return (
    <>
      {contrastOutline ? (
        <path
          {...rest}
          fill="none"
          stroke={FIBER_CONTRAST_OUTLINE}
          strokeWidth={strokeWidth + 2}
        />
      ) : null}
      <path {...rest} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
    </>
  );
}
