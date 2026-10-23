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

export interface RollGeometry {
  low: number;
  high: number;
  rowHeight: number;
  /** Width in ms of a sample with no predecessor. */
  tickMs: number;
  /** Leftmost x a block may start at. */
  left: number;
  x: (time: number) => number;
}

export interface VoiceBlock {
  x: number;
  width: number;
  y: number;
  height: number;
  status: TuningStatus;
}

const STROKE = 2.5;

/**
 * One block per voiced, in-range sample, spanning from the previous sample to it. With `fill` 0 it is a
 * stroke-thin strip at the exact pitch; with 1 it fills the row of the rounded note, where neighbouring
 * blocks of one row and status merge into a single block.
 */
export function voiceBlocks(samples: RollSample[], fill: number, geometry: RollGeometry): VoiceBlock[] {
  const { low, high, rowHeight, tickMs, left, x } = geometry;
  const y = (midi: number) => (high - midi) * rowHeight + rowHeight / 2;
  const height = STROKE + fill * (rowHeight - STROKE);
  const blocks: VoiceBlock[] = [];
  let previous: { index: number; row: number } | null = null; // the sample that produced the last block
  samples.forEach((entry, index) => {
    const { voice, status } = entry;
    if (voice === null || status === null || voice < low || voice > high) return;
    const row = Math.round(voice);
    const start = Math.max(left, x(samples[index - 1]?.time ?? entry.time - tickMs));
    const end = x(entry.time);
    const last = blocks[blocks.length - 1];
    if (fill === 1 && previous?.index === index - 1 && previous.row === row && last.status === status) {
      last.width = end - last.x;
    } else {
      const center = y(voice) * (1 - fill) + y(row) * fill;
      blocks.push({ x: start, width: end - start, y: center - height / 2, height, status });
    }
    previous = { index, row };
  });
  return blocks;
}
