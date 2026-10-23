# Modos de visualização — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seletor de visualização (Roda — padrão —, Piano-roll, Afinador, Teclado) que vale para todas as faixas, salvo entre sessões e alternável com a tecla V.

**Architecture:** Lógica pura em `visualization.ts` e `tuningGauge.ts` (`statusForPitch`, oitava livre); três componentes de apresentação novos (`TunerView`, `KeyboardView`, `PianoRollView`); `InputLane` escolhe o componente pelo modo; `ExercisePlayer` guarda o modo, mostra o seletor na barra do topo e trata a tecla V.

**Tech Stack:** React 18 + TypeScript, SVG, Vitest + Testing Library (jsdom 25).

**Spec:** `docs/superpowers/specs/2026-10-23-visualization-modes-design.md`

**Convenções do repo:**
- Rodar comandos de dentro de `frontend/` (`npm test`, `npx tsc -b`).
- Commits com a identidade configurada no git, **sem** trailer `Co-Authored-By`.
- Textos de UI em português; código e comentários em inglês.
- `NoteInfo` (`src/lib/noteUtils.ts`) = `{ noteName, octave, midiNumber, cents }`; nomes das notas em `CHROMATIC_NOTE_NAMES` (`src/lib/chromaticWheel.ts`); cores em `STATUS_COLORS` (`src/lib/tuningGauge.ts`).

---

### Task 1: Modo salvo, regra de cor com oitava livre e tecla V

**Files:**
- Create: `frontend/src/lib/visualization.ts`, `frontend/src/lib/visualization.test.ts`
- Modify: `frontend/src/lib/tuningGauge.ts` (+ its test file `tuningGauge.test.ts`)
- Modify: `frontend/src/lib/keyboardShortcuts.ts`, `frontend/src/lib/keyboardShortcuts.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// frontend/src/lib/visualization.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { loadVisualization, nextVisualization, saveVisualization, VISUALIZATION_MODES } from './visualization';

describe('visualization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to the wheel', () => {
    expect(loadVisualization()).toBe('wheel');
  });

  it('round-trips a saved mode and ignores invalid values', () => {
    saveVisualization('piano-roll');
    expect(loadVisualization()).toBe('piano-roll');
    localStorage.setItem('singer-trainer:visualization', 'hologram');
    expect(loadVisualization()).toBe('wheel');
  });

  it('cycles through every mode in order', () => {
    expect(VISUALIZATION_MODES.map((mode) => mode.id)).toEqual(['wheel', 'piano-roll', 'tuner', 'keyboard']);
    expect(nextVisualization('wheel')).toBe('piano-roll');
    expect(nextVisualization('keyboard')).toBe('wheel');
  });
});
```

Add to `tuningGauge.test.ts`:

```ts
describe('statusForPitch', () => {
  const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 4, midiNumber, cents });

  it('is null without a detected note', () => {
    expect(statusForPitch(null, 60)).toBeNull();
  });

  it('measures against the target in any octave', () => {
    expect(statusForPitch(note(48, 5), 60)).toBe('in-tune');
    expect(statusForPitch(note(72, 20), 60)).toBe('close');
    expect(statusForPitch(note(61, 0), 60)).toBe('off');
  });

  it('measures against the nearest note without a target', () => {
    expect(statusForPitch(note(65, -8), null)).toBe('in-tune');
    expect(statusForPitch(note(65, 30), null)).toBe('off');
  });
});
```

(import `statusForPitch`). In `keyboardShortcuts.test.ts` add `['v', 'nextView']` to the `it.each` table.

- [ ] **Step 2: Run — expect failures**

Run: `cd frontend && npx vitest run src/lib/visualization.test.ts src/lib/tuningGauge.test.ts src/lib/keyboardShortcuts.test.ts`

- [ ] **Step 3: Implement**

```ts
// frontend/src/lib/visualization.ts
export type VisualizationMode = 'wheel' | 'piano-roll' | 'tuner' | 'keyboard';

export const VISUALIZATION_MODES: { id: VisualizationMode; label: string }[] = [
  { id: 'wheel', label: 'Roda' },
  { id: 'piano-roll', label: 'Piano-roll' },
  { id: 'tuner', label: 'Afinador' },
  { id: 'keyboard', label: 'Teclado' },
];

const STORAGE_KEY = 'singer-trainer:visualization';

function isMode(value: unknown): value is VisualizationMode {
  return VISUALIZATION_MODES.some((mode) => mode.id === value);
}

export function loadVisualization(): VisualizationMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isMode(stored) ? stored : 'wheel';
  } catch {
    return 'wheel';
  }
}

export function saveVisualization(mode: VisualizationMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private browsing / quota exceeded — the choice just won't be remembered.
  }
}

export function nextVisualization(mode: VisualizationMode): VisualizationMode {
  const index = VISUALIZATION_MODES.findIndex((entry) => entry.id === mode);
  return VISUALIZATION_MODES[(index + 1) % VISUALIZATION_MODES.length].id;
}
```

