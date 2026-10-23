import { STATUS_COLORS, statusForNote } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';

export interface WaveformProps {
  /** Rolling window of downsampled signed amplitude values, oldest first, range [-1, 1]. */
  samples: number[];
  detectedNote: NoteInfo | null;
  targetMidiNumber: number | null;
  micDisconnected: boolean;
}

const HEIGHT = 80;
const DISPLAY_PEAK = 0.9;
const NOISE_FLOOR = 0.02;
const NEUTRAL_COLOR = '#a89e93'; // --color-text-muted

export function Waveform({ samples, detectedNote, targetMidiNumber, micDisconnected }: WaveformProps) {
  const status = statusForNote(detectedNote, targetMidiNumber);
  const color = status ? STATUS_COLORS[status] : NEUTRAL_COLOR;
  const width = Math.max(samples.length - 1, 1);

  const maxAbs = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  const gain = DISPLAY_PEAK / Math.max(maxAbs, NOISE_FLOOR);
  const scaled = (value: number) => Math.max(-1, Math.min(1, value * gain));

  const points =
    micDisconnected || samples.length === 0
      ? ''
      : samples.map((value, index) => `${index},${(HEIGHT / 2 - scaled(value) * (HEIGHT / 2)).toFixed(2)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${HEIGHT}`}
      width="100%"
      preserveAspectRatio="none"
      role="img"
      aria-label="Forma de onda da voz"
    >
      <polyline data-testid="waveform-trace" points={points} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}
