import type { TuningStatus } from './tuningGauge';

export interface RollSample {
  /** Milliseconds (monotonic). */
  time: number;
  /** Sung pitch as a fractional MIDI number (midi + cents/100), null in silence. */
  voice: number | null;
  target: number | null;
  status: TuningStatus | null;
}

export function appendSample(samples: RollSample[], sample: RollSample, windowMs: number): RollSample[] {
  return [...samples, sample].filter((entry) => entry.time >= sample.time - windowMs);
}

const MARGIN = 2;
const MIN_SPAN = 12;

/** Integer MIDI range covering every voice/target value with margin, at least MIN_SPAN tall. */
export function pitchRange(samples: RollSample[]): { low: number; high: number } {
  const values = samples.flatMap((entry) => [entry.voice, entry.target]).filter((value): value is number => value !== null);
  if (values.length === 0) return { low: 60, high: 72 };
  let low = Math.floor(Math.min(...values)) - MARGIN;
  let high = Math.ceil(Math.max(...values)) + MARGIN;
  if (high - low < MIN_SPAN) {
    const extra = MIN_SPAN - (high - low);
    low -= Math.floor(extra / 2);
    high += Math.ceil(extra / 2);
  }
  return { low, high };
}
