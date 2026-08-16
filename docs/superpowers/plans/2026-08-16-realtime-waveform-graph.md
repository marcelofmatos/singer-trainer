# Real-Time Waveform Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scrolling, oscilloscope-style waveform graph below the chromatic wheel, showing the raw shape of the sung voice, colored by the same tuning-status logic the wheel already uses.

**Architecture:** `usePitchTracker` (which already owns the microphone's `AnalyserNode`, reading it 20×/sec for pitch detection) is extended to also emit a rolling, downsampled amplitude buffer from that same read — no second microphone stream. A new pure module (`waveformSampling.ts`) does the downsampling. The tuning-status color logic currently private to `PitchMeter` is extracted into a shared pure helper in `tuningGauge.ts` (without changing `PitchMeter`'s existing props/behavior), so a new `Waveform` component can reuse the identical coloring without duplicating the formula. `ExercisePlayer` renders the new component below the wheel.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react, Web Audio API (`AnalyserNode`), plain SVG (no canvas, no animation library).

Full design rationale: [`docs/superpowers/specs/2026-08-16-realtime-waveform-graph.md`](../specs/2026-08-16-realtime-waveform-graph.md).

---

### Task 1: `waveformSampling.ts` — pure downsampling helper

**Files:**
- Create: `frontend/src/lib/waveformSampling.ts`
- Test: Create `frontend/src/lib/waveformSampling.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/waveformSampling.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { downsampleWaveform } from './waveformSampling';

describe('downsampleWaveform', () => {
  it('returns the requested number of points', () => {
    const buffer = new Float32Array(16);
    const result = downsampleWaveform(buffer, 4);
    expect(result.length).toBe(4);
  });

  it('picks values at fixed stride positions, preserving sign', () => {
    // buffer index:  0    1    2    3    4    5    6    7
    const buffer = Float32Array.from([0, 0.1, -0.2, 0.3, -0.4, 0.5, -0.6, 0.7]);
    // 8 samples, 4 points -> stride 2 -> indices 0, 2, 4, 6
    const result = downsampleWaveform(buffer, 4);
    expect(result).toEqual([0, -0.2, -0.4, -0.6]);
  });

  it('returns the buffer as-is when points equals buffer length', () => {
    const buffer = Float32Array.from([1, 2, 3, 4]);
    const result = downsampleWaveform(buffer, 4);
    expect(result).toEqual([1, 2, 3, 4]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — every test in `waveformSampling.test.ts` fails because `frontend/src/lib/waveformSampling.ts` doesn't exist yet (module not found). All other test files still PASS (86 tests across 10 files at baseline).

- [ ] **Step 3: Implement the minimal module**

Create `frontend/src/lib/waveformSampling.ts` with:

```ts
/**
 * Downsamples a raw audio buffer into `points` evenly-spaced signed sample values —
 * enough to draw a recognizable "wiggle" for this tick's ~50ms slice of audio without
 * pushing all 4096 raw samples into the scrolling waveform buffer every tick.
 */
export function downsampleWaveform(buffer: Float32Array, points: number): number[] {
  const stride = buffer.length / points;
  const samples: number[] = [];
  for (let i = 0; i < points; i++) {
    samples.push(buffer[Math.floor(i * stride)]);
  }
  return samples;
}
```

- [ ] **Step 4: Run tests to verify they all pass**

Run: `cd frontend && npm test`
Expected: PASS — all 3 tests in `waveformSampling.test.ts`, and the full suite (89 tests across 11 files: 86 baseline + 3 new).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/waveformSampling.ts frontend/src/lib/waveformSampling.test.ts
git commit -m "feat: add pure downsampling helper for the waveform graph"
```

---

### Task 2: `tuningGauge.ts` shared status/color helpers, `PitchMeter.tsx` refactor

**Files:**
- Modify: `frontend/src/lib/tuningGauge.ts`
- Modify: `frontend/src/lib/tuningGauge.test.ts`
- Modify: `frontend/src/components/PitchMeter.tsx`