In `tuningGauge.ts`:

```ts
/**
 * Tuning status of a detected note against the target pitch class in any octave (same rule
 * as the score), or against the nearest note when there is no target.
 */
export function statusForPitch(detectedNote: NoteInfo | null, targetMidiNumber: number | null): TuningStatus | null {
  if (!detectedNote) return null;
  if (targetMidiNumber === null) return tuningStatus(detectedNote.cents);
  const semitones = detectedNote.midiNumber - targetMidiNumber;
  const wrapped = ((((semitones % 12) + 18) % 12) - 6);
  return tuningStatus(wrapped * 100 + detectedNote.cents);
}
```

In `keyboardShortcuts.ts`: add `| 'nextView'` to `ShortcutAction`, `v: 'nextView'` to `ACTIONS_BY_KEY`, and `{ keys: 'V', description: 'Trocar a visualização (roda, piano-roll, afinador, teclado)' }` to `SHORTCUT_HELP` after the `H` row.

- [ ] **Step 4: Run tests + tsc**

Run: `cd frontend && npx vitest run src/lib && npx tsc -b`
Expected: PASS (the player's shortcut `switch` has no exhaustiveness check, so `tsc` stays clean).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib
git commit -m "feat: add visualization modes, octave-free tuning status and the V shortcut"
```

---

### Task 2: `TunerView` (afinador cromático)

**Files:**
- Create: `frontend/src/components/TunerView.tsx`, `frontend/src/components/TunerView.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
// frontend/src/components/TunerView.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TunerView } from './TunerView';

const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 0, midiNumber, cents });

