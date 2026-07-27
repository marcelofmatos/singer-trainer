# Clickable Note Bubbles + Persisted Playback Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user click (or keyboard-activate) any note bubble on the chromatic wheel to hear that pitch, and persist the speed/loop controls across page reloads via `localStorage`.

**Architecture:** `PitchMeter` stays a pure, presentational component — it gains an optional `onNoteClick` callback prop and has no idea audio exists. `ExercisePlayer` implements the actual sound (a new, short-lived `AudioContext` per click, via a new `previewTone.ts` module mirroring the existing `referenceTone.ts` pattern) and reads/writes playback preferences through a new pure `playbackPreferences.ts` module, which — unlike everything touching `AudioContext`/`getUserMedia` — is genuinely unit-testable, since jsdom implements `localStorage`.

**Tech Stack:** Same as the rest of the frontend (React + TypeScript + Vitest + Testing Library).

**Design reference:** `docs/superpowers/specs/2026-07-26-clickable-notes-and-preferences.md` (approved spec).

**Regression protection:** `frontend/src/lib/chromaticWheel.ts` is not touched. `PitchMeter.tsx`'s existing 8 tests are extended, not replaced — the new prop is optional, so every existing call site and test keeps working unchanged.

---

### Task 1: `playbackPreferences` module

**Files:**
- Create: `frontend/src/lib/playbackPreferences.ts`
- Create: `frontend/src/lib/playbackPreferences.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/lib/playbackPreferences.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAYBACK_PREFERENCES,
  loadPlaybackPreferences,
  savePlaybackPreferences,
} from './playbackPreferences';

const STORAGE_KEY = 'singer-trainer:playback-preferences';

describe('playbackPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the defaults when nothing is stored yet', () => {
    expect(loadPlaybackPreferences()).toEqual(DEFAULT_PLAYBACK_PREFERENCES);
  });

  it('round-trips a saved value through load', () => {
    savePlaybackPreferences({ playbackRate: 1.5, loop: true });
    expect(loadPlaybackPreferences()).toEqual({ playbackRate: 1.5, loop: true });
  });

  it('falls back to defaults when the stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(loadPlaybackPreferences()).toEqual(DEFAULT_PLAYBACK_PREFERENCES);
  });

  it('falls back per-field when a stored value has the wrong type', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ playbackRate: 'fast', loop: 'yes' }));
    expect(loadPlaybackPreferences()).toEqual(DEFAULT_PLAYBACK_PREFERENCES);
  });

  it('keeps a valid field even when the other one is invalid', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ playbackRate: 1.75, loop: 'yes' }));
    expect(loadPlaybackPreferences()).toEqual({ playbackRate: 1.75, loop: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- playbackPreferences`
Expected: FAIL with a module-not-found error for `./playbackPreferences`.

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/lib/playbackPreferences.ts
export interface PlaybackPreferences {
  playbackRate: number;
  loop: boolean;
}

const STORAGE_KEY = 'singer-trainer:playback-preferences';

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  playbackRate: 1,
  loop: false,
};

/** Reads playback preferences from localStorage, falling back to defaults on any problem. */
export function loadPlaybackPreferences(): PlaybackPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLAYBACK_PREFERENCES;

    const parsed = JSON.parse(raw);
    const playbackRate =
      typeof parsed.playbackRate === 'number'
        ? parsed.playbackRate
        : DEFAULT_PLAYBACK_PREFERENCES.playbackRate;
    const loop = typeof parsed.loop === 'boolean' ? parsed.loop : DEFAULT_PLAYBACK_PREFERENCES.loop;

    return { playbackRate, loop };
  } catch {
    return DEFAULT_PLAYBACK_PREFERENCES;
  }
}