- [ ] **Step 1: Write the failing tests for the new `tuningGauge.ts` exports**

Overwrite `frontend/src/lib/tuningGauge.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { centsToGaugePercent, STATUS_COLORS, statusForNote, tuningStatus } from './tuningGauge';

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

  it('is "close" between 10 and 25 cents, inclusive of the 25 boundary', () => {
    expect(tuningStatus(15)).toBe('close');
    expect(tuningStatus(-20)).toBe('close');
    expect(tuningStatus(25)).toBe('close');
    expect(tuningStatus(-25)).toBe('close');
  });

  it('is "off" beyond 25 cents', () => {
    expect(tuningStatus(30)).toBe('off');
    expect(tuningStatus(-40)).toBe('off');
  });
});

describe('STATUS_COLORS', () => {
  it('has a color for every tuning status', () => {
    expect(Object.keys(STATUS_COLORS).sort()).toEqual(['close', 'in-tune', 'off']);
  });
});

describe('statusForNote', () => {
  it('returns null when no note is detected', () => {
    expect(statusForNote(null, 69)).toBeNull();
    expect(statusForNote(null, null)).toBeNull();
  });

  it('is "in-tune" when within 10 cents of the target', () => {
    const note = { noteName: 'A', octave: 4, midiNumber: 69, cents: 3 };
    expect(statusForNote(note, 69)).toBe('in-tune');
  });

  it('is "off" when far from the target', () => {
    const note = { noteName: 'A', octave: 4, midiNumber: 69, cents: 40 };
    expect(statusForNote(note, 69)).toBe('off');
  });

  it('accounts for whole-semitone offsets from the target, not just cents', () => {
    const note = { noteName: 'G', octave: 4, midiNumber: 67, cents: 0 };
    expect(statusForNote(note, 69)).toBe('off');
  });

  it('falls back to nearest-chromatic-note tuning when there is no target', () => {
    const note = { noteName: 'A', octave: 4, midiNumber: 69, cents: -15 };
    expect(statusForNote(note, null)).toBe('close');
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd frontend && npm test`
Expected: FAIL — the `STATUS_COLORS` and `statusForNote` tests fail (not exported yet — a TypeScript/import error surfaces as a test failure). The pre-existing `centsToGaugePercent`/`tuningStatus` tests still PASS.

- [ ] **Step 3: Implement the new `tuningGauge.ts` exports**

Overwrite `frontend/src/lib/tuningGauge.ts` with:

```ts
import type { NoteInfo } from './noteUtils';

export type TuningStatus = 'in-tune' | 'close' | 'off';

export const STATUS_COLORS: Record<TuningStatus, string> = {
  'in-tune': '#2ecc71',
  close: '#f1c40f',
  off: '#e74c3c',
};

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

/**
 * Derives the tuning status for a detected note, relative to an exercise's target note
 * (if any) or the nearest chromatic note otherwise — same cents math both PitchMeter's
 * ring indicator and the Waveform trace color themselves by.
 */
export function statusForNote(
  detectedNote: NoteInfo | null,
  targetMidiNumber: number | null
): TuningStatus | null {
  if (!detectedNote) return null;
  const cents =
    targetMidiNumber !== null
      ? (detectedNote.midiNumber - targetMidiNumber) * 100 + detectedNote.cents
      : detectedNote.cents;
  return tuningStatus(cents);
}
```

- [ ] **Step 4: Run tests to verify `tuningGauge.test.ts` passes**

Run: `cd frontend && npm test`
Expected: PASS — all 13 tests in `tuningGauge.test.ts` (7 pre-existing + 6 new). `PitchMeter.tsx` hasn't been touched yet in this task, so it's unaffected either way.

- [ ] **Step 5: Refactor `PitchMeter.tsx` to use the shared helpers (no behavior change)**

This is a refactor under existing test coverage, not new functionality — `PitchMeter.test.tsx` (14 tests, untouched by this task) is the regression safety net proving nothing observable changed.

