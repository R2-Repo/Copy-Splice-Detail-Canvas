import { FIBER_ROW_PITCH } from "@/features/diagram/cableLayoutMetrics";

/**
 * Horizontal leg alignment (EDGE-013).
 *
 * Max vertical gap (px) between a leg's two handle rows that still counts as
 * "near straight" and gets snapped to a single flat horizontal line. Half the
 * fiber pitch — matches the collapsed-tube straight tolerance
 * (`BUTT_SPLICE_STRAIGHT_Y_TOLERANCE`) so fiber legs and collapsed buffer tubes
 * snap on the same threshold.
 */
export const HORIZONTAL_ALIGN_TOLERANCE = FIBER_ROW_PITCH / 2;

/** Sub-pixel noise floor — gaps below this are already flat. */
const ALIGN_EPS = 0.5;

export type AlignConnection = {
  /** Offset from this cable's node top to the fiber/tube handle center. */
  ownOffset: number;
  /** Partner cable id on the opposite side of the splice. */
  partnerCableId: string;
  /** Offset from the partner cable's node top to its handle center. */
  partnerOffset: number;
};

/**
 * Compute a small uniform vertical shift for one cable so the most near-straight
 * legs become perfectly flat. Moving a whole cable preserves the 24px in-tube
 * pitch (FBR-002) and tube/fiber order — only the cable's Y changes.
 *
 * Returns 0 when no shift within `tolerance` produces a net gain in flat legs
 * (so coincidentally-aligned legs are never broken).
 *
 * Pure: reads a snapshot of partner Ys via `partnerY`.
 */
export function computeNearStraightShift(
  cableY: number,
  connections: AlignConnection[],
  partnerY: (cableId: string) => number | undefined,
  tolerance = HORIZONTAL_ALIGN_TOLERANCE,
): number {
  const candidates = new Map<number, { delta: number; count: number }>();
  let alreadyStraight = 0;

  for (const conn of connections) {
    const py = partnerY(conn.partnerCableId);
    if (py === undefined) continue;
    const ownHandleY = cableY + conn.ownOffset;
    const partnerHandleY = py + conn.partnerOffset;
    // Shifting this cable's Y by `gap` makes the leg perfectly flat.
    const gap = partnerHandleY - ownHandleY;
    if (Math.abs(gap) <= ALIGN_EPS) {
      alreadyStraight += 1;
      continue;
    }
    if (Math.abs(gap) > tolerance) continue;
    const key = Math.round(gap * 100) / 100;
    const entry = candidates.get(key) ?? { delta: gap, count: 0 };
    entry.count += 1;
    candidates.set(key, entry);
  }

  let best = { delta: 0, count: 0, absDelta: Number.POSITIVE_INFINITY };
  for (const { delta, count } of candidates.values()) {
    const absDelta = Math.abs(delta);
    if (
      count > best.count ||
      (count === best.count && absDelta < best.absDelta)
    ) {
      best = { delta, count, absDelta };
    }
  }

  // Only shift when it flattens more legs than it would un-flatten.
  return best.count > alreadyStraight ? best.delta : 0;
}