/** Writes playback preferences to localStorage; silently no-ops if storage is unavailable. */
export function savePlaybackPreferences(preferences: PlaybackPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Private browsing / quota exceeded — this is a nice-to-have, not critical.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- playbackPreferences`
Expected: PASS — 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/playbackPreferences.ts frontend/src/lib/playbackPreferences.test.ts
git commit -m "feat: add playbackPreferences module backed by localStorage"
```

---

### Task 2: Wire preference persistence into `ExercisePlayer`

**Files:**
- Modify: `frontend/src/components/ExercisePlayer.tsx` (full replacement)

No test file — same rationale as before for this component.

- [ ] **Step 1: Replace `frontend/src/components/ExercisePlayer.tsx`**

```tsx
// frontend/src/components/ExercisePlayer.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise } from '../lib/exercises';
import { exerciseDuration, noteAtTime, scaleExerciseTiming } from '../lib/exerciseTiming';
import { loadPlaybackPreferences, savePlaybackPreferences } from '../lib/playbackPreferences';
import { playExerciseTone } from '../audio/referenceTone';
import { usePitchTracker } from '../hooks/usePitchTracker';
import { PitchMeter } from './PitchMeter';

export interface ExercisePlayerProps {
  exercise: Exercise;
}

const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2;
const PLAYBACK_RATE_STEP = 0.25;

export function ExercisePlayer({ exercise }: ExercisePlayerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(() => loadPlaybackPreferences().playbackRate);
  const [loop, setLoop] = useState(() => loadPlaybackPreferences().loop);
  const [cycle, setCycle] = useState(0);
  const [toneError, setToneError] = useState<string | null>(null);
  const pitchTracker = usePitchTracker();

  const loopRef = useRef(loop);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  useEffect(() => {
    savePlaybackPreferences({ playbackRate, loop });
  }, [playbackRate, loop]);

  const scaledExercise = useMemo(
    () => scaleExerciseTiming(exercise, playbackRate),
    [exercise, playbackRate]
  );

  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let oscillator: OscillatorNode | null = null;
    let elapsedTimer: ReturnType<typeof setInterval> | null = null;
    let loopTimeout: ReturnType<typeof setTimeout> | null = null;

    try {
      audioContext = new AudioContext();
      oscillator = playExerciseTone(audioContext, scaledExercise);
      setToneError(null);
      setElapsed(0);

      const startedAt = performance.now();
      elapsedTimer = setInterval(() => {
        setElapsed((performance.now() - startedAt) / 1000);
      }, 100);

      loopTimeout = setTimeout(() => {
        if (loopRef.current) {
          setCycle((c) => c + 1);
        }
      }, exerciseDuration(scaledExercise) * 1000);
    } catch (err) {
      setToneError(
        err instanceof Error ? err.message : 'Não foi possível reproduzir o áudio de referência.'
      );
    }

    return () => {
      if (elapsedTimer) clearInterval(elapsedTimer);
      if (loopTimeout) clearTimeout(loopTimeout);
      oscillator?.stop();
      audioContext?.close();
    };
  }, [scaledExercise, cycle]);

  const targetNote = noteAtTime(scaledExercise, elapsed);

  return (
    <section className="exercise-panel">
      <h2 className="exercise-title">{exercise.name}</h2>
      <p className="exercise-description">{exercise.description}</p>

      {pitchTracker.status === 'requesting' && (
        <p className="status-message">Pedindo acesso ao microfone…</p>
      )}
      {pitchTracker.status === 'error' && (
        <p className="status-message" role="alert">
          Erro ao acessar o microfone: {pitchTracker.errorMessage}
        </p>
      )}
      {toneError && (
        <p className="status-message" role="alert">
          Erro ao tocar o áudio de referência: {toneError}
        </p>
      )}

      <div className="wheel-stage">
        <PitchMeter
          detectedNote={pitchTracker.status === 'listening' ? pitchTracker.currentNote : null}
          targetMidiNumber={targetNote?.midiNumber ?? null}
        />
      </div>

      <div className="exercise-controls">
        <label className="speed-control">
          Velocidade
          <input
            type="range"
            min={MIN_PLAYBACK_RATE}
            max={MAX_PLAYBACK_RATE}
            step={PLAYBACK_RATE_STEP}
            value={playbackRate}
            onChange={(event) => setPlaybackRate(Number(event.target.value))}
          />
          <span className="speed-value">{playbackRate.toFixed(2)}x</span>
        </label>

        <label className="loop-toggle">
          <input
            type="checkbox"
            checked={loop}
            onChange={(event) => setLoop(event.target.checked)}
          />
          Repetir
        </label>
      </div>
    </section>
  );
}
```

The only changes from the current file: the `playbackPreferences` import, the two `useState` initializers becoming lazy (`() => loadPlaybackPreferences().playbackRate` / `().loop`) instead of hardcoded defaults, a new small effect that saves on every `[playbackRate, loop]` change, and the removal of the now-unused `DEFAULT_PLAYBACK_RATE` constant (drop it — `noUnusedLocals` is enabled in `tsconfig.json`, so leaving it in unused would be a compile error). Everything else is byte-identical to the current file.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no type errors.

- [ ] **Step 3: Manual check**

Run: `cd frontend && npm run dev`, open the app, drag the speed slider to a non-default value and check "Repetir", then reload the page (F5) — confirm both the slider position and the checkbox are restored to what you left them at, without needing to grant the mic permission again being a factor either way.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ExercisePlayer.tsx
git commit -m "feat: persist speed/loop preferences to localStorage"
```

---

### Task 3: `previewTone` module

**Files:**
- Create: `frontend/src/audio/previewTone.ts`

No test file — same rationale as `referenceTone.ts` (thin Web Audio wrapper, no meaningful behavior outside a browser).

- [ ] **Step 1: Write the implementation**

```typescript
// frontend/src/audio/previewTone.ts
import { noteToFrequency } from '../lib/noteUtils';

const PREVIEW_DURATION_SECONDS = 0.5;
const PREVIEW_GAIN = 0.2;

/** Plays a single short tone for the given MIDI note — used to preview a note on click. */
export function playPreviewTone(audioContext: AudioContext, midiNumber: number): void {
  const oscillator = audioContext.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(noteToFrequency(midiNumber), audioContext.currentTime);

  const gain = audioContext.createGain();
  gain.gain.value = PREVIEW_GAIN;

  oscillator.connect(gain).connect(audioContext.destination);

  const startTime = audioContext.currentTime;
  oscillator.start(startTime);
  oscillator.stop(startTime + PREVIEW_DURATION_SECONDS);
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/audio/previewTone.ts
git commit -m "feat: add short note-preview tone player"
```

---

### Task 4: Make `PitchMeter` bubbles clickable

**Files:**
- Modify: `frontend/src/components/PitchMeter.tsx` (add the `onNoteClick` prop and click/keyboard handling)
- Modify: `frontend/src/components/PitchMeter.test.tsx` (append 3 new tests)

`PitchMeter` stays a pure, presentational component — it never touches `AudioContext`. It only reports *which* pitch class (0=C .. 11=B) was activated; a later task wires the actual sound in `ExercisePlayer`.

- [ ] **Step 1: Append the failing tests to `frontend/src/components/PitchMeter.test.tsx`**

Add `fireEvent` and `vi` to the existing import line (`import { fireEvent, render, screen } from '@testing-library/react';` and `import { describe, expect, it, vi } from 'vitest';`), then append these three tests inside the existing `describe('PitchMeter', ...)` block, after the last existing test:

```tsx
  it('calls onNoteClick with the pitch class index when a bubble is clicked', () => {
    const handleClick = vi.fn();
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} onNoteClick={handleClick} />);
    fireEvent.click(screen.getByTestId('note-bubble-D'));
    expect(handleClick).toHaveBeenCalledWith(2);
  });

  it('calls onNoteClick when a bubble is activated via keyboard (Enter)', () => {
    const handleClick = vi.fn();
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} onNoteClick={handleClick} />);
    fireEvent.keyDown(screen.getByTestId('note-bubble-A'), { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledWith(9);
  });

  it('does not throw when a bubble is clicked without an onNoteClick handler', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} />);
    expect(() => fireEvent.click(screen.getByTestId('note-bubble-C'))).not.toThrow();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- PitchMeter`
Expected: FAIL — the current bubbles have no click/keyboard handling, so `onNoteClick` is never called.

- [ ] **Step 3: Replace `frontend/src/components/PitchMeter.tsx`**

```tsx
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
  /** Called with the pitch class index (0=C .. 11=B) when a bubble is clicked or activated via keyboard. */
  onNoteClick?: (pitchClassIndex: number) => void;
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

