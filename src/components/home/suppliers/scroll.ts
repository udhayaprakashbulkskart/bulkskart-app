/**
 * The rules for the supplier carousel's automatic scrolling, kept free of the browser so they can be tested.
 */

export type Direction = 1 | -1;

export interface ScrollStepInput {
  /** Where the track is scrolled to now. */
  scrollLeft: number;
  /** The furthest it can scroll (scroll width minus visible width). */
  max: number;
  /** How far one card moves it (card width plus the gap). */
  step: number;
  /** Which way it is heading. */
  dir: Direction;
}

export interface ScrollStep {
  target: number;
  dir: Direction;
}

const EDGE = 3;

/**
 * One automatic move: one card in the current direction; at the end it turns round and heads back,
 * so the cards travel right, then left, then right again.
 */
export function nextScrollStep({ scrollLeft, max, step, dir }: ScrollStepInput): ScrollStep | null {
  if (max <= EDGE * 2 || step <= 0) return null;
  let heading: Direction = dir;
  if (heading === 1 && scrollLeft >= max - EDGE) heading = -1;
  else if (heading === -1 && scrollLeft <= EDGE) heading = 1;
  const target = Math.max(0, Math.min(max, scrollLeft + heading * step));
  return { target, dir: heading };
}

/** Which of `dots` dots is lit for a scroll position (the dots stand for stretches of the track). */
export function activeDot(scrollLeft: number, max: number, dots: number): number {
  if (dots <= 1 || max <= 0) return 0;
  const progress = Math.max(0, Math.min(1, scrollLeft / max));
  return Math.round(progress * (dots - 1));
}

/** Where to scroll to when dot `index` of `dots` is clicked. */
export function dotTarget(index: number, max: number, dots: number): number {
  if (dots <= 1 || max <= 0) return 0;
  return Math.round((Math.max(0, Math.min(dots - 1, index)) / (dots - 1)) * max);
}

/** The card nearest the left edge of the track, which is the one drawn as the current one. */
export function nearestCard(offsets: number[], scrollLeft: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  offsets.forEach((offset, i) => {
    const distance = Math.abs(offset - scrollLeft);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}
