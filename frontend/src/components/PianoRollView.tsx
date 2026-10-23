import { useEffect, useRef, useState } from 'react';
import { pitchClassIndex } from '../lib/chromaticWheel';
import { appendSample, pitchRange, type RollSample } from '../lib/pianoRoll';
import { STATUS_COLORS, statusForPitch } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';
import { noteLabel } from './TunerView';

export interface PianoRollViewProps {
  detectedNote: NoteInfo | null;
  targetMidiNumber: number | null;
  micDisconnected: boolean;
}

const WINDOW_MS = 6000;
const TICK_MS = 50; // the tracker's own detection cadence
const WIDTH = 360;
const HEIGHT = 200;
const LABEL_WIDTH = 28;
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

/** Pitch over time: target as bars, voice as a line colored by tuning, last 6 seconds. */
export function PianoRollView({ detectedNote, targetMidiNumber, micDisconnected }: PianoRollViewProps) {
  const latestRef = useRef({ detectedNote, targetMidiNumber });
  useEffect(() => {
    latestRef.current = { detectedNote, targetMidiNumber };
  });

  const [samples, setSamples] = useState<RollSample[]>([]);
  useEffect(() => {
    const startedAt = Date.now();
    const intervalId = setInterval(() => {
      const { detectedNote: note, targetMidiNumber: target } = latestRef.current;
      const sample: RollSample = {
        time: Date.now() - startedAt,
        voice: note ? note.midiNumber + note.cents / 100 : null,
        target,
        status: statusForPitch(note, target),
      };
      setSamples((current) => appendSample(current, sample, WINDOW_MS));
    }, TICK_MS);
    return () => clearInterval(intervalId);
  }, []);

  const { low, high } = pitchRange(samples);
  const rowHeight = HEIGHT / (high - low + 1);
  const now = samples.length > 0 ? samples[samples.length - 1].time : 0;
  const x = (time: number) => LABEL_WIDTH + ((time - (now - WINDOW_MS)) / WINDOW_MS) * (WIDTH - LABEL_WIDTH);
  const y = (midi: number) => (high - midi) * rowHeight + rowHeight / 2;

  const isVisible = (entry: RollSample) => entry.voice !== null && entry.voice >= low && entry.voice <= high;

  // Consecutive samples with the same target form one bar; voice runs break on silence, out-of-range pitches and status changes.
  const targetBars: { start: number; end: number; midi: number }[] = [];
  const voiceRuns: RollSample[][] = []; // consecutive in-range samples with one status
  samples.forEach((entry, index) => {
    if (entry.target !== null) {
      const last = targetBars[targetBars.length - 1];
      if (last && last.midi === entry.target && samples[index - 1]?.target === entry.target) last.end = entry.time;
      else targetBars.push({ start: entry.time, end: entry.time, midi: entry.target });
    }
    if (isVisible(entry)) {
      const previous = samples[index - 1];
      const run = voiceRuns[voiceRuns.length - 1];
      if (previous && isVisible(previous) && previous.status === entry.status) run.push(entry);
      else if (previous && isVisible(previous)) voiceRuns.push([previous, entry]); // repeat the boundary point: no gap
      else voiceRuns.push([entry]);
    }
  });

  const rows = Array.from({ length: high - low + 1 }, (_, index) => high - index);

  return (
    <svg
      className={micDisconnected ? 'piano-roll is-disconnected' : 'piano-roll'}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-label="Piano-roll"
    >
      {rows.map((midi) => (
        <g key={midi}>
          <rect
            x={LABEL_WIDTH}
            y={y(midi) - rowHeight / 2}
            width={WIDTH - LABEL_WIDTH}
            height={rowHeight}
            fill={BLACK_PITCH_CLASSES.has(pitchClassIndex(midi)) ? 'rgba(255,255,255,0.03)' : 'transparent'}
          />
          {pitchClassIndex(midi) === 0 && (
            <text x={2} y={y(midi)} dominantBaseline="central" fontSize="9" fill="var(--color-text-muted)">
              {noteLabel(midi)}
            </text>
          )}
        </g>
      ))}
      {targetBars.map((bar) => (
        <rect
          key={`${bar.start}-${bar.midi}`}
          data-testid="roll-target"
          x={x(bar.start)}
          y={y(bar.midi) - rowHeight / 2}
          width={Math.max(2, x(bar.end) - x(bar.start))}
          height={rowHeight}
          rx={2}
          fill="var(--color-accent-soft)"
          stroke="var(--color-accent)"
          strokeWidth={1}
        />
      ))}
      {voiceRuns.map((run) => {
        const status = run[run.length - 1].status;
        const color = status ? STATUS_COLORS[status] : '#ffffff';
        // A run may start with the previous run's last point, but each sample ends at most one run.
        const key = run[run.length - 1].time;
        return run.length === 1 ? (
          <circle
            key={key}
            data-testid="roll-voice"
            data-status={status ?? undefined}
            cx={x(run[0].time)}
            cy={y(run[0].voice!)}
            r={2}
            fill={color}
          />
        ) : (
          <polyline
            key={key}
            data-testid="roll-voice"
            data-status={status ?? undefined}
            points={run.map((entry) => `${x(entry.time)},${y(entry.voice!)}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
