/**
 * Advances a fixed-length trail of recent values by one tick: appends `next` and caps
 * the trail at `maxLength` when there's a new value, or drops the oldest entry when
 * there isn't (letting an existing trail fade out gracefully instead of vanishing) —
 * returns the same array reference when there's nothing left to age out, so callers
 * relying on reference equality (e.g. React state) can bail out of re-rendering.
 */
export function advanceTrail<T>(prev: T[], next: T | null, maxLength: number): T[] {
  if (next !== null) {
    return [...prev, next].slice(-maxLength);
  }
  if (prev.length === 0) return prev;
  return prev.slice(1);
}
