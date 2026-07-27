# Single-Page Redesign, Speed/Loop Controls, and Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the app into a single page with a horizontal tab menu (no more separate "picker" vs "practice" screens), add playback-speed and loop controls to an exercise, and give the whole page a deliberate "Estúdio à noite" visual identity — all without touching the chromatic wheel component or its geometry module, which are already reviewed and tested.

**Architecture:** `ExercisePlayer` becomes always-mounted for whichever exercise is active (switching exercises just changes its `exercise` prop — the mic permission, requested once by `usePitchTracker`, is never re-requested on tab switches). A new pure function, `scaleExerciseTiming`, produces a time-scaled copy of an `Exercise` for a given playback rate, consumed by both the reference-tone player and the target-note lookup. A ref-backed loop flag lets the exercise repeat without restarting mid-playback when the checkbox is toggled. Visual design is a single expanded `index.css` plus two self-hosted variable font packages — no CSS framework, consistent with the rest of the project.

**Tech Stack:** Same as the rest of the frontend (React + TypeScript + Vitest + Testing Library), plus `@fontsource-variable/fraunces` and `@fontsource-variable/manrope` (self-hosted fonts, bundled at build time — no runtime CDN dependency).

**Design reference:** `docs/superpowers/specs/2026-07-26-single-page-redesign.md` (approved spec).

**Regression protection for the wheel/live indicator (explicitly requested):** `frontend/src/lib/chromaticWheel.ts` and `frontend/src/components/PitchMeter.tsx` are NOT modified by any task in this plan — the 51 tests already covering them (15 geometry/color + 8 component) remain untouched and keep guarding that behavior. Task 3 additionally adds a new integration-level test confirming the wheel is still genuinely mounted and rendering inside the redesigned single page.

---

### Task 1: `scaleExerciseTiming` pure function

**Files:**
- Modify: `frontend/src/lib/exerciseTiming.ts` (add one new exported function — `exerciseDuration`/`noteAtTime` stay unchanged)
- Modify: `frontend/src/lib/exerciseTiming.test.ts` (add new test cases — existing ones stay unchanged)

- [ ] **Step 1: Add the failing tests to the end of `frontend/src/lib/exerciseTiming.test.ts`**

```typescript
// append to frontend/src/lib/exerciseTiming.test.ts
import { scaleExerciseTiming } from './exerciseTiming';

describe('scaleExerciseTiming', () => {
  it('shrinks note timings when the rate is greater than 1 (faster)', () => {
    const scaled = scaleExerciseTiming(SAMPLE_EXERCISE, 2);
    expect(scaled.notes.map((n) => n.startTime)).toEqual([0, 0.5, 1]);
    expect(scaled.notes.map((n) => n.duration)).toEqual([0.5, 0.5, 0.5]);
  });

  it('stretches note timings when the rate is less than 1 (slower)', () => {
    const scaled = scaleExerciseTiming(SAMPLE_EXERCISE, 0.5);
    expect(scaled.notes.map((n) => n.startTime)).toEqual([0, 2, 4]);
    expect(scaled.notes.map((n) => n.duration)).toEqual([2, 2, 2]);
  });

  it('leaves timings unchanged at rate 1', () => {
    const scaled = scaleExerciseTiming(SAMPLE_EXERCISE, 1);
    expect(scaled.notes).toEqual(SAMPLE_EXERCISE.notes);
  });

  it('preserves every other exercise field', () => {
    const scaled = scaleExerciseTiming(SAMPLE_EXERCISE, 2);
    expect(scaled.id).toBe(SAMPLE_EXERCISE.id);
    expect(scaled.name).toBe(SAMPLE_EXERCISE.name);
    expect(scaled.category).toBe(SAMPLE_EXERCISE.category);
    expect(scaled.description).toBe(SAMPLE_EXERCISE.description);
  });
});
```

Note: add the `scaleExerciseTiming` import to the existing `import { exerciseDuration, noteAtTime } from './exerciseTiming';` line at the top of the file rather than duplicating a second import statement — end up with a single import line naming all three functions. `SAMPLE_EXERCISE` is the fixture already defined earlier in this file (midi 60/62/64, 1s notes at startTime 0/1/2) — reuse it, don't redefine it.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- exerciseTiming`
Expected: FAIL — `scaleExerciseTiming` is not exported yet.

