# Warmup Exercises, Playback Controls, and Mic Sensitivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new vocal-warmup exercises, a play/pause + mute pair of controls (placed before the speed slider), and a mic-sensitivity control (adjusting the YIN detection threshold, not audio gain) to the practice screen.

**Architecture:** New exercises are pure data added to `BUILTIN_EXERCISES`. Play/pause uses `AudioContext.suspend()/resume()` on the existing reference-tone context so pausing freezes (not restarts) playback — this also lets the "has the exercise ended" check move from a real-time `setTimeout` to a poll of `audioContext.currentTime`, which naturally respects the pause. Mute controls the `GainNode` that `playExerciseTone` now returns alongside its oscillator. Mic sensitivity is a `usePitchTracker(sensitivity)` parameter, read via a ref inside its existing polling loop (same pattern already used for `loop` in `ExercisePlayer`) so adjusting it never re-requests microphone access.

**Tech Stack:** Same as the rest of the frontend (React + TypeScript + Vitest + Testing Library).

**Design reference:** `docs/superpowers/specs/2026-07-27-warmup-exercises-and-controls.md` (approved spec). Vocal warmup technique research: sirens, humming/straw phonation, vocal fry, and 5-tone-scale/arpeggio patterns are standard, widely-taught vocal pedagogy techniques (confirmed via search across multiple vocal-coaching sources) — general technique knowledge, not copyrighted content.

---

### Task 1: Three new built-in exercises

**Files:**
- Modify: `frontend/src/lib/exercises.ts` (append 3 entries to `BUILTIN_EXERCISES`)
- Modify: `frontend/src/lib/exercises.test.ts` (append 1 test)

- [ ] **Step 1: Append the failing test to `frontend/src/lib/exercises.test.ts`**, inside the existing `describe('BUILTIN_EXERCISES', ...)` block, after the last existing test:

```typescript
  it('includes the arpeggio, 5-tone scale, and octave-jump warmup exercises', () => {
    const ids = BUILTIN_EXERCISES.map((e) => e.id);
    expect(ids).toContain('arpejo-maior-c4');
    expect(ids).toContain('escala-cinco-notas');
    expect(ids).toContain('saltos-oitava');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- exercises`
Expected: FAIL — the three new ids aren't in `BUILTIN_EXERCISES` yet.

- [ ] **Step 3: Replace `frontend/src/lib/exercises.ts`**

