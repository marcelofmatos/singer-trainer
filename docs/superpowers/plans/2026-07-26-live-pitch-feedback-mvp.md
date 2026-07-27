# Live Pitch Feedback MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone browser app that gives real-time visual feedback of singing pitch accuracy against a built-in vocal exercise — the core reason this whole project exists, with no backend/database/Docker required for this slice.

**Architecture:** A Vite + React + TypeScript single-page app. All audio work happens client-side: a YIN pitch detector reads microphone input via the Web Audio `AnalyserNode`, exercises are defined as note sequences played back through an `OscillatorNode` for the reference tone, and a tuning-gauge component renders the live comparison between target note and detected note. No server, no recording/upload — those are later plans (backend API, Python analysis service, Docker stack, repertoire/progress screens), per the broader architecture roadmap agreed on before this slice was built.

**Tech Stack:** Vite, React 18, TypeScript, Vitest (+ jsdom) for unit tests of pure logic.

**Test scope note:** Per the approved spec, automated tests cover the pitch-detection/music-theory *logic* (pitch algorithm, note math, tuning-gauge math, exercise data) with synthetic inputs — that's the riskiest code to get wrong. React components that touch the DOM, `getUserMedia`, or `AudioContext` are implementation steps verified manually in a real browser with a real microphone (there's no test double worth the complexity for a one-person tool); each such task ends with a manual verification step instead of an automated test run.

**Detection rate note:** The naive YIN difference function is O(n²) over half the buffer size. A buffer large enough to track low vocal pitches (down to ~55Hz) is 4096 samples, making an O(2048²) pass too heavy to run on every animation frame. The pitch tracker instead re-detects on a 50ms interval (20 times/sec) — plenty fast for a tuning display a human eye can follow, and cheap enough for any modern CPU.

---

### Task 1: Project scaffold (Vite + React + TS + Vitest)

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/App.test.tsx`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "singer-trainer-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.3",
    "vite": "^5.4.1",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

- [ ] **Step 4: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Singer Trainer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `frontend/src/index.css`**

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
}

#root {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
```

- [ ] **Step 6: Create `frontend/src/main.tsx`**

```tsx
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

- [ ] **Step 7: Create `frontend/src/App.tsx`** (placeholder — Task 10 replaces the body)

```tsx
export default function App() {
  return (
    <main>
      <h1>Singer Trainer</h1>
      <p>Treino de canto com feedback de afinação em tempo real.</p>
    </main>
  );
}
```

- [ ] **Step 8: Create `frontend/src/App.test.tsx`** (sanity test that the toolchain works)

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText('Singer Trainer')).toBeDefined();
  });
});
```

- [ ] **Step 9: Install dependencies**

Run: `cd frontend && npm install`
Expected: installs without errors, creates `frontend/node_modules` and `frontend/package-lock.json`.

- [ ] **Step 10: Run the test suite to verify the toolchain works**

Run: `cd frontend && npm test`
Expected: PASS — 1 test passed (`App > renders the app title`).

- [ ] **Step 11: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html frontend/src/main.tsx frontend/src/index.css frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: scaffold Vite+React+TS frontend with Vitest"
```

---

### Task 2: YIN pitch detection algorithm

**Files:**
- Create: `frontend/src/lib/pitchDetection.ts`
- Test: `frontend/src/lib/pitchDetection.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/lib/pitchDetection.test.ts
import { describe, expect, it } from 'vitest';
import { detectPitchYIN } from './pitchDetection';

const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 4096;

function generateSineWave(frequency: number, sampleRate: number, length: number): Float32Array {
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return buffer;
}

