/* Where the AndyAI tour's caption bubble sits when it has to keep clear of
   things on the desktop (the icons it is talking about, the cursor's own
   name tag). */

export type Box = { x: number; y: number; w: number; h: number };

/** The top nearest `preferred` at which a bubble of the given box clears
    every blocker and stays within [minTop, maxTop] — or `preferred` itself
    when nowhere within reach is clear. */
export function nearestClearTop(
  preferred: number,
  bubble: { left: number; w: number; h: number },
  blockers: Box[],
  minTop: number,
  maxTop: number,
): number {
  for (let d = 0; d <= 180; d += 6) {
    for (const top of [preferred + d, preferred - d]) {
      if (isClearTop(top, bubble, blockers, minTop, maxTop)) return top;
    }
  }
  return preferred;
}

export function isClearTop(
  top: number,
  bubble: { left: number; w: number; h: number },
  blockers: Box[],
  minTop: number,
  maxTop: number,
): boolean {
  return (
    top >= minTop &&
    top <= maxTop &&
    !blockers.some(
      (b) =>
        bubble.left < b.x + b.w &&
        bubble.left + bubble.w > b.x &&
        top < b.y + b.h &&
        top + bubble.h > b.y,
    )
  );
}
