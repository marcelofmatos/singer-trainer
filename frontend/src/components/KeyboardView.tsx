// frontend/src/components/KeyboardView.tsx
import { forwardRef, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react';
import { pitchClassIndex } from '../lib/chromaticWheel';
import { STATUS_COLORS, statusForPitch } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';
import type { NoteNavigatorHandle } from './PitchMeter';
import { noteLabel } from './TunerView';

export interface KeyboardViewProps {
  /** MIDI number of the lowest key (a C). */
  lowMidi: number;
  detectedNote: NoteInfo | null;
  targetMidiNumber: number | null;
  micDisconnected: boolean;
  onPlayNote: (midiNumber: number) => void;
}

const KEY_COUNT = 24;
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);
const WHITE_KEY_WIDTH = 20;
const BLACK_KEY_WIDTH = 12;
const WHITE_KEY_HEIGHT = 80;
const BLACK_KEY_HEIGHT = 50;

function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)} ¢`;
}

/** Two-octave piano keyboard: target key outlined, sung key lit in the tuning color. */
export const KeyboardView = forwardRef<NoteNavigatorHandle, KeyboardViewProps>(function KeyboardView(
  { lowMidi, detectedNote, targetMidiNumber, micDisconnected, onPlayNote },
  ref
) {
  const keys = Array.from({ length: KEY_COUNT }, (_, index) => lowMidi + index);
  const highMidi = lowMidi + KEY_COUNT - 1;
  const status = statusForPitch(detectedNote, targetMidiNumber);
  const sungMidi = detectedNote?.midiNumber ?? null;
  const outOfRange = sungMidi !== null && (sungMidi < lowMidi || sungMidi > highMidi);

  const [focusableIndex, setFocusableIndex] = useState(0);
  const keyRefs = useRef<(SVGGElement | null)[]>([]);

  function moveFocus(index: number) {
    setFocusableIndex(index);
    keyRefs.current[index]?.focus();
  }

  useImperativeHandle(ref, () => ({
    navigate(direction) {
      if (direction === 'first') {
        moveFocus(0);
        return;
      }
      const focusedIndex = keyRefs.current.findIndex((key) => key !== null && key === document.activeElement);
      if (focusedIndex === -1) {
        moveFocus(focusableIndex);
        return;
      }
      moveFocus((focusedIndex + (direction === 'next' ? 1 : KEY_COUNT - 1)) % KEY_COUNT);
    },
  }));

  function handleKeyDown(event: KeyboardEvent, midi: number) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    onPlayNote(midi);
  }

  // White keys are laid out left to right; black keys sit over the boundary to their left.
  let whiteIndex = -1;
  const layout = keys.map((midi) => {
    const black = BLACK_PITCH_CLASSES.has(pitchClassIndex(midi));
    if (!black) whiteIndex += 1;
    const x = black ? (whiteIndex + 1) * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2 : whiteIndex * WHITE_KEY_WIDTH;
    return { midi, black, x };
  });
  const width = (whiteIndex + 1) * WHITE_KEY_WIDTH;
  const targetKey = layout.find((key) => key.midi === targetMidiNumber);
  const ordered = [...layout.filter((key) => !key.black), ...layout.filter((key) => key.black)];

  return (
    <div className={micDisconnected ? 'keyboard-view is-disconnected' : 'keyboard-view'}>
      <div className="keyboard-readout">
        {outOfRange && sungMidi !== null && (
          <span data-testid="keyboard-out-of-range">
            {sungMidi < lowMidi ? `◀ ${noteLabel(sungMidi)}` : `${noteLabel(sungMidi)} ▶`}
          </span>
        )}
        <span data-testid="keyboard-cents">{detectedNote ? formatCents(detectedNote.cents) : ''}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${WHITE_KEY_HEIGHT}`} width="100%" aria-label="Teclado">
        {ordered.map(({ midi, black, x }) => {
          const index = midi - lowMidi;
          const lit = !outOfRange && sungMidi === midi && status !== null;
          const isTarget = targetMidiNumber === midi;
          return (
            <g
              key={midi}
              ref={(element) => {
                keyRefs.current[index] = element;
              }}
              role="button"
              tabIndex={index === focusableIndex ? 0 : -1}
              aria-label={noteLabel(midi)}
              data-target={isTarget ? 'true' : undefined}
              data-status={lit ? status : undefined}
              onClick={() => onPlayNote(midi)}
              onFocus={() => setFocusableIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, midi)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={x}
                y={0}
                width={black ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH}
                height={black ? BLACK_KEY_HEIGHT : WHITE_KEY_HEIGHT}
                rx={2}
                fill={lit && status ? STATUS_COLORS[status] : black ? '#1e1a17' : '#f2ece4'}
                stroke="#14110f"
                strokeWidth={1}
              />
            </g>
          );
        })}
        {/* Drawn after every key so neighbouring keys can't cover the outline. */}
        {targetKey && (
          <rect
            data-testid="keyboard-target-outline"
            x={targetKey.x}
            y={0}
            width={targetKey.black ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH}
            height={targetKey.black ? BLACK_KEY_HEIGHT : WHITE_KEY_HEIGHT}
            rx={2}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={3}
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  );
});
