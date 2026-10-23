// frontend/src/components/KeyboardView.tsx
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react';
import { isBlackKey, keyboardOffsetPercent } from '../lib/keyboardWindow';
import { STATUS_COLORS, statusForPitch } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';
import type { NoteNavigatorHandle } from './PitchMeter';
import { noteLabel } from './TunerView';

export interface KeyboardViewProps {
  detectedNote: NoteInfo | null;
  targetMidiNumber: number | null;
  micDisconnected: boolean;
  onPlayNote: (midiNumber: number) => void;
}

const LOW_MIDI = 36; // C2
const HIGH_MIDI = 84; // C6
const KEY_COUNT = HIGH_MIDI - LOW_MIDI + 1;
const INITIAL_FOCUS_MIDI = 60; // C4
const WHITE_KEY_WIDTH = 20;
const BLACK_KEY_WIDTH = 12;
const WHITE_KEY_HEIGHT = 80;
const BLACK_KEY_HEIGHT = 50;

function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)} ¢`;
}

// White keys are laid out left to right; black keys sit over the boundary to their left.
let whiteIndex = -1;
const LAYOUT = Array.from({ length: KEY_COUNT }, (_, index) => {
  const midi = LOW_MIDI + index;
  const black = isBlackKey(midi);
  if (!black) whiteIndex += 1;
  const x = black ? (whiteIndex + 1) * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2 : whiteIndex * WHITE_KEY_WIDTH;
  return { midi, black, x };
});
const WIDTH = (whiteIndex + 1) * WHITE_KEY_WIDTH;
const ORDERED = [...LAYOUT.filter((key) => !key.black), ...LAYOUT.filter((key) => key.black)];

/**
 * Full-range (C2–C6) piano keyboard seen through a two-octave window that slides to keep
 * the focus note centered: target key outlined, sung key lit, sung note shown on top.
 */
export const KeyboardView = forwardRef<NoteNavigatorHandle, KeyboardViewProps>(function KeyboardView(
  { detectedNote, targetMidiNumber, micDisconnected, onPlayNote },
  ref
) {
  const status = statusForPitch(detectedNote, targetMidiNumber);
  const sungMidi = detectedNote?.midiNumber ?? null;
  const outOfRange = sungMidi !== null && (sungMidi < LOW_MIDI || sungMidi > HIGH_MIDI);

  const [focusableIndex, setFocusableIndex] = useState(INITIAL_FOCUS_MIDI - LOW_MIDI);
  const [focusedMidi, setFocusedMidi] = useState<number | null>(null);
  const lastFocusMidi = useRef(INITIAL_FOCUS_MIDI);
  const keyRefs = useRef<(SVGGElement | null)[]>([]);

  const focusMidi = focusedMidi ?? targetMidiNumber ?? sungMidi ?? lastFocusMidi.current;
  useEffect(() => {
    lastFocusMidi.current = focusMidi;
  }, [focusMidi]);
  const offset = keyboardOffsetPercent(focusMidi, LOW_MIDI, HIGH_MIDI);

  function moveFocus(index: number) {
    setFocusableIndex(index);
    keyRefs.current[index]?.focus();
  }

  useImperativeHandle(ref, () => ({
    navigate(direction) {
      if (direction === 'first') {
        moveFocus(INITIAL_FOCUS_MIDI - LOW_MIDI);
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

  const targetKey = LAYOUT.find((key) => key.midi === targetMidiNumber);

  return (
    <div className={micDisconnected ? 'keyboard-view is-disconnected' : 'keyboard-view'}>
      <div className="keyboard-readout">
        <span className="keyboard-out-of-range-slot">
          {outOfRange && sungMidi < LOW_MIDI && (
            <span data-testid="keyboard-out-of-range">{`◀ ${noteLabel(sungMidi)}`}</span>
          )}
        </span>
        <div className="keyboard-center">
          {micDisconnected ? (
            <span data-testid="mic-disconnected-icon" className="keyboard-center-note" aria-hidden="true">
              🎤🚫
            </span>
          ) : (
            <span
              data-testid="keyboard-center-note"
              className="keyboard-center-note"
              style={status ? { color: STATUS_COLORS[status] } : undefined}
            >
              {detectedNote ? noteLabel(detectedNote.midiNumber) : ''}
            </span>
          )}
          <span data-testid="keyboard-cents" className="keyboard-cents">
            {detectedNote && !micDisconnected ? formatCents(detectedNote.cents) : ''}
          </span>
        </div>
        <span className="keyboard-out-of-range-slot">
          {outOfRange && sungMidi > HIGH_MIDI && (
            <span data-testid="keyboard-out-of-range">{`${noteLabel(sungMidi)} ▶`}</span>
          )}
        </span>
      </div>
      <div className="keyboard-window">
        <svg
          data-testid="keyboard-keys"
          data-offset={String(Math.round(offset * 100) / 100)}
          className="keyboard-keys"
          style={{ transform: `translateX(${offset}%)` }}
          viewBox={`0 0 ${WIDTH} ${WHITE_KEY_HEIGHT}`}
          aria-label="Teclado"
        >
          {ORDERED.map(({ midi, black, x }) => {
            const index = midi - LOW_MIDI;
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
                onFocus={() => {
                  setFocusableIndex(index);
                  setFocusedMidi(midi);
                }}
                onBlur={() => setFocusedMidi(null)}
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
    </div>
  );
});