```typescript
export type ExerciseCategory = 'aquecimento' | 'escala' | 'respiracao';

export interface ExerciseNote {
  midiNumber: number;
  startTime: number; // seconds from the start of the exercise
  duration: number; // seconds
}

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  description: string;
  notes: ExerciseNote[];
}

/** Builds an up-then-down note sequence (e.g. a scale) from a root note and a list of intervals. */
export function buildScale(rootMidi: number, intervals: number[], noteDuration = 0.6): ExerciseNote[] {
  const upThenDown = [...intervals, ...intervals.slice(0, -1).reverse()];
  return upThenDown.map((interval, index) => ({
    midiNumber: rootMidi + interval,
    startTime: index * noteDuration,
    duration: noteDuration,
  }));
}

const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11, 12];
const MIDDLE_C = 60;

export const BUILTIN_EXERCISES: Exercise[] = [
  {
    id: 'escala-maior-c4',
    name: 'Escala Maior (Dó central)',
    category: 'escala',
    description: 'Escala maior de Dó4 a Dó5 e volta, para aquecer a extensão vocal média.',
    notes: buildScale(MIDDLE_C, MAJOR_SCALE_INTERVALS, 0.6),
  },
  {
    id: 'sirene',
    name: 'Sirene',
    category: 'aquecimento',
    description:
      'Deslize a voz suavemente do Dó4 até o Dó5 e volta; o tom de referência marca só o início, ' +
      'o topo e o fim do percurso, para soltar a laringe.',
    notes: [
      { midiNumber: MIDDLE_C, startTime: 0, duration: 2 },
      { midiNumber: MIDDLE_C + 12, startTime: 2, duration: 2 },
      { midiNumber: MIDDLE_C, startTime: 4, duration: 2 },
    ],
  },
  {
    id: 'lip-trill',
    name: 'Lip Trill (vibração de lábios)',
    category: 'aquecimento',
    description: 'Vibre os lábios enquanto sobe e desce a escala, para relaxar e equalizar o som.',
    notes: buildScale(MIDDLE_C, MAJOR_SCALE_INTERVALS, 0.5),
  },
  {
    id: 'respiracao-sustentada',
    name: 'Respiração Sustentada',
    category: 'respiracao',
    description: 'Sustente uma nota confortável o máximo que puder com respiração controlada.',
    notes: [{ midiNumber: MIDDLE_C, startTime: 0, duration: 8 }],
  },
  {
    id: 'arpejo-maior-c4',
    name: 'Arpejo Maior',
    category: 'escala',
    description:
      'Dó-Mi-Sol-Dó e volta — um clássico de aquecimento vocal para agilidade e para conectar ' +
      'registros com mais leveza que uma escala completa.',
    notes: buildScale(MIDDLE_C, [0, 4, 7, 12], 0.5),
  },
  {
    id: 'escala-cinco-notas',
    name: 'Escala de 5 Notas',
    category: 'aquecimento',
    description:
      'Dó-Ré-Mi-Fá-Sol e volta — mais curta e suave que a escala completa, ótima para abrir a sessão.',
    notes: buildScale(MIDDLE_C, [0, 2, 4, 5, 7], 0.5),
  },
  {
    id: 'saltos-oitava',
    name: 'Saltos de Oitava',
    category: 'escala',
    description:
      'Alterna diretamente entre Dó4 e Dó5, sem escala intermediária — treina a passagem de registro.',
    notes: [
      { midiNumber: MIDDLE_C, startTime: 0, duration: 1 },
      { midiNumber: MIDDLE_C + 12, startTime: 1, duration: 1 },
      { midiNumber: MIDDLE_C, startTime: 2, duration: 1 },
      { midiNumber: MIDDLE_C + 12, startTime: 3, duration: 1 },
      { midiNumber: MIDDLE_C, startTime: 4, duration: 1 },
    ],
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- exercises`
Expected: PASS — 6 tests passed (5 existing + 1 new). The existing "at least 4 exercises" and "notes sorted by start time" tests also still pass against the 3 new entries automatically, since they iterate over all of `BUILTIN_EXERCISES` generically.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/exercises.ts frontend/src/lib/exercises.test.ts
git commit -m "feat: add arpeggio, 5-tone scale, and octave-jump warmup exercises"
```

---

### Task 2: Export the YIN detection threshold default

**Files:**
- Modify: `frontend/src/lib/pitchDetection.ts:6` (add `export` to one existing constant — nothing else changes)
- Modify: `frontend/src/lib/pitchDetection.test.ts` (append 1 test)

- [ ] **Step 1: Append the failing test to `frontend/src/lib/pitchDetection.test.ts`**, inside the existing `describe('detectPitchYIN', ...)` block or as a new top-level `describe`:

```typescript
describe('DEFAULT_THRESHOLD', () => {
  it('is exported for other modules to reference as the baseline sensitivity', () => {
    expect(DEFAULT_THRESHOLD).toBe(0.15);
  });
});
```

Add `DEFAULT_THRESHOLD` to the existing `import { detectPitchYIN } from './pitchDetection';` line so it reads `import { DEFAULT_THRESHOLD, detectPitchYIN } from './pitchDetection';`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- pitchDetection`
Expected: FAIL — `DEFAULT_THRESHOLD` is not exported yet (import error).

- [ ] **Step 3: Modify `frontend/src/lib/pitchDetection.ts` line 6**

Change:
```typescript
const DEFAULT_THRESHOLD = 0.15;
```
to:
```typescript
export const DEFAULT_THRESHOLD = 0.15;
```

That is the ONLY change to this file — the algorithm itself is untouched.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- pitchDetection`
Expected: PASS — 5 tests passed (4 existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/pitchDetection.ts frontend/src/lib/pitchDetection.test.ts
git commit -m "feat: export the default YIN detection threshold"
```

---