describe('TunerView', () => {
  it('shows the sung note with its octave', () => {
    render(<TunerView detectedNote={note(69, 0)} targetMidiNumber={null} micDisconnected={false} />);
    expect(screen.getByTestId('tuner-note').textContent).toBe('A4');
  });

  it('shows a dash without voice', () => {
    render(<TunerView detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    expect(screen.getByTestId('tuner-note').textContent).toBe('—');
    expect(screen.queryByTestId('tuner-needle')).toBeNull();
  });

  it('places the needle by cents from -50 to +50', () => {
    const { rerender } = render(<TunerView detectedNote={note(60, 0)} targetMidiNumber={null} micDisconnected={false} />);
    expect(screen.getByTestId('tuner-needle').getAttribute('data-percent')).toBe('50');
    rerender(<TunerView detectedNote={note(60, -25)} targetMidiNumber={null} micDisconnected={false} />);
    expect(screen.getByTestId('tuner-needle').getAttribute('data-percent')).toBe('25');
    expect(screen.getByTestId('tuner-cents').textContent).toBe('−25 ¢');
  });

  it('colors the needle by the octave-free status against the target', () => {
    render(<TunerView detectedNote={note(48, 3)} targetMidiNumber={60} micDisconnected={false} />);
    expect(screen.getByTestId('tuner-needle').getAttribute('data-status')).toBe('in-tune');
    expect(screen.getByText('Alvo: C4')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — expect failure** (`npx vitest run src/components/TunerView.test.tsx`)

- [ ] **Step 3: Implement**

```tsx
// frontend/src/components/TunerView.tsx
import { CHROMATIC_NOTE_NAMES, pitchClassIndex } from '../lib/chromaticWheel';
import { centsToGaugePercent, STATUS_COLORS, statusForPitch } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';

export interface TunerViewProps {
  detectedNote: NoteInfo | null;
  targetMidiNumber: number | null;
  micDisconnected: boolean;
}

export function noteLabel(midiNumber: number): string {
  return `${CHROMATIC_NOTE_NAMES[pitchClassIndex(midiNumber)]}${Math.floor(midiNumber / 12) - 1}`;
}

function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)} ¢`;
}

/** Classic chromatic tuner: big note name and a ±50 cents needle. */
export function TunerView({ detectedNote, targetMidiNumber, micDisconnected }: TunerViewProps) {
  const status = statusForPitch(detectedNote, targetMidiNumber);
  const percent = detectedNote ? Math.round(centsToGaugePercent(detectedNote.cents)) : null;

  return (
    <div className={micDisconnected ? 'tuner-view is-disconnected' : 'tuner-view'} role="img" aria-label="Afinador cromático">
      <div className="tuner-note" data-testid="tuner-note">
        {detectedNote ? noteLabel(detectedNote.midiNumber) : '—'}
      </div>
      <div className="tuner-scale">
        <span className="tuner-scale-center" />
        {percent !== null && status && (
          <span
            className="tuner-needle"
            data-testid="tuner-needle"
            data-percent={percent}
            data-status={status}
            style={{ left: `${percent}%`, background: STATUS_COLORS[status] }}
          />
        )}
      </div>
      <div className="tuner-legend">
        <span>♭ −50</span>
        <span data-testid="tuner-cents">{detectedNote ? formatCents(detectedNote.cents) : ''}</span>
        <span>+50 ♯</span>
      </div>
      {targetMidiNumber !== null && <div className="tuner-target">Alvo: {noteLabel(targetMidiNumber)}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Run tests + tsc** — PASS.

- [ ] **Step 5: Commit** — `git add frontend/src/components/TunerView.tsx frontend/src/components/TunerView.test.tsx && git commit -m "feat: add a chromatic tuner visualization"`

---

### Task 3: `KeyboardView` (teclado com a tecla acesa)

**Files:**
- Modify: `frontend/src/components/PitchMeter.tsx` (export the shared handle type)
- Create: `frontend/src/components/KeyboardView.tsx`, `frontend/src/components/KeyboardView.test.tsx`

- [ ] **Step 1: Shared handle type** — in `PitchMeter.tsx`, rename the exported `PitchMeterHandle` interface to `NoteNavigatorHandle` and keep `export type PitchMeterHandle = NoteNavigatorHandle;` so existing imports keep compiling.

- [ ] **Step 2: Failing tests**

```tsx
// frontend/src/components/KeyboardView.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { act, createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { KeyboardView } from './KeyboardView';
import type { NoteNavigatorHandle } from './PitchMeter';

const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 0, midiNumber, cents });

function renderKeyboard(overrides: Partial<Parameters<typeof KeyboardView>[0]> = {}) {
  const onPlayNote = vi.fn();
  const ref = createRef<NoteNavigatorHandle>();
  render(
    <KeyboardView
      ref={ref}
      lowMidi={60}
      detectedNote={null}
      targetMidiNumber={null}
      micDisconnected={false}
      onPlayNote={onPlayNote}
      {...overrides}
    />
  );
  return { onPlayNote, ref };
}

describe('KeyboardView', () => {
  it('renders two octaves of keys starting at the given C', () => {
    renderKeyboard();
    const keys = screen.getAllByRole('button');
    expect(keys).toHaveLength(24);
    expect(keys[0].getAttribute('aria-label')).toBe('C4');
    expect(keys[23].getAttribute('aria-label')).toBe('B5');
  });

  it('outlines the target key and lights the sung key with its status and cents', () => {
    renderKeyboard({ targetMidiNumber: 62, detectedNote: note(62, 12) });
    expect(screen.getByRole('button', { name: 'D4' }).getAttribute('data-target')).toBe('true');
    expect(screen.getByRole('button', { name: 'D4' }).getAttribute('data-status')).toBe('close');
    expect(screen.getByTestId('keyboard-cents').textContent).toBe('+12 ¢');
  });

  it('points to a sung note outside the keyboard instead of lighting a key', () => {
    renderKeyboard({ detectedNote: note(43, 0) });
    expect(screen.getByTestId('keyboard-out-of-range').textContent).toBe('◀ G2');
    expect(screen.getAllByRole('button').some((key) => key.hasAttribute('data-status'))).toBe(false);
  });

  it('plays the clicked key in its own octave', () => {
    const { onPlayNote } = renderKeyboard();
    fireEvent.click(screen.getByRole('button', { name: 'A5' }));
    expect(onPlayNote).toHaveBeenCalledWith(81);
  });

  it('is navigable through the same handle as the wheel', () => {
    const { ref, onPlayNote } = renderKeyboard();
    act(() => ref.current!.navigate('next'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'C4' }));
    act(() => ref.current!.navigate('next'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'C#4' }));
    act(() => ref.current!.navigate('previous'));
    act(() => ref.current!.navigate('previous'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'B5' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(onPlayNote).toHaveBeenCalledWith(83);
    act(() => ref.current!.navigate('first'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'C4' }));
  });
});
```

- [ ] **Step 3: Run — expect failure**

- [ ] **Step 4: Implement**

```tsx
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
                stroke={isTarget ? 'var(--color-accent)' : '#14110f'}
                strokeWidth={isTarget ? 3 : 1}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
});
```

- [ ] **Step 5: Run tests + tsc** — PASS, no act warnings.

- [ ] **Step 6: Commit** — `git add frontend/src/components && git commit -m "feat: add a two-octave keyboard visualization"`

---

### Task 4: `PianoRollView`

**Files:**
- Create: `frontend/src/components/PianoRollView.tsx`, `frontend/src/components/PianoRollView.test.tsx`
- Create: `frontend/src/lib/pianoRoll.ts`, `frontend/src/lib/pianoRoll.test.ts` (pure helpers)

- [ ] **Step 1: Failing tests**

```ts
// frontend/src/lib/pianoRoll.test.ts
import { describe, expect, it } from 'vitest';
import { appendSample, pitchRange, type RollSample } from './pianoRoll';

const sample = (time: number, voice: number | null, target: number | null): RollSample => ({
  time,
  voice,
  target,
  status: voice === null ? null : 'in-tune',
});

describe('appendSample', () => {
  it('keeps only the samples inside the window', () => {
    let samples: RollSample[] = [];
    for (let time = 0; time <= 7000; time += 1000) samples = appendSample(samples, sample(time, 60, 60), 6000);
    expect(samples.map((entry) => entry.time)).toEqual([1000, 2000, 3000, 4000, 5000, 6000, 7000]);
  });
});

describe('pitchRange', () => {
  it('covers voice and target with 2 semitones of margin, at least 12 semitones tall', () => {
    expect(pitchRange([sample(0, 60.3, 62)])).toEqual({ low: 55, high: 67 });
    expect(pitchRange([sample(0, 48, 60), sample(1, null, 64)])).toEqual({ low: 46, high: 66 });
  });

  it('falls back to C4–C5 when there is nothing to show', () => {
    expect(pitchRange([])).toEqual({ low: 60, high: 72 });
  });
});
```

```tsx
// frontend/src/components/PianoRollView.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PianoRollView } from './PianoRollView';

const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 0, midiNumber, cents });

describe('PianoRollView', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('draws the target as bars and the voice as a line over time', () => {
    const { rerender } = render(<PianoRollView detectedNote={note(60, 0)} targetMidiNumber={60} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender(<PianoRollView detectedNote={note(60, 5)} targetMidiNumber={60} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getAllByTestId('roll-target').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('roll-voice').length).toBeGreaterThan(0);
  });

  it('breaks the voice line during silence', () => {
    const { rerender } = render(<PianoRollView detectedNote={note(60, 0)} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender(<PianoRollView detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender(<PianoRollView detectedNote={note(62, 0)} targetMidiNumber={null} micDisconnected={false} />);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getAllByTestId('roll-voice')).toHaveLength(2);
  });

  it('labels the C rows', () => {
    render(<PianoRollView detectedNote={null} targetMidiNumber={null} micDisconnected={false} />);
    expect(screen.getByText('C4')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — expect failures**

- [ ] **Step 3: Implement**

```ts
// frontend/src/lib/pianoRoll.ts
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
```

```tsx
// frontend/src/components/PianoRollView.tsx
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

  // Consecutive samples with the same target form one bar; voice segments break on silence.
  const targetBars: { start: number; end: number; midi: number }[] = [];
  const voiceSegments: RollSample[][] = [];
  samples.forEach((entry, index) => {
    if (entry.target !== null) {
      const last = targetBars[targetBars.length - 1];
      if (last && last.midi === entry.target && samples[index - 1]?.target === entry.target) last.end = entry.time;
      else targetBars.push({ start: entry.time, end: entry.time, midi: entry.target });
    }
    if (entry.voice !== null) {
      if (index > 0 && samples[index - 1].voice !== null) voiceSegments[voiceSegments.length - 1].push(entry);
      else voiceSegments.push([entry]);
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
      {voiceSegments.map((segment) =>
        segment.length === 1 ? (
          <circle
            key={segment[0].time}
            data-testid="roll-voice"
            cx={x(segment[0].time)}
            cy={y(segment[0].voice!)}
            r={2}
            fill={segment[0].status ? STATUS_COLORS[segment[0].status] : '#ffffff'}
          />
        ) : (
          <polyline
            key={segment[0].time}
            data-testid="roll-voice"
            points={segment.map((entry) => `${x(entry.time)},${y(entry.voice!)}`).join(' ')}
            fill="none"
            stroke={segment[segment.length - 1].status ? STATUS_COLORS[segment[segment.length - 1].status!] : '#ffffff'}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )
      )}
    </svg>
  );
}
```

Note: a voice segment is drawn in the color of its latest sample (per-sample coloring would need one polyline per color run; keep it simple).

- [ ] **Step 4: Run tests + tsc** — PASS, no act warnings.

- [ ] **Step 5: Commit** — `git add frontend/src && git commit -m "feat: add a piano-roll visualization"`

---

### Task 5: Seletor, troca de modo nas faixas, tecla V, estilo e README

**Files:**
- Modify: `frontend/src/components/InputLane.tsx` (+ test), `frontend/src/components/ExercisePlayer.tsx` (+ tests), `frontend/src/App.test.tsx`
- Modify: `frontend/src/index.css`, `README.md`

- [ ] **Step 1: Failing tests**

In `InputLane.test.tsx` (add the new required props `visualization: 'wheel'`, `keyboardLowMidi: 60`, and rename `onNoteClick` → `onPlayNote` in `renderLane`), add:

```tsx
  it('renders the chosen visualization', () => {
    renderLane({ visualization: 'tuner' });
    expect(screen.getByRole('img', { name: 'Afinador cromático' })).toBeDefined();
  });

  it('plays wheel bubbles in the fourth octave', () => {
    const props = renderLane({ visualization: 'wheel' });
    fireEvent.click(screen.getByTestId('note-bubble-A'));
    expect(props.onPlayNote).toHaveBeenCalledWith(69);
  });
```

In `ExercisePlayer.lanes.test.tsx` add:

```tsx
  it('switches every lane to the chosen visualization, with V and remembered', async () => {
    localStorage.setItem(
      'singer-trainer:input-lanes',
      JSON.stringify([
        { id: 'primary', deviceId: 'mic' },
        { id: 'lane-2', deviceId: 'monitor' },
      ])
    );
    renderPlayer();
    await flush();
    fireEvent.change(screen.getByRole('combobox', { name: 'Visualização' }), { target: { value: 'tuner' } });
    expect(screen.getAllByRole('img', { name: 'Afinador cromático' })).toHaveLength(2);
    fireEvent.keyDown(document.body, { key: 'v' });
    expect(screen.getAllByLabelText('Teclado')).toHaveLength(2);
    expect(localStorage.getItem('singer-trainer:visualization')).toBe('keyboard');
  });
```

In `App.test.tsx`, update the toolbar test to the new name `'Opções do exercício'` and also assert `within(toolbar).getByRole('combobox', { name: 'Visualização' })`.

- [ ] **Step 2: Run — expect failures**

- [ ] **Step 3: Implement**

`InputLane.tsx`:
1. Props: replace `onNoteClick: (pitchClass: number) => void` with `onPlayNote: (midiNumber: number) => void`; add `visualization: VisualizationMode` and `keyboardLowMidi: number`; `wheelRef?: Ref<NoteNavigatorHandle>`.
2. Replace the `<div className="wheel-stage">…</div>` block with:

```tsx
      <div className={`view-stage view-${visualization}`}>
        {visualization === 'wheel' && (
          <PitchMeter
            ref={wheelRef}
            detectedNote={detected}
            targetMidiNumber={targetMidiNumber}
            micDisconnected={micDisconnected}
            onNoteClick={(pitchClass) => onPlayNote(WHEEL_OCTAVE_BASE_MIDI + pitchClass)}
          />
        )}
        {visualization === 'keyboard' && (
          <KeyboardView
            ref={wheelRef}
            lowMidi={keyboardLowMidi}
            detectedNote={detected}
            targetMidiNumber={targetMidiNumber}
            micDisconnected={micDisconnected}
            onPlayNote={onPlayNote}
          />
        )}
        {visualization === 'tuner' && (
          <TunerView detectedNote={detected} targetMidiNumber={targetMidiNumber} micDisconnected={micDisconnected} />
        )}
        {visualization === 'piano-roll' && (
          <PianoRollView detectedNote={detected} targetMidiNumber={targetMidiNumber} micDisconnected={micDisconnected} />
        )}
      </div>
```

with `const micDisconnected = tracker.status === 'error';` and the module constant `// The wheel is octave-agnostic, so a clicked bubble previews in this fixed octave (C4-B4).\nconst WHEEL_OCTAVE_BASE_MIDI = 60;`. Keep the existing `.wheel-stage` styles working by giving the wheel container both classes: use `className={\`view-stage view-${visualization}${visualization === 'wheel' ? ' wheel-stage' : ''}\`}`.

`ExercisePlayer.tsx`:
1. State: `const [visualization, setVisualization] = useState(() => loadVisualization());` and `useEffect(() => saveVisualization(visualization), [visualization]);`.
2. `handleNoteClick(pitchClass)` becomes `playNote(midiNumber)` (same body, `playPreviewTone(previewContext, midiNumber)`); remove `PREVIEW_OCTAVE_BASE_MIDI`.
3. `const keyboardLowMidi = useMemo(() => exercise.notes.length > 0 ? Math.floor(Math.min(...exercise.notes.map((n) => n.midiNumber)) / 12) * 12 : 48, [exercise]);`
4. Shortcut: `case 'nextView': setVisualization((mode) => nextVisualization(mode)); break;`
5. Toolbar: rename `aria-label` to `"Opções do exercício"` and add after the speed label:

```tsx
        <label className="speed-control">
          Visualização
          <select
            className="view-select"
            aria-label="Visualização"
            value={visualization}
            onChange={(event) => setVisualization(event.target.value as VisualizationMode)}
          >
            {VISUALIZATION_MODES.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
        </label>
```

6. Pass `visualization`, `keyboardLowMidi` and `onPlayNote={playNote}` to every `InputLane` (instead of `onNoteClick`).
7. `wheelRef` type: `useRef<NoteNavigatorHandle>(null)`.

Update other player tests only where the toolbar name changed.

- [ ] **Step 4: CSS** — add before the `@media (min-width: 900px)` block:

```css
.view-stage {
  width: min(100%, 360px);
  margin-bottom: 2rem;
}

.view-select {
  font-family: var(--font-body);
  font-size: 0.85rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-text);
  cursor: pointer;
}

.tuner-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1rem 0;
}

.tuner-note {
  font-family: var(--font-display);
  font-size: 3.5rem;
  font-weight: 600;
  line-height: 1;
}

.tuner-scale {
  position: relative;
  width: 100%;
  height: 14px;
  border-radius: 999px;
  background: linear-gradient(90deg, #e74c3c 0%, #f1c40f 25%, #2ecc71 45%, #2ecc71 55%, #f1c40f 75%, #e74c3c 100%);
  opacity: 0.85;
}

.tuner-scale-center {
  position: absolute;
  left: 50%;
  top: -4px;
  bottom: -4px;
  width: 2px;
  background: var(--color-text);
}

.tuner-needle {
  position: absolute;
  top: -8px;
  width: 6px;
  height: 30px;
  margin-left: -3px;
  border-radius: 3px;
  border: 2px solid var(--color-bg);
}

.tuner-legend {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.tuner-target {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.keyboard-readout {
  display: flex;
  justify-content: space-between;
  min-height: 1.2rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.keyboard-view g[role='button']:focus {
  outline: none;
}

.keyboard-view g[role='button']:focus-visible rect {
  stroke: var(--color-accent);
  stroke-width: 3;
}

.piano-roll {
  display: block;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.is-disconnected {
  opacity: 0.4;
}
```

- [ ] **Step 5: README** — under `## Funcionalidades`, after the "Várias entradas" bullet:

```markdown
- **Visualizações** — além da roda cromática (padrão, mais didática), escolha na barra do
  topo (ou com V) entre **piano-roll** (altura da voz ao longo do tempo sobre a nota-alvo),
  **afinador cromático** (nota grande e ponteiro de ±50 cents) e **teclado** de duas
  oitavas com a tecla cantada acesa. A escolha fica salva.
```

- [ ] **Step 6: Full verification** — `cd frontend && npm test && npx tsc -b && npm run build`, no act warnings.

- [ ] **Step 7: Visual check** — Vite on 5179, Playwright MCP at 1366×768 and 680×890, one screenshot per mode (`.playwright-mcp/view-<mode>.png`): legible on the dark theme, fits the lane, toolbar still on one line on wide. Stop Vite by PID.

- [ ] **Step 8: Commit** — `git add frontend/src README.md && git commit -m "feat: let the user pick wheel, piano-roll, tuner or keyboard views"`