Overwrite `frontend/src/components/PitchMeter.tsx` with:

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
import { STATUS_COLORS, statusForNote } from '../lib/tuningGauge';
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

const VIEWBOX_SIZE = 240;
const CENTER = { x: VIEWBOX_SIZE / 2, y: VIEWBOX_SIZE / 2 };
const WHEEL_RADIUS = 90;
const BUBBLE_RADIUS = 22;
const INDICATOR_RADIUS = 10;

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
```

- [ ] **Step 6: Run the full test suite to confirm no regression**

Run: `cd frontend && npm test`
Expected: PASS — all 95 tests across 11 files (89 from after Task 1 + 6 new in `tuningGauge.test.ts`). **`PitchMeter.test.tsx`'s 14 tests must pass completely unchanged** — that's the proof this refactor didn't alter any observable behavior.

- [ ] **Step 7: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/tuningGauge.ts frontend/src/lib/tuningGauge.test.ts frontend/src/components/PitchMeter.tsx
git commit -m "refactor: extract shared tuning-status color logic for reuse by the waveform graph"
```

---

### Task 3: `usePitchTracker` — expose a rolling waveform buffer

**Files:**
- Modify: `frontend/src/hooks/usePitchTracker.ts`

No test file: this hook has no dedicated unit test today (it depends on real `getUserMedia`/`AudioContext`, which is why the downsampling math was pulled into the pure, independently-tested `waveformSampling.ts` in Task 1). This task is verified by running the full suite (regression check) plus manual verification in Task 6.

- [ ] **Step 1: Implement the change**

Overwrite `frontend/src/hooks/usePitchTracker.ts` with:

```ts
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_THRESHOLD, detectPitchYIN } from '../lib/pitchDetection';
import { frequencyToNote, type NoteInfo } from '../lib/noteUtils';
import { downsampleWaveform } from '../lib/waveformSampling';

export type PitchTrackerStatus = 'requesting' | 'listening' | 'error';

export interface PitchTrackerState {
  status: PitchTrackerStatus;
  errorMessage: string | null;
  currentNote: NoteInfo | null;
  /** Rolling window of downsampled signed amplitude values, oldest first, range [-1, 1]. */
  waveform: number[];
}

const BUFFER_SIZE = 4096;
const DETECTION_INTERVAL_MS = 50; // naive YIN is O(n^2); 20Hz updates keep CPU sane and still look real-time
const POINTS_PER_TICK = 8;
const WINDOW_SECONDS = 4;
const WINDOW_POINTS = (WINDOW_SECONDS * 1000 / DETECTION_INTERVAL_MS) * POINTS_PER_TICK; // 640

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
    waveform: [],
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
            waveform: [...prev.waveform, ...downsampleWaveform(buffer, POINTS_PER_TICK)].slice(-WINDOW_POINTS),
          }));
        }, DETECTION_INTERVAL_MS);
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            errorMessage:
              err instanceof Error ? err.message : 'Não foi possível acessar o microfone.',
            currentNote: null,
            waveform: [],
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

- [ ] **Step 2: Run the full test suite to confirm no regression**

Run: `cd frontend && npm test`
Expected: PASS — all 95 tests across 11 files (unchanged from after Task 2 — this hook has no dedicated tests, and no other test imports it in a way that inspects `PitchTrackerState`'s exact shape).

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/usePitchTracker.ts
git commit -m "feat: expose a rolling waveform buffer from the pitch tracker hook"
```

---

### Task 4: `Waveform` component

**Files:**
- Create: `frontend/src/components/Waveform.tsx`
- Test: Create `frontend/src/components/Waveform.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/Waveform.test.tsx` with:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Waveform } from './Waveform';