### Task 3: `usePitchTracker` accepts an adjustable sensitivity

**Files:**
- Modify: `frontend/src/hooks/usePitchTracker.ts` (full replacement)

No test file — same rationale as before (owns `getUserMedia`/`AudioContext`, browser-only, out of jsdom's reach).

- [ ] **Step 1: Replace `frontend/src/hooks/usePitchTracker.ts`**

```typescript
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_THRESHOLD, detectPitchYIN } from '../lib/pitchDetection';
import { frequencyToNote, type NoteInfo } from '../lib/noteUtils';

export type PitchTrackerStatus = 'requesting' | 'listening' | 'error';

export interface PitchTrackerState {
  status: PitchTrackerStatus;
  errorMessage: string | null;
  currentNote: NoteInfo | null;
}

const BUFFER_SIZE = 4096;
const DETECTION_INTERVAL_MS = 50; // naive YIN is O(n^2); 20Hz updates keep CPU sane and still look real-time

/**
 * Listens to the microphone and reports the detected note ~20 times/sec until unmounted.
 *
 * `sensitivity` is the YIN detection threshold: lower = stricter (fewer false positives
 * on noise/breath, but may miss soft/unclear pitches), higher = more lenient. It's read
 * via a ref inside the polling loop so adjusting it never re-requests microphone access
 * or tears down the existing audio graph.
 */
export function usePitchTracker(sensitivity: number = DEFAULT_THRESHOLD): PitchTrackerState {
  const [state, setState] = useState<PitchTrackerState>({
    status: 'requesting',
    errorMessage: null,
    currentNote: null,
  });

  const sensitivityRef = useRef(sensitivity);
  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = BUFFER_SIZE;
        source.connect(analyser);

        const buffer = new Float32Array(analyser.fftSize);
        setState((prev) => ({ ...prev, status: 'listening' }));

        intervalId = setInterval(() => {
          analyser.getFloatTimeDomainData(buffer);
          const result = detectPitchYIN(buffer, audioContext!.sampleRate, sensitivityRef.current);
          setState((prev) => ({
            ...prev,
            currentNote: result ? frequencyToNote(result.frequency) : null,
          }));
        }, DETECTION_INTERVAL_MS);
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            errorMessage:
              err instanceof Error ? err.message : 'Não foi possível acessar o microfone.',
            currentNote: null,
          });
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      stream?.getTracks().forEach((track) => track.stop());
      audioContext?.close();
    };
  }, []);

  return state;
}
```

The only changes from the current file: the `DEFAULT_THRESHOLD` import, the new `sensitivity` parameter (defaulting to `DEFAULT_THRESHOLD` so existing callers with no argument keep working exactly as before), the `sensitivityRef` mirror effect, and passing `sensitivityRef.current` as `detectPitchYIN`'s third argument instead of relying on its own internal default. The mic-acquisition effect's dependency array stays `[]` — sensitivity changes never re-trigger it.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no type errors. (`ExercisePlayer.tsx` still calls `usePitchTracker()` with no argument at this point in the plan — that's fine, the new parameter is optional.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/usePitchTracker.ts
git commit -m "feat: let usePitchTracker accept an adjustable detection sensitivity"
```

---

### Task 4: `playExerciseTone` returns its gain node

**Files:**
- Modify: `frontend/src/audio/referenceTone.ts` (full replacement)

No test file — same rationale as before (thin Web Audio wrapper).

- [ ] **Step 1: Replace `frontend/src/audio/referenceTone.ts`**

```typescript
import { noteToFrequency } from '../lib/noteUtils';
import { exerciseDuration } from '../lib/exerciseTiming';
import type { Exercise } from '../lib/exercises';

/** Quiet reference tone — it should not drown out the singer's own ears. */
export const REFERENCE_TONE_GAIN = 0.15;

export interface ReferenceTonePlayback {
  oscillator: OscillatorNode;
  gain: GainNode;
}

/**
 * Schedules the exercise's note sequence on an oscillator as the audible reference tone.
 * Returns the oscillator (so the caller can stop it early) and the gain node (so the
 * caller can mute/unmute it) — creating both once and handing back live references
 * rather than only playing the tone as a fire-and-forget side effect.
 */
export function playExerciseTone(audioContext: AudioContext, exercise: Exercise): ReferenceTonePlayback {
  const oscillator = audioContext.createOscillator();
  oscillator.type = 'sine';

  const gain = audioContext.createGain();
  gain.gain.value = REFERENCE_TONE_GAIN;

  oscillator.connect(gain).connect(audioContext.destination);

  const startTime = audioContext.currentTime;
  exercise.notes.forEach((note) => {
    oscillator.frequency.setValueAtTime(noteToFrequency(note.midiNumber), startTime + note.startTime);
  });

  oscillator.start(startTime);
  oscillator.stop(startTime + exerciseDuration(exercise));

  return { oscillator, gain };
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: **1 error, in `ExercisePlayer.tsx`**, because it still does `oscillator = playExerciseTone(...)` expecting an `OscillatorNode` and this function now returns `{oscillator, gain}`. This is the same kind of expected, temporary cross-task inconsistency seen in earlier plans on this codebase — Task 6 fixes it. Confirm the error is specifically about `ExercisePlayer.tsx`'s destructuring/assignment, not about anything inside `referenceTone.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/audio/referenceTone.ts
git commit -m "feat: return the reference tone's gain node so callers can mute it"
```

---

### Task 5: `playbackPreferences` gains a `micSensitivity` field

**Files:**
- Modify: `frontend/src/lib/playbackPreferences.ts` (full replacement)
- Modify: `frontend/src/lib/playbackPreferences.test.ts` (append tests)

- [ ] **Step 1: Append the failing tests to `frontend/src/lib/playbackPreferences.test.ts`**, inside the existing `describe('playbackPreferences', ...)` block, after the last existing test:

```typescript
  it('round-trips micSensitivity through save and load', () => {
    savePlaybackPreferences({ playbackRate: 1, loop: false, micSensitivity: 0.25 });
    expect(loadPlaybackPreferences().micSensitivity).toBe(0.25);
  });

  it('falls back to the default micSensitivity when the stored value is non-finite or non-positive', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ playbackRate: 1, loop: false, micSensitivity: -1 })
    );
    expect(loadPlaybackPreferences().micSensitivity).toBe(
      DEFAULT_PLAYBACK_PREFERENCES.micSensitivity
    );
  });

  it('includes micSensitivity in the defaults', () => {
    expect(DEFAULT_PLAYBACK_PREFERENCES.micSensitivity).toBe(0.15);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- playbackPreferences`
Expected: FAIL — `micSensitivity` doesn't exist on `PlaybackPreferences`/`DEFAULT_PLAYBACK_PREFERENCES` yet, and `loadPlaybackPreferences` doesn't return it.

- [ ] **Step 3: Replace `frontend/src/lib/playbackPreferences.ts`**

```typescript
export interface PlaybackPreferences {
  playbackRate: number;
  loop: boolean;
  micSensitivity: number;
}

const STORAGE_KEY = 'singer-trainer:playback-preferences';

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  playbackRate: 1,
  loop: false,
  micSensitivity: 0.15,
};

/** Reads playback preferences from localStorage, falling back to defaults on any problem. */
export function loadPlaybackPreferences(): PlaybackPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLAYBACK_PREFERENCES;

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_PLAYBACK_PREFERENCES;
    }

    const playbackRate =
      typeof parsed.playbackRate === 'number' &&
      Number.isFinite(parsed.playbackRate) &&
      parsed.playbackRate > 0
        ? parsed.playbackRate
        : DEFAULT_PLAYBACK_PREFERENCES.playbackRate;
    const loop = typeof parsed.loop === 'boolean' ? parsed.loop : DEFAULT_PLAYBACK_PREFERENCES.loop;
    const micSensitivity =
      typeof parsed.micSensitivity === 'number' &&
      Number.isFinite(parsed.micSensitivity) &&
      parsed.micSensitivity > 0
        ? parsed.micSensitivity
        : DEFAULT_PLAYBACK_PREFERENCES.micSensitivity;

    return { playbackRate, loop, micSensitivity };
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
Expected: PASS — 10 tests passed (7 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/playbackPreferences.ts frontend/src/lib/playbackPreferences.test.ts
git commit -m "feat: persist mic sensitivity alongside speed/loop preferences"
```

---

### Task 6: Wire play/pause, mute, and sensitivity into `ExercisePlayer`

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
import { playExerciseTone, REFERENCE_TONE_GAIN } from '../audio/referenceTone';
import { playPreviewTone } from '../audio/previewTone';
import { usePitchTracker } from '../hooks/usePitchTracker';
import { PitchMeter } from './PitchMeter';

export interface ExercisePlayerProps {
  exercise: Exercise;
}

const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2;
const PLAYBACK_RATE_STEP = 0.25;
const MIN_SENSITIVITY = 0.05;
const MAX_SENSITIVITY = 0.35;
const SENSITIVITY_STEP = 0.05;
// The wheel is octave-agnostic, so a clicked bubble always previews in this fixed octave (C4-B4).
const PREVIEW_OCTAVE_BASE_MIDI = 60;
const PREVIEW_CONTEXT_LIFETIME_MS = 600;

export function ExercisePlayer({ exercise }: ExercisePlayerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(() => loadPlaybackPreferences().playbackRate);
  const [loop, setLoop] = useState(() => loadPlaybackPreferences().loop);
  const [micSensitivity, setMicSensitivity] = useState(
    () => loadPlaybackPreferences().micSensitivity
  );
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [toneError, setToneError] = useState<string | null>(null);
  const pitchTracker = usePitchTracker(micSensitivity);

  // Read via refs inside the effect below so toggling these controls mid-playback
  // doesn't restart the currently-playing cycle from scratch.
  const loopRef = useRef(loop);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
    const audioContext = audioContextRef.current;
    if (!audioContext) return;
    if (playing) {
      audioContext.resume().catch(() => {});
    } else {
      audioContext.suspend().catch(() => {});
    }
  }, [playing]);

  const gainRef = useRef<GainNode | null>(null);
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
    const gain = gainRef.current;
    if (!gain) return;
    gain.gain.value = muted ? 0 : REFERENCE_TONE_GAIN;
  }, [muted]);

  useEffect(() => {
    savePlaybackPreferences({ playbackRate, loop, micSensitivity });
  }, [playbackRate, loop, micSensitivity]);

  const scaledExercise = useMemo(
    () => scaleExerciseTiming(exercise, playbackRate),
    [exercise, playbackRate]
  );

  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let hasEnded = false;

    try {
      audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      if (!playingRef.current) {
        audioContext.suspend().catch(() => {});
      }

      const { gain } = playExerciseTone(audioContext, scaledExercise);
      gainRef.current = gain;
      if (mutedRef.current) {
        gain.gain.value = 0;
      }
      setToneError(null);
      setElapsed(0);

      pollTimer = setInterval(() => {
        if (!audioContext) return;
        const currentTime = audioContext.currentTime;
        setElapsed(currentTime);
        if (!hasEnded && currentTime >= exerciseDuration(scaledExercise)) {
          hasEnded = true;
          if (loopRef.current) {
            setCycle((c) => c + 1);
          }
        }
      }, 100);
    } catch (err) {
      setToneError(
        err instanceof Error ? err.message : 'Não foi possível reproduzir o áudio de referência.'
      );
    }

    return () => {
      if (pollTimer) clearInterval(pollTimer);
      audioContext?.close();
      audioContextRef.current = null;
      gainRef.current = null;
    };
  }, [scaledExercise, cycle]);

  const targetNote = noteAtTime(scaledExercise, elapsed);

  function handleNoteClick(pitchClass: number) {
    if (muted) return;
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
        <button
          type="button"
          className="icon-button"
          onClick={() => setPlaying((p) => !p)}
          aria-pressed={!playing}
          aria-label={playing ? 'Pausar' : 'Retomar'}
        >
          {playing ? '⏸' : '▶'}
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          aria-label={muted ? 'Ativar som' : 'Silenciar'}
        >
          {muted ? '🔇' : '🔊'}
        </button>

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

        <label className="speed-control">
          Sensibilidade do microfone
          <input
            type="range"
            min={MIN_SENSITIVITY}
            max={MAX_SENSITIVITY}
            step={SENSITIVITY_STEP}
            value={micSensitivity}
            onChange={(event) => setMicSensitivity(Number(event.target.value))}
          />
          <span className="speed-value">{micSensitivity.toFixed(2)}</span>
        </label>
      </div>
    </section>
  );
}
```

Key behavioral notes for whoever implements/reviews this:
- The old `elapsedTimer`/`loopTimeout` pair is replaced by a single `pollTimer` reading `audioContext.currentTime` (which itself is what freezes/resumes with `suspend()`/`resume()`) instead of `performance.now()`/a real-time `setTimeout` — this is what makes pause genuinely freeze-and-resume rather than just muting while still silently finishing the exercise in the background.
- `hasEnded` is a plain local variable (not state) scoped to one effect run, guarding against the poll firing the loop-check every 100ms after the exercise has already ended.
- A freshly created `AudioContext` immediately checks `playingRef.current`/`mutedRef.current` so switching exercises while paused/muted keeps the new exercise paused/muted too, instead of silently resuming/unmuting.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no type errors. (This resolves the temporary error from Task 4.)

- [ ] **Step 3: Run the full suite**

Run: `cd frontend && npm test`
Expected: PASS — all tests pass. Total should be 74: 68 before this plan, +1 (Task 1), +1 (Task 2), +3 (Task 5) = 68 + 1 + 1 + 3 = 73. Wait — recompute from your actual run rather than trusting this arithmetic; the exact figure matters less than confirming nothing unexpectedly failed or was skipped.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ExercisePlayer.tsx
git commit -m "feat: add play/pause, mute, and mic sensitivity controls"
```

---

### Task 7: Style the new controls

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Widen `.exercise-controls` and add `.icon-button` styles**

In `frontend/src/index.css`, find the existing `.exercise-controls` rule:

```css
.exercise-controls {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 1rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
  width: 100%;
  max-width: 420px;
}
```

Change `max-width: 420px;` to `max-width: 560px;` (more room before the extra controls wrap to a new line) — every other line in that rule stays the same.

Then add this new rule immediately after `.exercise-controls` (before `.speed-control`):

```css
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-text);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.icon-button:hover {
  border-color: var(--color-accent);
}