export function PitchMeter({ detectedNote, targetMidiNumber, onNoteClick }: PitchMeterProps) {
  const targetPitchClass = targetMidiNumber !== null ? pitchClassIndex(targetMidiNumber) : null;

  const cents =
    detectedNote && targetMidiNumber !== null
      ? (detectedNote.midiNumber - targetMidiNumber) * 100 + detectedNote.cents
      : (detectedNote?.cents ?? 0);
  const status = detectedNote ? tuningStatus(cents) : null;

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
      {indicatorPosition && status && (
        <g data-testid="live-indicator" data-status={status}>
          <circle
            cx={indicatorPosition.x}
            cy={indicatorPosition.y}
            r={INDICATOR_RADIUS + 4}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
          />
          <circle
            cx={indicatorPosition.x}
            cy={indicatorPosition.y}
            r={INDICATOR_RADIUS + 2}
            fill="none"
            stroke="#000000"
            strokeWidth={2}
          />
          <circle
            cx={indicatorPosition.x}
            cy={indicatorPosition.y}
            r={INDICATOR_RADIUS}
            fill={STATUS_COLORS[status]}
          />
        </g>
      )}
    </svg>
  );
}
```

This is the complete current file (already reflecting the two-tone halo and the redundant-stroke cleanup from the previous plan) plus the new `onNoteClick` prop and per-bubble `role`/`tabIndex`/`onClick`/`onKeyDown` wiring. Nothing else changes.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- PitchMeter`
Expected: PASS — 11 tests passed (8 existing + 3 new).

