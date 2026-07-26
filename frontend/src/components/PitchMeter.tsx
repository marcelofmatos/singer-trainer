// frontend/src/components/PitchMeter.tsx
import {
  CHROMATIC_NOTE_COLORS,
  CHROMATIC_NOTE_NAMES,
  DEGREES_PER_SEMITONE,
  angleForPitch,
  pitchClassIndex,
  pointOnCircle,
  readableTextColor,
} from '../lib/chromaticWheel';
import { tuningStatus } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';

export interface PitchMeterProps {
  detectedNote: NoteInfo | null;
  /** The exercise's current target note, if one is playing. */
  targetMidiNumber: number | null;
}

const VIEWBOX_SIZE = 240;
const CENTER = { x: VIEWBOX_SIZE / 2, y: VIEWBOX_SIZE / 2 };
const WHEEL_RADIUS = 90;
const BUBBLE_RADIUS = 22;
const INDICATOR_RADIUS = 10;

const STATUS_COLORS = {
  'in-tune': '#2ecc71',
  close: '#f1c40f',
  off: '#e74c3c',
} as const;

export function PitchMeter({ detectedNote, targetMidiNumber }: PitchMeterProps) {
  const targetPitchClass = targetMidiNumber !== null ? pitchClassIndex(targetMidiNumber) : null;

  // Cents relative to the exercise's target note (if any), otherwise relative to the
  // nearest chromatic note — drives the indicator's color only, not its position.
  const cents =
    detectedNote && targetMidiNumber !== null
      ? (detectedNote.midiNumber - targetMidiNumber) * 100 + detectedNote.cents
      : (detectedNote?.cents ?? 0);
  const status = detectedNote ? tuningStatus(cents) : null;

  // The indicator's position is always the *absolute* sung pitch (its own pitch class
  // plus its own cents) — this is what makes it slide continuously around the wheel.
  const indicatorPosition = detectedNote
    ? pointOnCircle(angleForPitch(detectedNote.midiNumber, detectedNote.cents), WHEEL_RADIUS, CENTER)
    : null;

  return (
    <svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} width="100%" role="img" aria-label="Roda cromática de afinação">
      {CHROMATIC_NOTE_NAMES.map((name, index) => {
        const { x, y } = pointOnCircle(index * DEGREES_PER_SEMITONE, WHEEL_RADIUS, CENTER);
        const isTarget = targetPitchClass === index;
        const color = CHROMATIC_NOTE_COLORS[index];
        return (
          <g key={name} data-testid={`note-bubble-${name}`} data-active={isTarget ? 'true' : 'false'}>
            {isTarget && (
              <>
                <circle cx={x} cy={y} r={BUBBLE_RADIUS + 6} fill="none" stroke="#ffffff" strokeWidth={2} />
                <circle cx={x} cy={y} r={BUBBLE_RADIUS + 4} fill="none" stroke="#000000" strokeWidth={2} />
              </>
            )}
            <circle cx={x} cy={y} r={BUBBLE_RADIUS} fill={color} />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={readableTextColor(color)}
              fontSize="14"
            >
              {name}
            </text>
          </g>
        );
      })}
      {indicatorPosition && status && (
        <g data-testid="live-indicator" data-status={status}>
          <circle
            cx={indicatorPosition.x}
            cy={indicatorPosition.y}
            r={INDICATOR_RADIUS + 2}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
          />
          <circle
            cx={indicatorPosition.x}
            cy={indicatorPosition.y}
            r={INDICATOR_RADIUS}
            fill={STATUS_COLORS[status]}
            stroke="#000000"
            strokeWidth={1.5}
          />
        </g>
      )}
    </svg>
  );
}