.icon-button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Run the full suite**

Run: `cd frontend && npm test && npx tsc -b --noEmit`
Expected: PASS — CSS-only change, same test count as after Task 6.

- [ ] **Step 3: Manual visual + functional check**

Run: `cd frontend && npm run dev`, open the app, and confirm:
- The play/pause and mute buttons appear before the speed slider, styled as small round buttons matching the app's dark theme, with a visible focus ring when tabbed to.
- Clicking pause freezes the reference tone and the wheel's target-note highlight exactly where they were (not silence-while-still-progressing) — resuming continues from that exact point, not from the start.
- Muting silences the reference tone; clicking a note bubble while muted produces no preview sound; unmuting restores both.
- Dragging the "Sensibilidade do microfone" slider does not re-trigger the microphone permission prompt or interrupt the live tuning indicator.
- The three new exercises (Arpejo Maior, Escala de 5 Notas, Saltos de Oitava) appear as tabs and play their reference tone correctly.

If you have real browser-automation tooling available, use it to verify what can be checked without literally hearing audio (DOM state, `AudioContext.state` before/after pause, whether `getUserMedia` is called again on a sensitivity change, etc.) — same approach used successfully in earlier tasks on this codebase. Be explicit and honest about what you could/couldn't verify.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: style the play/pause, mute, and sensitivity controls"
```

---

## Out of scope for this plan

- A raw microphone input-gain control (distinct from detection sensitivity) — not implemented, per the spec's rationale that YIN is already amplitude-invariant, so a gain knob wouldn't meaningfully change detection behavior.
- Per-exercise (rather than global) sensitivity/volume preferences.
- Any change to `frontend/src/lib/chromaticWheel.ts` or `frontend/src/components/PitchMeter.tsx`.
