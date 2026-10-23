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

const SINGING_MIN = 36; // C2
const SINGING_MAX = 84; // C6

/**
 * Integer MIDI range with margin, at least MIN_SPAN tall. Targets are always included; the voice
 * contributes its 10th-90th percentile within a plausible singing range, so noise detections
 * (absurd or stray pitches) don't stretch the view.
 */
export function pitchRange(samples: RollSample[]): { low: number; high: number } {
  const voice = samples
    .map((entry) => entry.voice)
    .filter((value): value is number => value !== null && value >= SINGING_MIN && value <= SINGING_MAX)
    .sort((a, b) => a - b);
  const trimmed = voice.slice(Math.floor(voice.length * 0.1), Math.ceil(voice.length * 0.9));
  const values = [...trimmed, ...samples.map((entry) => entry.target).filter((value): value is number => value !== null)];
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
