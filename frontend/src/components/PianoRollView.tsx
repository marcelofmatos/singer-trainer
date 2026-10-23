import { useEffect, useRef, useState } from 'react';
import { CHROMATIC_NOTE_COLORS, pitchClassIndex, readableTextColor } from '../lib/chromaticWheel';
import { appendSample, pitchRange, voiceBlocks, type RollSample } from '../lib/pianoRoll';
import { STATUS_COLORS, statusForPitch } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';
import { SungNoteReadout } from './SungNoteReadout';
import { noteLabel } from './TunerView';

export interface PianoRollViewProps {
  detectedNote: NoteInfo | null;
  targetMidiNumber: number | null;
  micDisconnected: boolean;
  /** How much of its note row each voice block fills, 0 (thin line at the exact pitch) to 1 (whole row). */
  fill?: number;
}

const WINDOW_MS = 6000;
const TICK_MS = 50; // the tracker's own detection cadence
const WIDTH = 360;
const HEIGHT = 260;
const LABEL_WIDTH = 34;
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);
const LABEL_FONT_SIZE = 11;

/**
 * Rows to label at a fixed font size without labels touching: Cs first (an octave apart, so they always fit),
 * then natural notes, then sharps, each kept only if it is at least one font height from every label so far.
 */
function labeledRows(rows: number[], rowHeight: number, fontSize: number): Set<number> {
  const priority = (midi: number) =>
    pitchClassIndex(midi) === 0 ? 0 : BLACK_PITCH_CLASSES.has(pitchClassIndex(midi)) ? 2 : 1;
  const labeled = new Set<number>();
  for (const midi of [...rows].sort((a, b) => priority(a) - priority(b) || a - b)) {
    if ([...labeled].every((other) => Math.abs(other - midi) * rowHeight >= fontSize)) labeled.add(midi);
  }
  return labeled;
}

/** Pitch over time: target as bars, voice as blocks colored by tuning, last 6 seconds. */
export function PianoRollView({ detectedNote, targetMidiNumber, micDisconnected, fill = 1 }: PianoRollViewProps) {
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


  // Consecutive samples with the same target form one bar.
  const targetBars: { start: number; end: number; midi: number }[] = [];
  samples.forEach((entry, index) => {
    if (entry.target !== null) {
      const last = targetBars[targetBars.length - 1];
      if (last && last.midi === entry.target && samples[index - 1]?.target === entry.target) last.end = entry.time;
      else targetBars.push({ start: entry.time, end: entry.time, midi: entry.target });
    }
  });
  const blocks = voiceBlocks(samples, fill, { low, high, rowHeight, tickMs: TICK_MS, left: LABEL_WIDTH, x });

  const rows = Array.from({ length: high - low + 1 }, (_, index) => high - index);
  const labeled = labeledRows(rows, rowHeight, LABEL_FONT_SIZE);

  return (
    <div className={micDisconnected ? 'piano-roll-view is-disconnected' : 'piano-roll-view'}>
      <SungNoteReadout
        detectedNote={detectedNote}
        targetMidiNumber={targetMidiNumber}
        micDisconnected={micDisconnected}
      />
      <svg className="piano-roll" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Piano-roll">
        {rows.map((midi) => (
          <g key={midi}>
            <rect
              data-testid={`roll-row-${midi}`}
              x={LABEL_WIDTH}
              y={y(midi) - rowHeight / 2}
              width={WIDTH - LABEL_WIDTH}
              height={rowHeight}
              fill={BLACK_PITCH_CLASSES.has(pitchClassIndex(midi)) ? 'rgba(255,255,255,0.03)' : 'transparent'}
            />
            <rect
              data-testid={`roll-legend-${midi}`}
              x={0}
              y={y(midi) - rowHeight / 2}
              width={LABEL_WIDTH}
              height={rowHeight}
              fill={CHROMATIC_NOTE_COLORS[pitchClassIndex(midi)]}
            />
            {labeled.has(midi) && (
              <text
                x={3}
                y={y(midi)}
                dominantBaseline="central"
                fontSize={LABEL_FONT_SIZE}
                fontWeight={pitchClassIndex(midi) === 0 ? 700 : 500}
                fill={readableTextColor(CHROMATIC_NOTE_COLORS[pitchClassIndex(midi)])}
              >
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
        {blocks.map((block, index) => (
          <rect
            // Stateless rects: a positional key is enough, and x alone can repeat when the first block is clamped.
            key={index}
            data-testid="roll-voice"
            data-status={block.status}
            x={block.x}
            y={block.y}
            width={block.width}
            height={block.height}
            fill={STATUS_COLORS[block.status]}
          />
        ))}
      </svg>
    </div>
  );
}