describe('detectPitchYIN', () => {
  it('detects a 440Hz sine wave (A4) within 2Hz', () => {
    const buffer = generateSineWave(440, SAMPLE_RATE, BUFFER_SIZE);
    const result = detectPitchYIN(buffer, SAMPLE_RATE);
    expect(result).not.toBeNull();
    expect(Math.abs(result!.frequency - 440)).toBeLessThan(2);
  });

  it('detects a 110Hz sine wave (A2, low male voice range) within 2Hz', () => {
    const buffer = generateSineWave(110, SAMPLE_RATE, BUFFER_SIZE);
    const result = detectPitchYIN(buffer, SAMPLE_RATE);
    expect(result).not.toBeNull();
    expect(Math.abs(result!.frequency - 110)).toBeLessThan(2);
  });

  it('detects a 880Hz sine wave (A5, high voice range) within 4Hz', () => {
    const buffer = generateSineWave(880, SAMPLE_RATE, BUFFER_SIZE);
    const result = detectPitchYIN(buffer, SAMPLE_RATE);
    expect(result).not.toBeNull();
    expect(Math.abs(result!.frequency - 880)).toBeLessThan(4);
  });

  it('returns null for silence', () => {
    const buffer = new Float32Array(BUFFER_SIZE);
    const result = detectPitchYIN(buffer, SAMPLE_RATE);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- pitchDetection`
Expected: FAIL with a module-not-found error for `./pitchDetection`.

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/lib/pitchDetection.ts
export interface PitchResult {
  frequency: number;
  probability: number;
}

const DEFAULT_THRESHOLD = 0.15;

/**
 * YIN pitch detection (de Cheveigné & Kawahara, 2002).
 * Returns null when no clear periodicity is found (silence/unvoiced audio).
 */
export function detectPitchYIN(
  buffer: Float32Array,
  sampleRate: number,
  threshold: number = DEFAULT_THRESHOLD
): PitchResult | null {
  const halfBufferSize = Math.floor(buffer.length / 2);
  const yinBuffer = new Float32Array(halfBufferSize);

  // Step 1: difference function
  for (let tau = 0; tau < halfBufferSize; tau++) {
    let sum = 0;
    for (let i = 0; i < halfBufferSize; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    yinBuffer[tau] = sum;
  }

  // Step 2: cumulative mean normalized difference function
  yinBuffer[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfBufferSize; tau++) {
    runningSum += yinBuffer[tau];
    yinBuffer[tau] = runningSum === 0 ? 1 : (yinBuffer[tau] * tau) / runningSum;
  }

  // Step 3: absolute threshold — first dip below threshold, walked to its local minimum
  let tauEstimate = -1;
  for (let tau = 2; tau < halfBufferSize; tau++) {
    if (yinBuffer[tau] < threshold) {
      while (tau + 1 < halfBufferSize && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate === -1) {
    return null;
  }

  // Step 4: parabolic interpolation around the estimate for sub-sample accuracy
  const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1;
  const x2 = tauEstimate + 1 < halfBufferSize ? tauEstimate + 1 : tauEstimate;

  let betterTau = tauEstimate;
  if (x0 !== tauEstimate && x2 !== tauEstimate) {
    const s0 = yinBuffer[x0];
    const s1 = yinBuffer[tauEstimate];
    const s2 = yinBuffer[x2];
    const denominator = 2 * (2 * s1 - s2 - s0);
    if (denominator !== 0) {
      betterTau = tauEstimate + (s2 - s0) / denominator;
    }
  }

  return {
    frequency: sampleRate / betterTau,
    probability: 1 - yinBuffer[tauEstimate],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- pitchDetection`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/pitchDetection.ts frontend/src/lib/pitchDetection.test.ts
git commit -m "feat: add YIN pitch detection algorithm"
```

---

### Task 3: Note/frequency music-theory utilities

**Files:**
- Create: `frontend/src/lib/noteUtils.ts`
- Test: `frontend/src/lib/noteUtils.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/lib/noteUtils.test.ts
import { describe, expect, it } from 'vitest';
import { frequencyToNote, noteToFrequency } from './noteUtils';

describe('frequencyToNote', () => {
  it('identifies A4 (440Hz) with 0 cents', () => {
    const note = frequencyToNote(440);
    expect(note.noteName).toBe('A');
    expect(note.octave).toBe(4);
    expect(note.midiNumber).toBe(69);
    expect(note.cents).toBe(0);
  });

  it('identifies C4 (middle C, 261.63Hz)', () => {
    const note = frequencyToNote(261.63);
    expect(note.noteName).toBe('C');
    expect(note.octave).toBe(4);
    expect(note.midiNumber).toBe(60);
  });

  it('reports positive cents when singing sharp', () => {
    // ~38 cents above A4
    const note = frequencyToNote(450);
    expect(note.noteName).toBe('A');
    expect(note.cents).toBeGreaterThan(30);
    expect(note.cents).toBeLessThan(45);
  });

  it('reports negative cents when singing flat', () => {
    // ~38 cents below A4
    const note = frequencyToNote(430);
    expect(note.noteName).toBe('A');
    expect(note.cents).toBeLessThan(-30);
    expect(note.cents).toBeGreaterThan(-45);
  });
});

describe('noteToFrequency', () => {
  it('converts MIDI 69 (A4) to 440Hz', () => {
    expect(noteToFrequency(69)).toBeCloseTo(440, 5);
  });

  it('converts MIDI 60 (C4) to ~261.63Hz', () => {
    expect(noteToFrequency(60)).toBeCloseTo(261.63, 1);
  });

  it('round-trips through frequencyToNote', () => {
    const freq = noteToFrequency(64); // E4
    const note = frequencyToNote(freq);
    expect(note.midiNumber).toBe(64);
    expect(note.cents).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- noteUtils`
Expected: FAIL with a module-not-found error for `./noteUtils`.

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/lib/noteUtils.ts
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const A4_FREQUENCY = 440;
const A4_MIDI = 69;

export interface NoteInfo {
  noteName: string;
  octave: number;
  midiNumber: number;
  cents: number;
}

/** Converts a MIDI note number (69 = A4) to its frequency in Hz. */
export function noteToFrequency(midiNumber: number): number {
  return A4_FREQUENCY * Math.pow(2, (midiNumber - A4_MIDI) / 12);
}

/** Converts a frequency in Hz to the nearest note name/octave and the deviation in cents. */
export function frequencyToNote(frequency: number): NoteInfo {
  const midiNumberFloat = A4_MIDI + 12 * Math.log2(frequency / A4_FREQUENCY);
  const midiNumber = Math.round(midiNumberFloat);
  const cents = Math.round((midiNumberFloat - midiNumber) * 100);
  const noteName = NOTE_NAMES[((midiNumber % 12) + 12) % 12];
  const octave = Math.floor(midiNumber / 12) - 1;
  return { noteName, octave, midiNumber, cents };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- noteUtils`
Expected: PASS — 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/noteUtils.ts frontend/src/lib/noteUtils.test.ts
git commit -m "feat: add note/frequency music-theory utilities"
```

---

### Task 4: Tuning-gauge math utilities

**Files:**
- Create: `frontend/src/lib/tuningGauge.ts`
- Test: `frontend/src/lib/tuningGauge.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/lib/tuningGauge.test.ts
import { describe, expect, it } from 'vitest';
import { centsToGaugePercent, tuningStatus } from './tuningGauge';

describe('centsToGaugePercent', () => {
  it('maps 0 cents to the center (50%)', () => {
    expect(centsToGaugePercent(0)).toBe(50);
  });

  it('maps -50 cents (or below) to 0%', () => {
    expect(centsToGaugePercent(-50)).toBe(0);
    expect(centsToGaugePercent(-100)).toBe(0);
  });

  it('maps +50 cents (or above) to 100%', () => {
    expect(centsToGaugePercent(50)).toBe(100);
    expect(centsToGaugePercent(100)).toBe(100);
  });

  it('maps +25 cents to 75%', () => {
    expect(centsToGaugePercent(25)).toBe(75);
  });
});

describe('tuningStatus', () => {
  it('is "in-tune" within 10 cents', () => {
    expect(tuningStatus(0)).toBe('in-tune');
    expect(tuningStatus(10)).toBe('in-tune');
    expect(tuningStatus(-10)).toBe('in-tune');
  });

  it('is "close" between 10 and 25 cents', () => {
    expect(tuningStatus(15)).toBe('close');
    expect(tuningStatus(-20)).toBe('close');
  });

  it('is "off" beyond 25 cents', () => {
    expect(tuningStatus(30)).toBe('off');
    expect(tuningStatus(-40)).toBe('off');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- tuningGauge`
Expected: FAIL with a module-not-found error for `./tuningGauge`.

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/lib/tuningGauge.ts
export type TuningStatus = 'in-tune' | 'close' | 'off';

/** Maps a cents deviation to a 0-100 horizontal gauge position (50 = perfectly in tune). */
export function centsToGaugePercent(cents: number, maxCents = 50): number {
  const clamped = Math.max(-maxCents, Math.min(maxCents, cents));
  return ((clamped + maxCents) / (2 * maxCents)) * 100;
}

/** Classifies a cents deviation into a tuning status for color-coding the UI. */
export function tuningStatus(cents: number): TuningStatus {
  const abs = Math.abs(cents);
  if (abs <= 10) return 'in-tune';
  if (abs <= 25) return 'close';
  return 'off';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- tuningGauge`
Expected: PASS — 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/tuningGauge.ts frontend/src/lib/tuningGauge.test.ts
git commit -m "feat: add tuning-gauge math utilities"
```

---

### Task 5: Exercise data model and built-in exercise library

**Files:**
- Create: `frontend/src/lib/exercises.ts`
- Test: `frontend/src/lib/exercises.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/lib/exercises.test.ts
import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES, buildScale } from './exercises';

describe('buildScale', () => {
  it('builds an up-and-down sequence from root + intervals', () => {
    const notes = buildScale(60, [0, 2, 4], 1);
    // up: 60, 62, 64 — down: 62, 60 (last-note-of-up not repeated)
    expect(notes.map((n) => n.midiNumber)).toEqual([60, 62, 64, 62, 60]);
  });

  it('assigns sequential, non-overlapping start times', () => {
    const notes = buildScale(60, [0, 2, 4], 0.5);
    expect(notes.map((n) => n.startTime)).toEqual([0, 0.5, 1, 1.5, 2]);
    notes.forEach((note) => expect(note.duration).toBe(0.5));
  });
});

describe('BUILTIN_EXERCISES', () => {
  it('has at least 4 exercises covering warmup, scale and breathing categories', () => {
    expect(BUILTIN_EXERCISES.length).toBeGreaterThanOrEqual(4);
    const categories = new Set(BUILTIN_EXERCISES.map((e) => e.category));
    expect(categories.has('escala')).toBe(true);
    expect(categories.has('aquecimento')).toBe(true);
    expect(categories.has('respiracao')).toBe(true);
  });

  it('gives every exercise a unique id and at least one note', () => {
    const ids = BUILTIN_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    BUILTIN_EXERCISES.forEach((exercise) => {
      expect(exercise.notes.length).toBeGreaterThan(0);
    });
  });

  it('keeps every exercise note sequence sorted by start time', () => {
    BUILTIN_EXERCISES.forEach((exercise) => {
      for (let i = 1; i < exercise.notes.length; i++) {
        expect(exercise.notes[i].startTime).toBeGreaterThanOrEqual(exercise.notes[i - 1].startTime);
      }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- exercises`
Expected: FAIL with a module-not-found error for `./exercises`.

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/lib/exercises.ts
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
    description: 'Deslize a voz de Dó4 até Dó5 e volta, suave e contínuo, para soltar a laringe.',
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
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- exercises`
Expected: PASS — 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/exercises.ts frontend/src/lib/exercises.test.ts
git commit -m "feat: add exercise data model and built-in exercise library"
```

---

### Task 6: Exercise timing utilities

**Files:**
- Create: `frontend/src/lib/exerciseTiming.ts`
- Test: `frontend/src/lib/exerciseTiming.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/lib/exerciseTiming.test.ts
import { describe, expect, it } from 'vitest';
import { exerciseDuration, noteAtTime } from './exerciseTiming';
import type { Exercise } from './exercises';

const SAMPLE_EXERCISE: Exercise = {
  id: 'sample',
  name: 'Sample',
  category: 'escala',
  description: 'test fixture',
  notes: [
    { midiNumber: 60, startTime: 0, duration: 1 },
    { midiNumber: 62, startTime: 1, duration: 1 },
    { midiNumber: 64, startTime: 2, duration: 1 },
  ],
};

describe('exerciseDuration', () => {
  it('returns the end time of the last note', () => {
    expect(exerciseDuration(SAMPLE_EXERCISE)).toBe(3);
  });
});

describe('noteAtTime', () => {
  it('returns the note active at a given elapsed time', () => {
    expect(noteAtTime(SAMPLE_EXERCISE, 0)?.midiNumber).toBe(60);
    expect(noteAtTime(SAMPLE_EXERCISE, 1.5)?.midiNumber).toBe(62);
    expect(noteAtTime(SAMPLE_EXERCISE, 2.9)?.midiNumber).toBe(64);
  });

  it('returns null once the exercise has ended', () => {
    expect(noteAtTime(SAMPLE_EXERCISE, 3)).toBeNull();
    expect(noteAtTime(SAMPLE_EXERCISE, 10)).toBeNull();
  });

  it('returns null before the exercise starts', () => {
    expect(noteAtTime(SAMPLE_EXERCISE, -1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- exerciseTiming`
Expected: FAIL with a module-not-found error for `./exerciseTiming`.

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/lib/exerciseTiming.ts
import type { Exercise, ExerciseNote } from './exercises';

/** Total duration of an exercise, in seconds, from the end time of its last note. */
export function exerciseDuration(exercise: Exercise): number {
  return exercise.notes.reduce((max, note) => Math.max(max, note.startTime + note.duration), 0);
}

/** Finds the note that should be sounding at a given elapsed time, or null if none is. */
export function noteAtTime(exercise: Exercise, elapsedSeconds: number): ExerciseNote | null {
  const match = exercise.notes.find(
    (note) => elapsedSeconds >= note.startTime && elapsedSeconds < note.startTime + note.duration
  );
  return match ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- exerciseTiming`
Expected: PASS — 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/exerciseTiming.ts frontend/src/lib/exerciseTiming.test.ts
git commit -m "feat: add exercise timing utilities"
```

---

### Task 7: Reference tone player (Web Audio oscillator)

**Files:**
- Create: `frontend/src/audio/referenceTone.ts`

This module drives real browser audio hardware (`AudioContext`/`OscillatorNode`) and has no meaningful behavior outside a browser, so it is verified manually (Step 3) rather than with a jsdom unit test — consistent with the plan's test-scope note.

- [ ] **Step 1: Write the implementation**

```typescript
// frontend/src/audio/referenceTone.ts
import { noteToFrequency } from '../lib/noteUtils';
import { exerciseDuration } from '../lib/exerciseTiming';
import type { Exercise } from '../lib/exercises';

/**
 * Schedules the exercise's note sequence on an oscillator as the audible reference tone.
 * Returns the oscillator so the caller can stop it early if the user cancels.
 */
export function playExerciseTone(audioContext: AudioContext, exercise: Exercise): OscillatorNode {
  const oscillator = audioContext.createOscillator();
  oscillator.type = 'sine';

  const gain = audioContext.createGain();
  gain.gain.value = 0.15; // quiet reference tone — it should not drown out the singer's own ears

  oscillator.connect(gain).connect(audioContext.destination);

  const startTime = audioContext.currentTime;
  exercise.notes.forEach((note) => {
    oscillator.frequency.setValueAtTime(noteToFrequency(note.midiNumber), startTime + note.startTime);
  });

  oscillator.start(startTime);
  oscillator.stop(startTime + exerciseDuration(exercise));

  return oscillator;
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no type errors.

- [ ] **Step 3: Manual verification**

In a scratch file or the browser devtools console on a page that has called `new AudioContext()` after a user gesture (autoplay policies require this), call `playExerciseTone(audioContext, BUILTIN_EXERCISES[0])` and confirm you hear the ascending/descending scale tone. (This gets easier to check end-to-end once Task 10 wires it into the UI — it's fine to defer the actual listen to that point and just type-check here.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/audio/referenceTone.ts
git commit -m "feat: add reference tone player"
```

---

### Task 8: Live pitch tracker hook

**Files:**
- Create: `frontend/src/hooks/usePitchTracker.ts`

This hook owns `getUserMedia`/`AudioContext` — browser-only APIs not present in jsdom — so it's verified manually in Task 10's end-to-end check rather than unit tested.

- [ ] **Step 1: Write the implementation**

```typescript
// frontend/src/hooks/usePitchTracker.ts
import { useEffect, useState } from 'react';
import { detectPitchYIN } from '../lib/pitchDetection';
import { frequencyToNote, type NoteInfo } from '../lib/noteUtils';

export type PitchTrackerStatus = 'requesting' | 'listening' | 'error';

export interface PitchTrackerState {
  status: PitchTrackerStatus;
  errorMessage: string | null;
  currentNote: NoteInfo | null;
}

const BUFFER_SIZE = 4096;
const DETECTION_INTERVAL_MS = 50; // see plan's "Detection rate note"

/** Listens to the microphone and reports the detected note ~20 times/sec until unmounted. */
export function usePitchTracker(): PitchTrackerState {
  const [state, setState] = useState<PitchTrackerState>({
    status: 'requesting',
    errorMessage: null,
    currentNote: null,
  });

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) return;

        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = BUFFER_SIZE;
        source.connect(analyser);

        const buffer = new Float32Array(analyser.fftSize);
        setState((prev) => ({ ...prev, status: 'listening' }));

        intervalId = setInterval(() => {
          analyser.getFloatTimeDomainData(buffer);
          const result = detectPitchYIN(buffer, audioContext!.sampleRate);
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

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/usePitchTracker.ts
git commit -m "feat: add live pitch tracker hook"
```

---

### Task 9: Tuning meter visual component

**Files:**
- Create: `frontend/src/components/PitchMeter.tsx`
- Test: `frontend/src/components/PitchMeter.test.tsx`

The gauge *math* is already unit-tested (Task 4); this component test only checks that the right text/attributes render for a given props combination, using Testing Library with jsdom (no real audio involved, so this one is fine to automate).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/PitchMeter.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PitchMeter } from './PitchMeter';

describe('PitchMeter', () => {
  it('shows a placeholder when no note is detected', () => {
    render(<PitchMeter detectedNote={null} targetMidiNumber={null} />);
    expect(screen.getByText('—')).toBeDefined();
  });

  it('shows the detected note name and octave', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
      />
    );
    expect(screen.getByText('A4')).toBeDefined();
  });

  it('labels the needle as in tune when within 10 cents of the target', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
      />
    );
    expect(screen.getByTestId('tuning-needle').dataset.status).toBe('in-tune');
  });

  it('labels the needle as off when far from the target', () => {
    render(
      <PitchMeter
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 40 }}
        targetMidiNumber={69}
      />
    );
    expect(screen.getByTestId('tuning-needle').dataset.status).toBe('off');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- PitchMeter`
Expected: FAIL with a module-not-found error for `./PitchMeter`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/components/PitchMeter.tsx
import { centsToGaugePercent, tuningStatus } from '../lib/tuningGauge';
import { frequencyToNote, type NoteInfo } from '../lib/noteUtils';

export interface PitchMeterProps {
  detectedNote: NoteInfo | null;
  /** The exercise's current target note, if one is playing. */
  targetMidiNumber: number | null;
}

export function PitchMeter({ detectedNote, targetMidiNumber }: PitchMeterProps) {
  const label = detectedNote ? `${detectedNote.noteName}${detectedNote.octave}` : '—';

  // Cents relative to the exercise's target note (if any), otherwise relative to the
  // nearest chromatic note — i.e. plain-tuner mode.
  const cents =
    detectedNote && targetMidiNumber !== null
      ? Math.round((detectedNote.midiNumber - targetMidiNumber) * 100 + detectedNote.cents)
      : (detectedNote?.cents ?? 0);

  const status = detectedNote ? tuningStatus(cents) : null;
  const gaugePercent = centsToGaugePercent(cents);

  return (
    <div>
      <p style={{ fontSize: '3rem', margin: 0, textAlign: 'center' }}>{label}</p>
      <div
        style={{
          position: 'relative',
          height: '1rem',
          background: 'linear-gradient(to right, #d33, #3a3, #d33)',
          borderRadius: '999px',
        }}
      >
        <div
          data-testid="tuning-needle"
          data-status={status ?? 'none'}
          style={{
            position: 'absolute',
            left: `${gaugePercent}%`,
            top: '-0.25rem',
            width: '0.25rem',
            height: '1.5rem',
            background: 'black',
            transform: 'translateX(-50%)',
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- PitchMeter`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PitchMeter.tsx frontend/src/components/PitchMeter.test.tsx
git commit -m "feat: add tuning meter visual component"
```

---

### Task 10: Exercise player screen and app wiring

**Files:**
- Create: `frontend/src/components/ExercisePlayer.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Update the failing test for the new App behavior**

Replace the contents of `frontend/src/App.test.tsx`:

```tsx
// frontend/src/App.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { BUILTIN_EXERCISES } from './lib/exercises';

describe('App', () => {
  it('lists every built-in exercise for picking', () => {
    render(<App />);
    BUILTIN_EXERCISES.forEach((exercise) => {
      expect(screen.getByText(exercise.name)).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- App`
Expected: FAIL — `App` still renders the Task 1 placeholder, exercise names are not found.

- [ ] **Step 3: Create `frontend/src/components/ExercisePlayer.tsx`**

```tsx
// frontend/src/components/ExercisePlayer.tsx
import { useEffect, useRef, useState } from 'react';
import type { Exercise } from '../lib/exercises';
import { noteAtTime } from '../lib/exerciseTiming';
import { playExerciseTone } from '../audio/referenceTone';
import { usePitchTracker } from '../hooks/usePitchTracker';
import { PitchMeter } from './PitchMeter';

export interface ExercisePlayerProps {
  exercise: Exercise;
  onExit: () => void;
}

export function ExercisePlayer({ exercise, onExit }: ExercisePlayerProps) {
  const [elapsed, setElapsed] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const pitchTracker = usePitchTracker();

  useEffect(() => {
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const oscillator = playExerciseTone(audioContext, exercise);

    const startedAt = performance.now();
    const elapsedTimer = setInterval(() => {
      setElapsed((performance.now() - startedAt) / 1000);
    }, 100);

    return () => {
      clearInterval(elapsedTimer);
      oscillator.stop();
      audioContext.close();
    };
  }, [exercise]);

  const targetNote = noteAtTime(exercise, elapsed);

  return (
    <section>
      <h2>{exercise.name}</h2>
      <p>{exercise.description}</p>

      {pitchTracker.status === 'requesting' && <p>Pedindo acesso ao microfone…</p>}
      {pitchTracker.status === 'error' && (
        <p role="alert">Erro ao acessar o microfone: {pitchTracker.errorMessage}</p>
      )}
      {pitchTracker.status === 'listening' && (
        <PitchMeter
          detectedNote={pitchTracker.currentNote}
          targetMidiNumber={targetNote?.midiNumber ?? null}
        />
      )}

      <button onClick={onExit}>Voltar</button>
    </section>
  );
}
```

- [ ] **Step 4: Replace `frontend/src/App.tsx`**

```tsx
// frontend/src/App.tsx
import { useState } from 'react';
import { BUILTIN_EXERCISES, type Exercise } from './lib/exercises';
import { ExercisePlayer } from './components/ExercisePlayer';

export default function App() {
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);

  if (activeExercise) {
    return <ExercisePlayer exercise={activeExercise} onExit={() => setActiveExercise(null)} />;
  }

  return (
    <main>
      <h1>Singer Trainer</h1>
      <p>Escolha um exercício para começar, com feedback de afinação em tempo real.</p>
      <ul>
        {BUILTIN_EXERCISES.map((exercise) => (
          <li key={exercise.id}>
            <button onClick={() => setActiveExercise(exercise)}>{exercise.name}</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS — all tests across all files pass (App, PitchMeter, pitchDetection, noteUtils, tuningGauge, exercises, exerciseTiming).

- [ ] **Step 6: Manual end-to-end verification with the real microphone**

Run: `cd frontend && npm run dev` and open the printed local URL in a browser (Chrome/Firefox).

1. Confirm the browser's microphone picker defaults to (or lets you pick) the plugged-in USB mic
   (`USB Composite Device`, Jieli chipset — already the OS default input).
2. Click "Escala Maior (Dó central)". Grant the microphone permission prompt.
3. Confirm you hear the ascending/descending reference scale tone.
4. Sing along and confirm the note label and tuning needle update live and roughly track your
   pitch (green needle when you match the reference note, red when clearly off).
5. Click "Voltar" and confirm the mic stream stops (browser's mic-in-use indicator turns off).
6. Deny the microphone permission once (reload, click an exercise, click "Block") and confirm
   the app shows the error message instead of crashing.

Expected: all of the above hold true. If pitch detection feels laggy or jumpy, note it — that's
a tuning knob (`DETECTION_INTERVAL_MS`/YIN `threshold`) for a follow-up task, not a blocker for
this plan.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/components/ExercisePlayer.tsx
git commit -m "feat: wire exercise picker and live practice screen"
```

---

## Out of scope for this plan (tracked in the approved architecture plan)

- Backend API, Postgres, recording upload/storage, and the Python analysis microservice.
- Repertoire management and cross-session progress history screens.
- Docker Compose stack and Traefik exposure.

These follow in later plans once this live-feedback core is implemented and manually verified,
per the broader architecture roadmap agreed on before this slice was built.