- [ ] **Step 5: Run the full suite**

Run: `cd frontend && npm test`
Expected: PASS — all tests pass. Total should be 66: 58 before this plan, +5 from Task 1's `playbackPreferences` tests, +3 net from Task 4 (11 in `PitchMeter.test.tsx` vs. the previous 8) — 58 + 5 + 3 = 66. Confirm this against your actual run rather than assuming; investigate if it doesn't match.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PitchMeter.tsx frontend/src/components/PitchMeter.test.tsx
git commit -m "feat: make chromatic wheel note bubbles clickable/keyboard-activatable"
```

---

### Task 5: Play the clicked note in `ExercisePlayer`

**Files:**
- Modify: `frontend/src/components/ExercisePlayer.tsx` (full replacement)

No test file — same rationale as before.

- [ ] **Step 1: Replace `frontend/src/components/ExercisePlayer.tsx`**

```tsx
// frontend/src/components/ExercisePlayer.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise } from '../lib/exercises';
import { exerciseDuration, noteAtTime, scaleExerciseTiming } from '../lib/exerciseTiming';
import { loadPlaybackPreferences, savePlaybackPreferences } from '../lib/playbackPreferences';
import { playExerciseTone } from '../audio/referenceTone';
import { playPreviewTone } from '../audio/previewTone';
import { usePitchTracker } from '../hooks/usePitchTracker';
import { PitchMeter } from './PitchMeter';

export interface ExercisePlayerProps {
  exercise: Exercise;
}

const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2;
const PLAYBACK_RATE_STEP = 0.25;
// The wheel is octave-agnostic, so a clicked bubble always previews in this fixed octave (C4-B4).
const PREVIEW_OCTAVE_BASE_MIDI = 60;
const PREVIEW_CONTEXT_LIFETIME_MS = 600;

