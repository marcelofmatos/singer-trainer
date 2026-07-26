export type TuningStatus = 'in-tune' | 'close' | 'off';

/** Maps a cents deviation to a 0-100 horizontal gauge position (50 = perfectly in tune). */
export function centsToGaugePercent(cents: number, maxCents = 50): number {
  const clamped = Math.max(-maxCents, Math.min(maxCents, cents));
  return ((clamped + maxCents) / (2 * maxCents)) * 100;
}

/** Classifies a cents deviation into a tuning status for color-coding the UI. */
export function tuningStatus(cents: number): TuningStatus {
  const abs = Math.abs(cents);
  if (abs <= 10) return 'in-tune';
  if (abs <= 25) return 'close';
  return 'off';
}
