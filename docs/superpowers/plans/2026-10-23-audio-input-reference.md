# Exercício "Entrada de áudio" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Novo exercício "Entrada de áudio": uma faixa escolhida vira a referência (não pontuada) e as notas dela viram o alvo e a base de pontuação (tolerância de 500 ms, oitava livre, ±10 cents) das outras faixas.

**Architecture:** Lógica pura em `referenceMatch.ts`; `InputLane` passa a reportar a nota detectada (o player decide o acerto) e ganha o papel de referência; o `ExercisePlayer` ganha o modo `reference`, que pula o tom/relógio, alimenta o alvo das faixas a partir da referência e grava ao pausar, trocar de exercício e ocultar a página.

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library (jsdom 25).

**Spec:** `docs/superpowers/specs/2026-10-23-audio-input-reference-design.md`

**Convenções do repo:** comandos em `frontend/`; commits com a identidade configurada, **sem** `Co-Authored-By`; UI em português, código em inglês.

---

### Task 1: Exercício e lógica pura da referência

**Files:**
- Modify: `frontend/src/lib/exercises.ts` (+ its test)
- Create: `frontend/src/lib/referenceMatch.ts`, `frontend/src/lib/referenceMatch.test.ts`

- [ ] **Step 1: Failing tests**

`exercises.test.ts`: `BUILTIN_EXERCISES` includes `{ id: 'entrada-de-audio', name: 'Entrada de áudio', mode: 'reference', notes: [] }` (description non-empty, mentions "Monitor of").

```ts
// frontend/src/lib/referenceMatch.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultReferenceLaneId,
  loadReferenceLaneId,
  matchesReference,
  pushReferenceSample,
  REFERENCE_TOLERANCE_MS,
  saveReferenceLaneId,
} from './referenceMatch';

const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 0, midiNumber, cents });

describe('pushReferenceSample', () => {
  it('keeps only samples inside the window', () => {
    let history = pushReferenceSample([], { time: 0, midi: 60, cents: 0 }, 500);
    history = pushReferenceSample(history, { time: 400, midi: 62, cents: 0 }, 500);
    history = pushReferenceSample(history, { time: 900, midi: 64, cents: 0 }, 500);
    expect(history.map((sample) => sample.midi)).toEqual([62, 64]);
  });
});

describe('matchesReference', () => {
  const history = [
    { time: 1000, midi: 60, cents: 0 },
    { time: 1300, midi: 62, cents: 5 },
  ];

  it('accepts a note the reference sang within the tolerance, in any octave', () => {
    expect(REFERENCE_TOLERANCE_MS).toBe(500);
    expect(matchesReference(note(48, 4), history, 1400, 500)).toBe(true);
    expect(matchesReference(note(74, 0), history, 1400, 500)).toBe(true);
  });

  it('rejects notes beyond ±10 cents, other notes and samples older than the tolerance', () => {
    expect(matchesReference(note(62, 20), history, 1400, 500)).toBe(false);
    expect(matchesReference(note(65, 0), history, 1400, 500)).toBe(false);
    expect(matchesReference(note(60, 0), history, 1600, 500)).toBe(false);
  });

  it('never matches without a detected note or reference samples', () => {
    expect(matchesReference(null, history, 1400, 500)).toBe(false);
    expect(matchesReference(note(60, 0), [], 1400, 500)).toBe(false);
  });
});

describe('defaultReferenceLaneId', () => {
  const labelOf = (laneId: string) =>
    ({ primary: 'USB Mic', 'lane-2': 'JBL', 'lane-3': 'Monitor of JBL' })[laneId] ?? '';

  it('prefers a "Monitor of" lane, then the last extra lane, never the primary', () => {
    expect(defaultReferenceLaneId(['primary', 'lane-2', 'lane-3'], labelOf)).toBe('lane-3');
    expect(defaultReferenceLaneId(['primary', 'lane-2'], labelOf)).toBe('lane-2');
    expect(defaultReferenceLaneId(['primary'], labelOf)).toBeNull();
  });
});

describe('reference lane persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips the chosen lane', () => {
    expect(loadReferenceLaneId()).toBeNull();
    saveReferenceLaneId('lane-3');
    expect(loadReferenceLaneId()).toBe('lane-3');
  });
});
```

- [ ] **Step 2: Run — expect failures.**

- [ ] **Step 3: Implement**

`exercises.ts`: add `mode?: 'reference';` to `Exercise` (doc: "'reference': the target comes from a chosen audio input instead of notes") and append:

```ts
export const AUDIO_INPUT_EXERCISE: Exercise = {
  id: 'entrada-de-audio',
  name: 'Entrada de áudio',
  category: 'aquecimento',
  description:
    "Use uma das entradas (ex.: o 'Monitor of …' com um vídeo tocando) como referência das notas a cantar.",
  notes: [],
  mode: 'reference',
};
```

to `BUILTIN_EXERCISES` (last). Use an existing `ExerciseCategory` value; check the union.