describe('Waveform', () => {
  it('renders a polyline point for every sample', () => {
    render(
      <Waveform
        samples={[0, 0.5, -0.5, 1, -1]}
        detectedNote={null}
        targetMidiNumber={null}
        micDisconnected={false}
      />
    );
    const trace = screen.getByTestId('waveform-trace');
    const points = trace.getAttribute('points')!.trim().split(' ');
    expect(points.length).toBe(5);
  });

  it('renders no trace when there are no samples yet', () => {
    render(
      <Waveform samples={[]} detectedNote={null} targetMidiNumber={null} micDisconnected={false} />
    );
    expect(screen.getByTestId('waveform-trace').getAttribute('points')).toBe('');
  });

  it('renders no trace when the mic is disconnected, even with samples buffered', () => {
    render(
      <Waveform
        samples={[0, 0.5, -0.5]}
        detectedNote={null}
        targetMidiNumber={null}
        micDisconnected={true}
      />
    );
    expect(screen.getByTestId('waveform-trace').getAttribute('points')).toBe('');
  });

  it('colors the trace in-tune green when the detected note is close to the target', () => {
    render(
      <Waveform
        samples={[0, 0.1]}
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    expect(screen.getByTestId('waveform-trace').getAttribute('stroke')).toBe('#2ecc71');
  });

  it('colors the trace off-tune red when the detected note is far from the target', () => {
    render(
      <Waveform
        samples={[0, 0.1]}
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 40 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    expect(screen.getByTestId('waveform-trace').getAttribute('stroke')).toBe('#e74c3c');
  });

  it('uses a neutral color when no note is detected', () => {
    render(
      <Waveform samples={[0, 0.1]} detectedNote={null} targetMidiNumber={null} micDisconnected={false} />
    );
    expect(screen.getByTestId('waveform-trace').getAttribute('stroke')).toBe('#a89e93');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — every test in `Waveform.test.tsx` fails because `frontend/src/components/Waveform.tsx` doesn't exist yet (module not found). All other test files still PASS.

- [ ] **Step 3: Implement the minimal component**

Create `frontend/src/components/Waveform.tsx` with:

```tsx
// frontend/src/components/Waveform.tsx
import { STATUS_COLORS, statusForNote } from '../lib/tuningGauge';
import type { NoteInfo } from '../lib/noteUtils';

export interface WaveformProps {
  /** Rolling window of downsampled signed amplitude values, oldest first, range [-1, 1]. */
  samples: number[];
  detectedNote: NoteInfo | null;
  targetMidiNumber: number | null;
  micDisconnected: boolean;
}

const HEIGHT = 80;
const NEUTRAL_COLOR = '#a89e93'; // --color-text-muted

export function Waveform({ samples, detectedNote, targetMidiNumber, micDisconnected }: WaveformProps) {
  const status = statusForNote(detectedNote, targetMidiNumber);
  const color = status ? STATUS_COLORS[status] : NEUTRAL_COLOR;
  const width = Math.max(samples.length - 1, 1);

  const points =
    micDisconnected || samples.length === 0
      ? ''
      : samples.map((value, index) => `${index},${(HEIGHT / 2 - value * (HEIGHT / 2)).toFixed(2)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${HEIGHT}`} width="100%" role="img" aria-label="Forma de onda da voz">
      <polyline data-testid="waveform-trace" points={points} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}
```

- [ ] **Step 4: Run tests to verify they all pass**

Run: `cd frontend && npm test`
Expected: PASS — all 6 tests in `Waveform.test.tsx`, and the full suite (101 tests across 12 files: 95 from after Task 3 + 6 new).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Waveform.tsx frontend/src/components/Waveform.test.tsx
git commit -m "feat: add the Waveform component"
```

---

### Task 5: Wire `Waveform` into `ExercisePlayer`, add its CSS

**Files:**
- Modify: `frontend/src/components/ExercisePlayer.tsx`
- Modify: `frontend/src/index.css`

No new test file: this is prop-forwarding of state already covered by `Waveform.test.tsx` (Task 4) and `PitchMeter.test.tsx`'s existing wiring precedent in this same component — matches how the dropdown/persistence feature's `ExercisePlayer` wiring task was handled earlier in this project's history (see `docs/superpowers/plans/2026-08-16-minor-scale-lessons-dropdown-persistence.md`, Task 3 rationale).

- [ ] **Step 1: Import the new component**

In `frontend/src/components/ExercisePlayer.tsx`, find:

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
```

Replace with:

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
import { Waveform } from './Waveform';
```

- [ ] **Step 2: Render the waveform panel below the wheel**

In the same file, find:

```tsx
      <div className="wheel-stage">
        <PitchMeter
          detectedNote={pitchTracker.status === 'listening' ? pitchTracker.currentNote : null}
          targetMidiNumber={targetNote?.midiNumber ?? null}
          micDisconnected={pitchTracker.status === 'error'}
          onNoteClick={handleNoteClick}
        />
      </div>
```

Replace with:

```tsx
      <div className="wheel-stage">
        <PitchMeter
          detectedNote={pitchTracker.status === 'listening' ? pitchTracker.currentNote : null}
          targetMidiNumber={targetNote?.midiNumber ?? null}
          micDisconnected={pitchTracker.status === 'error'}
          onNoteClick={handleNoteClick}
        />
      </div>

      <div className="waveform-stage">
        <Waveform
          samples={pitchTracker.waveform}
          detectedNote={pitchTracker.status === 'listening' ? pitchTracker.currentNote : null}
          targetMidiNumber={targetNote?.midiNumber ?? null}
          micDisconnected={pitchTracker.status === 'error'}
        />
      </div>
```

- [ ] **Step 3: Add the CSS**

In `frontend/src/index.css`, find:

```css
.wheel-stage g[role='button']:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.exercise-controls {
```

Replace with:

```css
.wheel-stage g[role='button']:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.waveform-stage {
  width: min(100%, 360px);
  height: 90px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 2rem;
  overflow: hidden;
}

.waveform-stage > svg {
  display: block;
}

.exercise-controls {
```

(Only the opening `.wheel-stage g[role='button']:focus-visible { ... }` rule and the `.exercise-controls {` line that follows it are the anchors — everything else in the file stays exactly as it is today.)

- [ ] **Step 4: Run the full test suite to confirm no regression**

Run: `cd frontend && npm test`
Expected: PASS — all 101 tests across 12 files (unchanged from after Task 4 — `App.test.tsx` renders through `ExercisePlayer`, so it exercises this wiring without needing a dedicated new test).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ExercisePlayer.tsx frontend/src/index.css
git commit -m "feat: show the waveform graph below the chromatic wheel"
```

---

### Task 6: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `cd frontend && npm run dev` (background/long-running — leave it running, note the printed local URL, typically `http://localhost:5173`).

- [ ] **Step 2: Load the app and check the golden path**

Open the printed URL in a browser. Grant microphone permission when prompted. Sing or hum. Confirm:
- A new dark panel appears below the chromatic wheel, roughly 90px tall.
- It shows a scrolling waveform trace that reacts to your voice in real time (not a static/frozen line).
- The trace color changes between green/yellow/red/muted-gray as you sing closer to or further from the target note (or hum with no exercise target active) — matching the wheel's own indicator color at the same moment.
- The wheel itself still behaves exactly as before (nothing regressed visually).

- [ ] **Step 3: Check the disconnected-mic path**

Reload the page and deny the microphone permission prompt. Confirm:
- The waveform panel is still present (same fixed size, no layout jump) but shows an empty/flat trace, not stale or broken content.
- The wheel's existing `🎤🚫` center icon and the error text above it still appear as before.

- [ ] **Step 4: Report results honestly**

If browser automation isn't available in the environment used for this check (e.g., the Chrome extension isn't connected), say so explicitly rather than claiming the golden path was verified — confirm what *was* checked (e.g., the dev server builds and serves without errors) and flag what still needs a manual check by the user in a real browser with a real microphone.

- [ ] **Step 5: Stop the dev server**

Stop the `npm run dev` process started in Step 1.