- [ ] **Step 3: Add the implementation to the end of `frontend/src/lib/exerciseTiming.ts`**

```typescript
// append to frontend/src/lib/exerciseTiming.ts

/**
 * Returns a copy of the exercise with every note's startTime/duration scaled by a
 * playback rate (2 = twice as fast/shorter notes, 0.5 = half speed/longer notes).
 * Does not affect pitch — only timing.
 */
export function scaleExerciseTiming(exercise: Exercise, rate: number): Exercise {
  return {
    ...exercise,
    notes: exercise.notes.map((note) => ({
      ...note,
      startTime: note.startTime / rate,
      duration: note.duration / rate,
    })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- exerciseTiming`
Expected: PASS — 8 tests passed (4 existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/exerciseTiming.ts frontend/src/lib/exerciseTiming.test.ts
git commit -m "feat: add scaleExerciseTiming for adjustable playback speed"
```

---

### Task 2: Rewrite `ExercisePlayer` — remove Voltar, add speed/loop controls, handle tone errors gracefully

**Files:**
- Modify: `frontend/src/components/ExercisePlayer.tsx` (full rewrite)

No test file — same rationale as before (this component owns `AudioContext`/`getUserMedia`, browser-only APIs outside jsdom's reach). It's verified via Task 3's `App.test.tsx` (which now can safely mount it, see below) and via manual check in Task 4.

- [ ] **Step 1: Replace `frontend/src/components/ExercisePlayer.tsx`**

```tsx
// frontend/src/components/ExercisePlayer.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise } from '../lib/exercises';
import { exerciseDuration, noteAtTime, scaleExerciseTiming } from '../lib/exerciseTiming';
import { playExerciseTone } from '../audio/referenceTone';
import { usePitchTracker } from '../hooks/usePitchTracker';
import { PitchMeter } from './PitchMeter';

export interface ExercisePlayerProps {
  exercise: Exercise;
}

const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2;
const PLAYBACK_RATE_STEP = 0.25;
const DEFAULT_PLAYBACK_RATE = 1;

export function ExercisePlayer({ exercise }: ExercisePlayerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_PLAYBACK_RATE);
  const [loop, setLoop] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [toneError, setToneError] = useState<string | null>(null);
  const pitchTracker = usePitchTracker();

  // Read via a ref inside the effect below so toggling "loop" mid-playback doesn't
  // restart the currently-playing cycle — it only decides what happens once the
  // *current* cycle naturally ends.
  const loopRef = useRef(loop);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

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

Note the wheel is now rendered **unconditionally** (not gated on `pitchTracker.status === 'listening'`) — `detectedNote` is explicitly `null` unless actually listening, and `PitchMeter` already renders all 12 bubbles plus the target highlight with a `null` `detectedNote` (it just omits the live indicator, exactly as designed). This means the user sees the wheel and target note immediately, even while the mic permission prompt is pending — and it's what makes Task 3's new regression test possible without mocking Web Audio/mic APIs.

The `try/catch` around `new AudioContext()` is what keeps this component from crashing in a browser/environment without Web Audio support (and, as a side effect, in jsdom during tests, where `AudioContext` doesn't exist at all) — it degrades to a visible error message instead of throwing.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ExercisePlayer.tsx
git commit -m "feat: add speed/loop controls to ExercisePlayer, drop the Voltar screen"
```

---

### Task 3: Rewrite `App` as a single page with a tab menu, add the wheel regression test

**Files:**
- Modify: `frontend/src/App.tsx` (full rewrite)
- Modify: `frontend/src/App.test.tsx` (full rewrite)

- [ ] **Step 1: Replace `frontend/src/App.test.tsx` with the new failing tests**

```tsx
// frontend/src/App.test.tsx
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { BUILTIN_EXERCISES } from './lib/exercises';

describe('App', () => {
  it('lists every built-in exercise as a tab', () => {
    render(<App />);
    BUILTIN_EXERCISES.forEach((exercise) => {
      expect(screen.getByRole('tab', { name: exercise.name })).toBeDefined();
    });
  });

  it('shows the first exercise selected and displayed by default', () => {
    render(<App />);
    const firstTab = screen.getByRole('tab', { name: BUILTIN_EXERCISES[0].name });
    expect(firstTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('heading', { name: BUILTIN_EXERCISES[0].name })).toBeDefined();
  });

  it('switches the displayed exercise when a different tab is clicked', () => {
    render(<App />);
    const secondExercise = BUILTIN_EXERCISES[1];
    fireEvent.click(screen.getByRole('tab', { name: secondExercise.name }));
    expect(
      screen.getByRole('tab', { name: secondExercise.name }).getAttribute('aria-selected')
    ).toBe('true');
    expect(screen.getByRole('heading', { name: secondExercise.name })).toBeDefined();
  });

  it('renders the chromatic wheel with all 12 note bubbles for the active exercise', () => {
    render(<App />);
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((name) => {
      expect(screen.getByTestId(`note-bubble-${name}`)).toBeDefined();
    });
  });
});
```

That last test is the regression guard the plan's spec calls for: it confirms the chromatic wheel is genuinely mounted and rendering inside the redesigned single page, not just that `ExercisePlayer` renders *something*. `chromaticWheel.ts`/`PitchMeter.tsx` themselves are untouched by this whole plan — their own 15+8 tests (unchanged) are what protects their internal correctness; this new test protects the *integration point*.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- App`
Expected: FAIL — the old picker-only `App.tsx` has no `role="tab"` elements and never mounts `ExercisePlayer`, so none of the 4 new assertions can find what they're looking for.

- [ ] **Step 3: Replace `frontend/src/App.tsx`**

```tsx
// frontend/src/App.tsx
import { useState } from 'react';
import { BUILTIN_EXERCISES } from './lib/exercises';
import { ExercisePlayer } from './components/ExercisePlayer';

export default function App() {
  const [activeExerciseId, setActiveExerciseId] = useState(BUILTIN_EXERCISES[0].id);
  const activeExercise =
    BUILTIN_EXERCISES.find((exercise) => exercise.id === activeExerciseId) ?? BUILTIN_EXERCISES[0];

  return (
    <main className="app">
      <header className="app-header">
        <h1 className="app-title">Singer Trainer</h1>
        <p className="app-subtitle">Feedback de afinação em tempo real, ao vivo.</p>
      </header>

      <nav className="exercise-tabs" role="tablist" aria-label="Exercícios">
        {BUILTIN_EXERCISES.map((exercise) => (
          <button
            key={exercise.id}
            type="button"
            role="tab"
            aria-selected={exercise.id === activeExerciseId}
            className="exercise-tab"
            onClick={() => setActiveExerciseId(exercise.id)}
          >
            {exercise.name}
          </button>
        ))}
      </nav>

      <ExercisePlayer exercise={activeExercise} />
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS — all tests across all files pass. `App.test.tsx` should show 4 passed tests. Total suite count should be 58: 51 before this plan, +4 from Task 1's `scaleExerciseTiming` tests, +3 net from replacing `App.test.tsx`'s 1 old test with these 4 new ones (51 + 4 + 4 − 1 = 58). Confirm this against your actual run rather than assuming — if it doesn't match, something unexpected happened and is worth investigating before moving on.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: replace exercise picker with an always-visible tab menu"
```

---

### Task 4: Visual redesign — "Estúdio à noite"

**Files:**
- Modify: `frontend/package.json` / `frontend/package-lock.json` (two new dependencies)
- Modify: `frontend/src/main.tsx` (two new imports)
- Modify: `frontend/src/index.css` (full rewrite)

- [ ] **Step 1: Install the font packages**

Run: `cd frontend && npm install @fontsource-variable/fraunces @fontsource-variable/manrope`
Expected: installs without errors, adds two entries to `dependencies` in `package.json`.

If either package name doesn't resolve (e.g. renamed upstream), STOP and report back with the exact npm error rather than guessing a substitute package name.

- [ ] **Step 2: Add the font imports to `frontend/src/main.tsx`**

Add these two lines at the very top of the file, before the existing imports:

```tsx
import '@fontsource-variable/fraunces';
import '@fontsource-variable/manrope';
```

The full file should read:

```tsx
// frontend/src/main.tsx
import '@fontsource-variable/fraunces';
import '@fontsource-variable/manrope';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: Replace `frontend/src/index.css`**

```css
:root {
  color-scheme: dark;
  --color-bg: #14110f;
  --color-bg-elevated: #1e1a17;
  --color-text: #f2ece4;
  --color-text-muted: #a89e93;
  --color-accent: #e8a33d;
  --color-accent-soft: rgba(232, 163, 61, 0.18);
  --color-border: #2c2521;
  --color-danger: #e8734d;
  --font-display: 'Fraunces Variable', Georgia, serif;
  --font-body: 'Manrope Variable', system-ui, sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
}

#root {
  min-height: 100vh;
}

.app {
  max-width: 880px;
  margin: 0 auto;
  padding: 3rem 1.5rem 4rem;
}

.app-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.app-title {
  font-family: var(--font-display);
  font-size: 2.75rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0 0 0.5rem;
}

.app-subtitle {
  color: var(--color-text-muted);
  margin: 0;
  font-size: 1rem;
}

.exercise-tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 2.5rem;
}