```ts
// frontend/src/lib/referenceMatch.ts
import type { NoteInfo } from './noteUtils';
import { HIT_TOLERANCE_CENTS } from './scoring';

/** One pitch reading of the reference input. */
export interface ReferenceSample {
  /** Milliseconds (monotonic). */
  time: number;
  midi: number;
  cents: number;
}

/** How far back a reference note still counts, to absorb reaction time and audio latency. */
export const REFERENCE_TOLERANCE_MS = 500;

const STORAGE_KEY = 'singer-trainer:reference-lane';

export function pushReferenceSample(history: ReferenceSample[], sample: ReferenceSample, windowMs: number): ReferenceSample[] {
  return [...history, sample].filter((entry) => entry.time >= sample.time - windowMs);
}

/** True if the detected note matches, within ±10 cents in any octave, a reference sample from the last `toleranceMs`. */
export function matchesReference(
  detected: NoteInfo | null,
  history: ReferenceSample[],
  now: number,
  toleranceMs: number
): boolean {
  if (!detected) return false;
  return history.some((sample) => {
    if (sample.time < now - toleranceMs) return false;
    const semitones = detected.midiNumber - sample.midi;
    const wrapped = ((((semitones % 12) + 18) % 12) - 6);
    return Math.abs(wrapped * 100 + detected.cents - sample.cents) <= HIT_TOLERANCE_CENTS;
  });
}

/** First lane whose device looks like a system monitor, else the last extra lane; never the primary. */
export function defaultReferenceLaneId(laneIds: string[], labelOf: (laneId: string) => string): string | null {
  const extras = laneIds.slice(1);
  return extras.find((laneId) => labelOf(laneId).startsWith('Monitor of')) ?? extras[extras.length - 1] ?? null;
}

export function loadReferenceLaneId(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? stored : null;
  } catch {
    return null;
  }
}

export function saveReferenceLaneId(laneId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, laneId);
  } catch {
    // Private browsing / quota exceeded — the choice just won't be remembered.
  }
}
```

- [ ] **Step 4: Run tests + tsc** — PASS. Also run the full suite: App tests that count/iterate exercises must still pass (adjust only if they assumed every exercise has notes; explain).

- [ ] **Step 5: Commit** — `git commit -m "feat: add the audio-input exercise and reference matching rules"`

---

### Task 2: `InputLane` — nota reportada e papel de referência

**Files:** `frontend/src/components/InputLane.tsx`, `InputLane.test.tsx`

- [ ] **Step 1: Failing tests** (`renderLane` defaults: `onSample: vi.fn()`, `onNote: vi.fn()`, `isReference: false`):
  - `onSample` is called with `(laneId, detectedNote)` every 100 ms while scoring is active, listening and there is a target (replace the old `(laneId, true)` expectation with the note object).
  - With `isReference`, the header shows a "Referência" badge (`getByText('Referência')`), and `onSample` is never called even with `scoringActive` and a target.
  - `onNote(laneId, note)` is called when the tracker's `currentNote` changes, and with `null` when it goes silent (call through a ref; effect keyed on `midiNumber`/`cents`/null so it doesn't fire every render).

- [ ] **Step 2: Implement**
  - Props: `onSample: (laneId: string, detected: NoteInfo | null) => void`; `onNote: (laneId: string, note: NoteInfo | null) => void`; `isReference: boolean`.
  - Sampling tick: `if (!active || target === null || isReference) return; onSampleRef.current(lane.id, detectedNote)`.
  - Badge: `<span className="lane-badge">Referência</span>` in `.lane-header` when `isReference`.
  - `onNote` effect: `useEffect(() => onNoteRef.current(lane.id, tracker.status === 'listening' ? tracker.currentNote : null), [lane.id, tracker.status, tracker.currentNote?.midiNumber, tracker.currentNote?.cents])`.
  - CSS (`index.css`): `.lane-badge { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.15rem 0.5rem; border-radius: 999px; background: var(--color-accent-soft); color: var(--color-accent); }`.

- [ ] **Step 3: Run tests + tsc.** `ExercisePlayer` will fail to type-check until Task 3 (it passes the old `onSample`) — report it; do not touch ExercisePlayer.

- [ ] **Step 4: Commit** — `git commit -m "feat: report detected notes from lanes and support a reference lane"`

---

### Task 3: Modo referência no `ExercisePlayer` + README

**Files:** `frontend/src/components/ExercisePlayer.tsx`, new `frontend/src/components/ExercisePlayer.reference.test.tsx`, existing player tests (only for the `onSample` signature), `index.css`, `README.md`.

