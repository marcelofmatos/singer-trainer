// frontend/src/components/PitchMeter.tsx
import { useEffect, useRef, useState } from 'react';
import {
  CHROMATIC_NOTE_COLORS,
  CHROMATIC_NOTE_NAMES,
  DEGREES_PER_SEMITONE,
  angleForPitch,
  pitchClassIndex,
  pointOnCircle,
  readableTextColor,
} from '../lib/chromaticWheel';
import { advanceTrail } from '../lib/indicatorTrail';
import { STATUS_COLORS, statusForNote, type TuningStatus } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';

export interface PitchMeterProps {
  detectedNote: NoteInfo | null;
  /** The exercise's current target note, if one is playing. */
  targetMidiNumber: number | null;
  /** True when the microphone stream failed or permission was denied. */
  micDisconnected: boolean;
  /** Called with the pitch class index (0=C .. 11=B) when a bubble is clicked or activated via keyboard. */
  onNoteClick?: (pitchClassIndex: number) => void;
}

interface TrailPoint {
  id: number;
  x: number;
  y: number;
  status: TuningStatus;
}

const VIEWBOX_SIZE = 240;
const CENTER = { x: VIEWBOX_SIZE / 2, y: VIEWBOX_SIZE / 2 };
const WHEEL_RADIUS = 90;
const BUBBLE_RADIUS = 22;
const RING_RADIUS = 20;
const RING_STROKE_WIDTH = 5;
const TRAIL_LENGTH = 6; // ~300ms tail at TRAIL_TICK_MS
const TRAIL_TICK_MS = 50; // matches the pitch tracker's own detection cadence

export function PitchMeter({
  detectedNote,
  targetMidiNumber,
  micDisconnected,
  onNoteClick,
}: PitchMeterProps) {
  const targetPitchClass = targetMidiNumber !== null ? pitchClassIndex(targetMidiNumber) : null;

  const status = statusForNote(detectedNote, targetMidiNumber);

  // The indicator's position is always the *absolute* sung pitch (its own pitch class
  // plus its own cents) — this is what makes it slide continuously around the wheel.
  const indicatorPosition = detectedNote
    ? pointOnCircle(angleForPitch(detectedNote.midiNumber, detectedNote.cents), WHEEL_RADIUS, CENTER)
    : null;

  // Kept in sync with the latest render's computed position/status, read from inside
  // the trail's own tick interval below (not from React's render cycle directly) —
  // this is what lets the trail keep aging out smoothly during silence instead of
  // getting stuck partway faded or risking a render loop tied to prop changes.
  const currentPositionRef = useRef<{ x: number; y: number; status: TuningStatus } | null>(null);
  useEffect(() => {
    currentPositionRef.current =
      indicatorPosition && status ? { x: indicatorPosition.x, y: indicatorPosition.y, status } : null;
  });

  const nextTrailIdRef = useRef(0);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  useEffect(() => {
    const intervalId = setInterval(() => {
      const current = currentPositionRef.current;
      const point: TrailPoint | null = current ? { id: nextTrailIdRef.current++, ...current } : null;
      setTrail((prev) => advanceTrail(prev, point, TRAIL_LENGTH));
    }, TRAIL_TICK_MS);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} width="100%" role="img" aria-label="Roda cromática de afinação">
      {CHROMATIC_NOTE_NAMES.map((name, index) => {
        const { x, y } = pointOnCircle(index * DEGREES_PER_SEMITONE, WHEEL_RADIUS, CENTER);
        const isTarget = targetPitchClass === index;
        const color = CHROMATIC_NOTE_COLORS[index];
        return (
          <g
            key={name}
            data-testid={`note-bubble-${name}`}
            data-active={isTarget ? 'true' : 'false'}
            role={onNoteClick ? 'button' : undefined}
            tabIndex={onNoteClick ? 0 : undefined}
            style={onNoteClick ? { cursor: 'pointer' } : undefined}
            onClick={onNoteClick ? () => onNoteClick(index) : undefined}
            onKeyDown={
              onNoteClick
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onNoteClick(index);
                    }
                  }
                : undefined
            }
          >
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
      {trail.map((point, index) => (
        <circle
          key={point.id}
          data-testid={index === trail.length - 1 ? 'live-indicator' : 'live-indicator-trail'}
          data-status={point.status}
          cx={point.x}
          cy={point.y}
          r={RING_RADIUS}
          fill="none"
          stroke={STATUS_COLORS[point.status]}
          strokeWidth={RING_STROKE_WIDTH}
          opacity={(index + 1) / trail.length}
        />
      ))}
      {micDisconnected ? (
        <text
          data-testid="mic-disconnected-icon"
          x={CENTER.x}
          y={CENTER.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="32"
          aria-hidden="true"
        >
          🎤🚫
        </text>
      ) : (
        detectedNote &&
        status && (
          <text
            data-testid="center-note-label"
            x={CENTER.x}
            y={CENTER.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-display)"
            fontSize="28"
            fontWeight={600}
            fill={STATUS_COLORS[status]}
            aria-hidden="true"
          >
            {detectedNote.noteName}
            {detectedNote.octave}
          </text>
        )
      )}
    </svg>
  );
}
