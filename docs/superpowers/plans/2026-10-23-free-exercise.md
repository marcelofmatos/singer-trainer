# Exercício livre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exercício "Exercício livre": cada faixa é medida contra a nota mais próxima, o tempo conta só com voz, a roda mostra a % de acerto por nota, e cada trecho é gravado (com o detalhe por nota) ao pausar, trocar de exercício ou ocultar a página.

**Architecture:** Regras puras em `scoring.ts`/`scoreHistory.ts`; `PitchMeter` desenha % por nota; `InputLane` amostra sem alvo quando pedido; o `ExercisePlayer` generaliza o modo "contínuo" já usado pela "Entrada de áudio" e acrescenta a contagem por nota.

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library (jsdom 25).

**Spec:** `docs/superpowers/specs/2026-10-22-free-exercise-design.md` (ver a seção "Revisão (2026-10-23)").

**Convenções:** comandos em `frontend/`; commits com a identidade configurada, **sem** `Co-Authored-By`; UI em português, código em inglês.

---

### Task 1: Exercício, regras de pontuação livre e histórico por nota

**Files:** `frontend/src/lib/exercises.ts` (+test), `frontend/src/lib/scoring.ts` (+test), `frontend/src/lib/scoreHistory.ts` (+test)

- [ ] **Step 1: Failing tests**
  - `exercises.test.ts`: `BUILTIN_EXERCISES` contains `{ id: 'livre', name: 'Exercício livre', mode: 'free', notes: [] }` with a description mentioning "outra aba" and "fone". The existing "every exercise has notes" test must skip both `reference` and `free` modes.
  - `scoring.test.ts`:
    - `isHitNearest(note)` → true for cents 0, ±10; false for ±11; false for null.
    - `addNoteSample(tallies, midi, seconds, hit)` returns a new 12-entry array where only the pitch class of `midi` changed (target +seconds; hit +seconds only on hit); `EMPTY_NOTE_TALLIES` has 12 empty tallies; `addNoteTallies(a, b)` sums per index.
  - `scoreHistory.test.ts`:
    - A record with `noteTallies` of 12 valid tallies loads; one with 11 entries or a non-number field is rejected.
    - `freeNotePercentsByInput(history)` → `[{ inputId, inputLabel, percents: (number|null)[12] }]` for records with `exerciseId === 'livre'` only, grouped by `inputId ?? 'primary'` (label: last record's `inputLabel ?? null`), each percent = rounded hit/target over that input's records, `null` when the note's target time is 0. Other exercises are ignored.

- [ ] **Step 2: Implement**

`exercises.ts`: `mode?: 'reference' | 'free';` and

```ts
export const FREE_EXERCISE: Exercise = {
  id: 'livre',
  name: 'Exercício livre',
  category: 'aquecimento',
  description:
    'Cante junto com uma música tocando em outra aba (use fone de ouvido): cada nota é medida contra a mais próxima, e a roda mostra a % de acerto de cada nota.',
  notes: [],
  mode: 'free',
};
```

appended to `BUILTIN_EXERCISES` before `AUDIO_INPUT_EXERCISE`.

`scoring.ts`:

```ts
/** Free singing: in tune when within the tolerance of the nearest note. */
export function isHitNearest(detected: NoteInfo | null): boolean {
  return detected !== null && Math.abs(detected.cents) <= HIT_TOLERANCE_CENTS;
}

/** One tally per pitch class (0 = C … 11 = B). */
export type NoteTallies = ScoreTally[];

export const EMPTY_NOTE_TALLIES: NoteTallies = Array.from({ length: 12 }, () => EMPTY_TALLY);

export function addNoteSample(tallies: NoteTallies, midiNumber: number, seconds: number, hit: boolean): NoteTallies {
  const pitchClass = ((midiNumber % 12) + 12) % 12;
  return tallies.map((tally, index) => (index === pitchClass ? addSample(tally, seconds, hit) : tally));
}

export function addNoteTallies(a: NoteTallies, b: NoteTallies): NoteTallies {
  return a.map((tally, index) => addTallies(tally, b[index]));
}
```

`scoreHistory.ts`: `noteTallies?: ScoreTally[]` on `ScoreRecord`; validation: absent, or an array of exactly 12 objects each with numeric `targetSeconds` and `hitSeconds`. Add:

```ts
const FREE_EXERCISE_ID = 'livre';

export interface FreeNotePercents {
  inputId: string;
  inputLabel: string | null;
  /** Per pitch class (C…B); null when that note was never sung. */
  percents: (number | null)[];
}

export function freeNotePercentsByInput(history: ScoreRecord[]): FreeNotePercents[] {
  const byInput = new Map<string, { inputLabel: string | null; tallies: NoteTallies }>();
  for (const entry of history) {
    if (entry.exerciseId !== FREE_EXERCISE_ID || !entry.noteTallies) continue;
    const inputId = entry.inputId ?? PRIMARY_INPUT_ID;
    const current = byInput.get(inputId);
    byInput.set(inputId, {
      inputLabel: entry.inputLabel ?? current?.inputLabel ?? null,
      tallies: addNoteTallies(current?.tallies ?? EMPTY_NOTE_TALLIES, entry.noteTallies),
    });
  }
  return [...byInput.entries()].map(([inputId, { inputLabel, tallies }]) => ({
    inputId,
    inputLabel,
    percents: tallies.map((tally) => (tally.targetSeconds > 0 ? hitPercent(tally) : null)),
  }));
}
```

- [ ] **Step 3: Run lib tests + full suite + tsc** (the new exercise must not break App/player tests; adjust only structural assumptions and explain).
- [ ] **Step 4: Commit** — `feat: add the free exercise and per-note scoring rules`

---

### Task 2: % por nota na roda e amostragem sem alvo

**Files:** `frontend/src/components/PitchMeter.tsx` (+test), `frontend/src/components/InputLane.tsx` (+test)

- [ ] **Step 1: Failing tests**
  - `PitchMeter`: with `notePercents` (12 entries, e.g. index 9 = 80, others null), bubble A contains the text "80%" (`data-testid="note-percent-A"`), bubble C has no percent element; without the prop, no `note-percent-*` elements.
  - `InputLane`: with `sampleWithoutTarget` and `targetMidiNumber={null}`, `onSample(laneId, note)` is called every 100 ms while active and listening; without it, no samples when there's no target (existing behaviour). `notePercents` is passed to the wheel (bubble shows "80%").
- [ ] **Step 2: Implement**
  - `PitchMeter`: optional `notePercents?: (number | null)[]`; when the entry is a number, render a small `<text data-testid={\`note-percent-${name}\`}>` under the note name inside the bubble (shift the name up a little when a percent is shown; font ~9, same readable text color as the name).
  - `InputLane`: props `sampleWithoutTarget?: boolean` (default false) and `notePercents?: (number | null)[]` (forwarded to `PitchMeter` only). Sampling condition: `if (!active || reference || (target === null && !sampleWithoutTarget)) return;` (read via the existing scoring ref).
- [ ] **Step 3: Run tests + tsc** — PASS (the player compiles since the new props are optional).
- [ ] **Step 4: Commit** — `feat: show per-note hit rates on the wheel and let lanes sample without a target`

---

### Task 3: Modo livre no `ExercisePlayer`, seção no histórico e README

**Files:** `frontend/src/components/ExercisePlayer.tsx`, new `frontend/src/components/ExercisePlayer.free.test.tsx`, `frontend/src/components/ScoreHistory.tsx` (+test), `index.css`, `README.md`

- [ ] **Step 1: Failing tests**
  - `ExercisePlayer.free.test.tsx` (pattern of `ExercisePlayer.reference.test.tsx`: trackers mocked per device, fake timers, `FREE_EXERCISE`; lanes primary→mic and lane-2→other):
    1. No AudioContext, no 🔊, no Repetir; speed slider present; no target on the wheels.
    2. In-tune voice (cents 3) for 1 s then pause (Space) → one record per singing lane with `exerciseId 'livre'`, `hitSeconds/targetSeconds ≈ 1`, and `noteTallies[pc]` holding the time; silence counts nothing (a silent lane records nothing).
    3. Out-of-tune voice (cents 30) counts target time but not hit.
    4. The wheel of the singing lane shows its note's % live (`note-percent-C` shows "100%" while singing C in tune).
    5. Switching exercise and hiding the page record the running stretch (reuse the reference-mode mechanics).
  - `ScoreHistory.test.tsx`: with free records for two inputs, a table named "Exercício livre — acerto por nota" has header C…B and a row per input (label "Microfone" for the primary), showing "80%" / "—".
- [ ] **Step 2: Implement** (read the current file first; keep exercise and reference modes unchanged):
  1. `const isFreeMode = exercise.mode === 'free'; const isContinuousMode = isReferenceMode || isFreeMode;` Use `isContinuousMode` wherever reference mode currently means "no tone/clock", "record on pause/leave/hide", "hide 🔊/Repetir", "fixed timing rate". Keep reference-only logic (reference lane, reference target, select) on `isReferenceMode`.
  2. Per-note tallies: `passNoteTalliesRef` + state `Record<laneId, NoteTallies>` mirroring the pass tallies pattern (reset where pass tallies reset, cleared on lane removal).
  3. `handleSample(laneId, detected)`: in free mode `if (!detected) return;` hit = `isHitNearest(detected)`; add to the pass tally and to the lane's note tallies (`addNoteSample`).
  4. `completePass`: include `noteTallies` in the record when in free mode.
  5. Lanes: `sampleWithoutTarget={isFreeMode}`, `notePercents={isFreeMode ? notePercentsFor(lane.id) : undefined}` where each entry is `hitPercent` of the lane's live note tally, or `null` when its target time is 0. Target for lanes in free mode: `null`.
  6. `ScoreHistory`: new table from `freeNotePercentsByInput(history)` (caption + `aria-label` "Exercício livre — acerto por nota"), header C…B (`CHROMATIC_NOTE_NAMES`), rows labelled `inputLabel ?? 'Microfone'`, cells `${p}%` or "—". Only rendered when there is at least one row. CSS: compact cells (`.score-history-notes td, th { padding: 0.2rem 0.3rem; text-align: center; font-variant-numeric: tabular-nums; }`), horizontally scrollable wrapper if needed.
- [ ] **Step 3: README** — under Funcionalidades:

```markdown
- **Exercício livre** — cante junto com uma música tocando em outra aba (de fone): cada
  entrada é medida contra a nota mais próxima, o tempo só conta enquanto há voz, e a roda
  mostra a % de acerto de cada nota; o histórico guarda o acerto por nota de cada entrada.
```

- [ ] **Step 4: Verify** — `cd frontend && npm test && npx tsc -b && npm run build`; Playwright screenshot of the free exercise (`.playwright-mcp/free-exercise.png`) and of the history dialog with the per-note grid if data exists; stop Vite by the PID on 5179.
- [ ] **Step 5: Commit** — `feat: add the free exercise with per-note hit rates`