- [ ] **Step 1: Failing tests** — `ExercisePlayer.reference.test.tsx`, with `usePitchTracker` mocked per device (copy the pattern of `ExercisePlayer.lanes.test.tsx`: `trackers[deviceId]`), devices `mic` (primary, 'USB Mic') and `monitor` ('Monitor of JBL'), lanes `[primary→mic, lane-2→monitor]`, exercise = `AUDIO_INPUT_EXERCISE`, fake timers + mocked `Date.now()` advancing with the timers (`vi.setSystemTime`):
  1. The reference select (`combobox` "Referência") defaults to the monitor lane; that lane shows the "Referência" badge; the score board has only the primary row.
  2. The primary lane's wheel gets the reference note as target (`note-bubble-A` has `data-active="true"` when the monitor tracker reports A4).
  3. Singing the reference's note 300 ms late counts as hit: monitor reports C4 for 1 s, primary reports C3 starting 300 ms later; after pausing (Space), the recorded entry for `primary` has `hitSeconds / targetSeconds` ≥ 0.6 and exerciseId `entrada-de-audio`.
  4. Reference silence counts no time: monitor silent, primary singing → after pausing, nothing is recorded.
  5. Switching exercise (rerender with another exercise) records the running pass; `document.dispatchEvent(new Event('visibilitychange'))` with `document.visibilityState` = 'hidden' (define the property) records too.
  6. Only the primary lane: shows "Adicione uma entrada (ex.: Monitor of …) para usar como referência." and records nothing.
  7. The 🔊 (Silenciar) button and the "Repetir" checkbox are absent; the speed slider is still in the toolbar.

- [ ] **Step 2: Implement** (read the current `ExercisePlayer.tsx` first):
  1. `const isReferenceMode = exercise.mode === 'reference';`
  2. Playback effect: when `isReferenceMode`, skip creating the AudioContext/tone/poll (set elapsed 0, ended false, reset pass tallies, return a no-op cleanup). Keep the effect deps; add `isReferenceMode`.
  3. Reference lane: `const [referenceLaneId, setReferenceLaneId] = useState(() => loadReferenceLaneId());` resolved each render to a valid lane: `const effectiveReferenceId = lanes.some((lane) => lane.id === referenceLaneId && lane.id !== PRIMARY_LANE_ID) ? referenceLaneId : defaultReferenceLaneId(lanes.map((l) => l.id), (id) => laneLabel(...))`. Persist on user change.
  4. Reference input: `referenceHistoryRef` (array of `ReferenceSample`) and `const [referenceTarget, setReferenceTarget] = useState<number | null>(null)`; `handleNote(laneId, note)` (useCallback): if `laneId === effectiveReferenceIdRef.current` → push `{ time: Date.now(), midi: note.midiNumber, cents: note.cents }` into the history (window = tolerance) when non-null; `setReferenceTarget(note ? note.midiNumber : null)` (React bails out when equal).
  5. Target per lane: `const laneTarget = isReferenceMode ? referenceTarget : targetNote?.midiNumber ?? null;` passed to non-reference lanes; the reference lane gets `null`.
  6. `handleSample(laneId, detected)`: hit = `isReferenceMode ? matchesReference(detected, referenceHistoryRef.current, Date.now(), REFERENCE_TOLERANCE_MS) : isHit(detected, exerciseTargetRef.current)` (keep the exercise target in a ref updated each render). Add the sample as before.
  7. Lanes: pass `isReference={isReferenceMode && lane.id === effectiveReferenceId}`, `onNote={handleNote}`; `scoringActive={playing && !ended}`.
  8. Recording in reference mode: extract the existing completePass body into `recordPass()`; call it (a) in `togglePlaying` when pausing in reference mode, (b) in an effect cleanup keyed on `exercise.id` when leaving a reference exercise (use refs so the cleanup sees current tallies), (c) on `visibilitychange` (hidden) and `pagehide` listeners while in reference mode. The reference lane is never recorded (skip its id).
  9. Score board rows: exclude the reference lane in reference mode.
  10. Info column in reference mode: the "Referência" `<select>` (options = non-primary lanes, label = `laneLabel`) or the "Adicione uma entrada…" message when there are no extra lanes. Hide the 🔊 button and the "Repetir" label in reference mode.
  11. Existing tests: update only for the `onSample(laneId, note)` signature/mocks; list changes.

- [ ] **Step 3: README** — after "Visualizações":

```markdown
- **Entrada de áudio como referência** — no exercício "Entrada de áudio", escolha uma
  entrada (ex.: o "Monitor of …" com um vídeo do YouTube tocando) como referência: as notas
  dela viram o alvo das outras faixas, e a pontuação vale enquanto a referência canta
  (acerto se você cantar a mesma nota, em qualquer oitava, até 0,5 s depois).
```

- [ ] **Step 4: Verify** — `cd frontend && npm test && npx tsc -b && npm run build`; Playwright visual check: Vite on 5179, two lanes (primary + another device), choose "Entrada de áudio", screenshot `.playwright-mcp/reference-mode.png`; stop Vite by the PID on 5179.

- [ ] **Step 5: Commit** — `git add frontend/src README.md && git commit -m "feat: practice against a live audio input used as the reference"`