.exercise-tab {
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.6rem 1.25rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.exercise-tab:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.exercise-tab[aria-selected='true'] {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #1a1508;
}

.exercise-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.exercise-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}

.exercise-description {
  color: var(--color-text-muted);
  max-width: 480px;
  margin: 0 0 2rem;
  line-height: 1.5;
}

.status-message {
  color: var(--color-text-muted);
  font-size: 0.95rem;
  margin: 0 0 1rem;
}

.status-message[role='alert'] {
  color: var(--color-danger);
}

.wheel-stage {
  position: relative;
  width: min(100%, 360px);
  margin-bottom: 2rem;
}

.wheel-stage::before {
  content: '';
  position: absolute;
  inset: -20%;
  background: radial-gradient(circle, var(--color-accent-soft) 0%, transparent 70%);
  z-index: 0;
  pointer-events: none;
}

.wheel-stage > svg {
  position: relative;
  z-index: 1;
}

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

.speed-control {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.speed-control input[type='range'] {
  accent-color: var(--color-accent);
  width: 120px;
}

.speed-value {
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
  min-width: 3ch;
}

.loop-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
}

.loop-toggle input {
  accent-color: var(--color-accent);
  width: 1.1rem;
  height: 1.1rem;
  cursor: pointer;
}
```

- [ ] **Step 4: Run the full suite**

Run: `cd frontend && npm test && npx tsc -b --noEmit`
Expected: PASS — CSS/font changes don't affect any test's DOM structure or assertions (all class-based selectors used above are new additions, not replacements of anything a test queries by class). Confirm the count matches Task 3's final count exactly.

- [ ] **Step 5: Manual visual check**

Run: `cd frontend && npm run dev`, open the app, and confirm by eye:
- Dark background, warm off-white text, the serif display font on "Singer Trainer" and the exercise title, the sans body font elsewhere.
- Horizontal pill-shaped tabs at the top; the active one filled in amber; clicking a different tab switches the exercise below without any page reload or flash, and does **not** re-trigger the microphone permission prompt (grant it once, then click through all four tabs).
- A soft amber glow visible behind the chromatic wheel.
- The speed slider changes the reference tone's pace when dragged (faster notes when increased, slower when decreased) — listen for it.
- Checking "Repetir" makes the exercise restart automatically when it finishes; unchecking it lets the exercise stop normally at the end of the current cycle without restarting.

This is a visual/aesthetic + functional smoke check, not a strict pass/fail gate — note anything that looks visually broken or behaves unexpectedly, but don't block on subjective polish.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/main.tsx frontend/src/index.css
git commit -m "feat: apply the Estúdio à noite visual redesign"
```

---

## Out of scope for this plan

- Persisting the chosen speed/loop settings across tab switches, exercise changes, or page reloads (they reset to defaults each time a fresh `ExercisePlayer` mount would otherwise apply — in practice here, since `ExercisePlayer` stays mounted across tab switches, speed/loop actually *do* persist across tabs by virtue of being component state that isn't reset per-exercise; only a full page reload resets them. This is acceptable default behavior, not something to special-case either way).
- Any change to `frontend/src/lib/chromaticWheel.ts`, `frontend/src/components/PitchMeter.tsx`, `frontend/src/hooks/usePitchTracker.ts`, or `frontend/src/audio/referenceTone.ts` — none of them need to change for this plan, and none of them should be touched.
- Recording, history, or repertoire features — still out of scope for the overall MVP.
