import { pitchClassIndex } from './chromaticWheel';

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

export function isBlackKey(midi: number): boolean {
  return BLACK_PITCH_CLASSES.has(pitchClassIndex(midi));
}

function whiteKeysBetween(low: number, high: number): number {
  let count = 0;
  for (let midi = low; midi <= high; midi += 1) if (!isBlackKey(midi)) count += 1;
  return count;
}

/**
 * translateX percentage (of the full keyboard width) that centers the focus key in a window
 * of `visibleWhiteKeys` white keys, clamped so the window never goes past either end.
 */
export function keyboardOffsetPercent(focusMidi: number, low = 36, high = 84, visibleWhiteKeys = 14): number {
  const totalWhite = whiteKeysBetween(low, high);
  const clampedMidi = Math.max(low, Math.min(high, focusMidi));
  // In white-key units: a white key's center, or the boundary a black key sits over.
  const whitesUpTo = whiteKeysBetween(low, clampedMidi);
  const centerX = isBlackKey(clampedMidi) ? whitesUpTo : whitesUpTo - 0.5;
  const left = Math.max(0, Math.min(totalWhite - visibleWhiteKeys, centerX - visibleWhiteKeys / 2));
  return left === 0 ? 0 : (-left / totalWhite) * 100;
}