export function ExercisePlayer({ exercise }: ExercisePlayerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(() => loadPlaybackPreferences().playbackRate);
  const [loop, setLoop] = useState(() => loadPlaybackPreferences().loop);
  const [cycle, setCycle] = useState(0);
  const [toneError, setToneError] = useState<string | null>(null);
  const pitchTracker = usePitchTracker();

  const loopRef = useRef(loop);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  useEffect(() => {
    savePlaybackPreferences({ playbackRate, loop });
  }, [playbackRate, loop]);

  const scaledExercise = useMemo(
    () => scaleExerciseTiming(exercise, playbackRate),
    [exercise, playbackRate]
  );

  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let oscillator: OscillatorNode | null = null;
    let elapsedTimer: ReturnType<typeof setInterval> | null = null;
    let loopTimeout: ReturnType<typeof setTimeout> | null = null;

    try {
      audioContext = new AudioContext();
      oscillator = playExerciseTone(audioContext, scaledExercise);
      setToneError(null);
      setElapsed(0);

      const startedAt = performance.now();
      elapsedTimer = setInterval(() => {
        setElapsed((performance.now() - startedAt) / 1000);
      }, 100);

      loopTimeout = setTimeout(() => {
        if (loopRef.current) {
          setCycle((c) => c + 1);
        }
      }, exerciseDuration(scaledExercise) * 1000);
    } catch (err) {
      setToneError(
        err instanceof Error ? err.message : 'Não foi possível reproduzir o áudio de referência.'
      );
    }

    return () => {
      if (elapsedTimer) clearInterval(elapsedTimer);
      if (loopTimeout) clearTimeout(loopTimeout);
      oscillator?.stop();
      audioContext?.close();
    };
  }, [scaledExercise, cycle]);

  const targetNote = noteAtTime(scaledExercise, elapsed);

  function handleNoteClick(pitchClass: number) {
    try {
      const previewContext = new AudioContext();
      playPreviewTone(previewContext, PREVIEW_OCTAVE_BASE_MIDI + pitchClass);
      setTimeout(() => previewContext.close(), PREVIEW_CONTEXT_LIFETIME_MS);
      setToneError(null);
    } catch (err) {
      setToneError(
        err instanceof Error ? err.message : 'Não foi possível reproduzir o áudio de referência.'
      );
    }
  }

  return (
    <section className="exercise-panel">
      <h2 className="exercise-title">{exercise.name}</h2>
      <p className="exercise-description">{exercise.description}</p>

      {pitchTracker.status === 'requesting' && (
        <p className="status-message">Pedindo acesso ao microfone…</p>
      )}
      {pitchTracker.status === 'error' && (
        <p className="status-message" role="alert">
          Erro ao acessar o microfone: {pitchTracker.errorMessage}
        </p>
      )}
      {toneError && (
        <p className="status-message" role="alert">
          Erro ao tocar o áudio de referência: {toneError}
        </p>
      )}

      <div className="wheel-stage">
        <PitchMeter
          detectedNote={pitchTracker.status === 'listening' ? pitchTracker.currentNote : null}
          targetMidiNumber={targetNote?.midiNumber ?? null}
          onNoteClick={handleNoteClick}
        />
      </div>

      <div className="exercise-controls">
        <label className="speed-control">
          Velocidade
          <input
            type="range"
            min={MIN_PLAYBACK_RATE}
            max={MAX_PLAYBACK_RATE}
            step={PLAYBACK_RATE_STEP}
            value={playbackRate}
            onChange={(event) => setPlaybackRate(Number(event.target.value))}
          />
          <span className="speed-value">{playbackRate.toFixed(2)}x</span>
        </label>

        <label className="loop-toggle">
          <input
            type="checkbox"
            checked={loop}
            onChange={(event) => setLoop(event.target.checked)}
          />
          Repetir
        </label>
      </div>
    </section>
  );
}
```

The only changes from Task 2's version of this file: the `playPreviewTone` import, the two new constants (`PREVIEW_OCTAVE_BASE_MIDI`, `PREVIEW_CONTEXT_LIFETIME_MS`), the new `handleNoteClick` function, and passing `onNoteClick={handleNoteClick}` to `PitchMeter`. Each click creates its own short-lived `AudioContext` (independent of the reference-tone playback effect above it) and closes it ~100ms after the 0.5s preview tone ends.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no type errors.

- [ ] **Step 3: Run the full suite**

Run: `cd frontend && npm test`
Expected: PASS — same count as after Task 4 (this task doesn't touch any tested file).

- [ ] **Step 4: Manual check**

Run: `cd frontend && npm run dev`, open the app, click a few different note bubbles (not necessarily the target one) and confirm you hear a short tone for each, without disrupting the exercise's own reference-tone playback or the live tuning indicator. If you have no way to hear audio, at minimum confirm via browser dev tools or a script that clicking a bubble creates and later closes an `AudioContext` without throwing, and be explicit in your report about what you could/couldn't verify.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ExercisePlayer.tsx
git commit -m "feat: play a short preview tone when a note bubble is clicked"
```

---

## Out of scope for this plan

- Previewing a clicked note in the exercise's actual octave (always plays in a fixed C4–B4 octave, since the wheel itself is octave-agnostic by design).
- Per-exercise (rather than global) persisted playback preferences.
