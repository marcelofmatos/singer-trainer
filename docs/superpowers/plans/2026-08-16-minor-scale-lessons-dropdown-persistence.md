# Minor Scale Lessons, Dropdown, and Last-Exercise Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two C-minor-scale exercises (sourced from a vocal-training video), replace the exercise tab list with a native dropdown, and persist the last-selected exercise in `localStorage`.

**Architecture:** A new pure helper `buildDescendingRepeatedScale` in `exercises.ts` (alongside the existing `buildScale`) generates the two new exercises' note sequences. A new small persistence module `lastExercise.ts` mirrors the existing `playbackPreferences.ts` pattern exactly. `App.tsx` swaps its `role="tablist"` button list for a single `<select>`, wired to that new persistence module the same way `ExercisePlayer.tsx` already wires `playbackPreferences`.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react, `localStorage`.

Full design rationale: [`docs/superpowers/specs/2026-08-16-minor-scale-lessons-dropdown-persistence.md`](../specs/2026-08-16-minor-scale-lessons-dropdown-persistence.md).

---

### Task 1: `buildDescendingRepeatedScale` + two new minor-scale exercises

**Files:**
- Modify: `frontend/src/lib/exercises.ts`
- Test: `frontend/src/lib/exercises.test.ts`

- [ ] **Step 1: Write the failing tests**

Overwrite `frontend/src/lib/exercises.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES, buildDescendingRepeatedScale, buildScale } from './exercises';

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

describe('buildDescendingRepeatedScale', () => {
  it('repeats each interval, descending, before stepping to the next', () => {
    const notes = buildDescendingRepeatedScale(60, [0, 2, 4], 2, 1);
    // descending: 4, 4, 2, 2, 0, 0 (each interval repeated twice)
    expect(notes.map((n) => n.midiNumber)).toEqual([64, 64, 62, 62, 60, 60]);
  });

  it('assigns sequential, non-overlapping start times', () => {
    const notes = buildDescendingRepeatedScale(60, [0, 2, 4], 2, 0.5);
    expect(notes.map((n) => n.startTime)).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
    notes.forEach((note) => expect(note.duration).toBe(0.5));
  });

  it('produces intervals.length * repeats notes', () => {
    const notes = buildDescendingRepeatedScale(60, [0, 2, 3, 5, 7, 8, 10, 12], 3, 0.4);
    expect(notes.length).toBe(24);
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

  it('includes the arpeggio, 5-tone scale, and octave-jump warmup exercises', () => {
    const ids = BUILTIN_EXERCISES.map((e) => e.id);
    expect(ids).toContain('arpejo-maior-c4');
    expect(ids).toContain('escala-cinco-notas');
    expect(ids).toContain('saltos-oitava');
  });

  it('includes the minor scale and stepped-descent minor scale exercises', () => {
    const ids = BUILTIN_EXERCISES.map((e) => e.id);
    expect(ids).toContain('escala-menor-c4');
    expect(ids).toContain('escala-menor-degraus');
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd frontend && npm test`
Expected: FAIL — `buildDescendingRepeatedScale` tests fail with something like `buildDescendingRepeatedScale is not a function` (not exported yet), and the new `BUILTIN_EXERCISES` id test fails because `escala-menor-c4`/`escala-menor-degraus` don't exist yet. All other pre-existing tests (in this file and the rest of the suite) still PASS.

- [ ] **Step 3: Implement the minimal change**

Overwrite `frontend/src/lib/exercises.ts` with:

```ts
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

/**
 * Builds a descending note sequence where each scale degree is repeated `repeats` times
 * before stepping down to the next one — e.g. Dó5-Dó5-Dó5, Si4-Si4-Si4, Lá4-Lá4-Lá4, ...
 */
export function buildDescendingRepeatedScale(
  rootMidi: number,
  intervals: number[],
  repeats: number,
  noteDuration = 0.4
): ExerciseNote[] {
  const descending = [...intervals].reverse();
  const notes: ExerciseNote[] = [];
  descending.forEach((interval) => {
    for (let i = 0; i < repeats; i++) {
      notes.push({
        midiNumber: rootMidi + interval,
        startTime: notes.length * noteDuration,
        duration: noteDuration,
      });
    }
  });
  return notes;
}

const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11, 12];
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10, 12]; // Dó-Ré-Mib-Fá-Sol-Láb-Sib-Dó
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
  {
    id: 'escala-menor-c4',
    name: 'Escala Menor (Dó central)',
    category: 'escala',
    description: 'Escala menor natural de Dó4 a Dó5 e volta, mesmo formato da escala maior.',
    notes: buildScale(MIDDLE_C, MINOR_SCALE_INTERVALS, 0.6),
  },
  {
    id: 'escala-menor-degraus',
    name: 'Escala Menor em Degraus',
    category: 'escala',
    description:
      'Dó5 até Dó4, cada nota repetida 3 vezes antes de descer um degrau — treina a ' +
      'precisão de afinação nota a nota, descendo pela escala menor.',
    notes: buildDescendingRepeatedScale(MIDDLE_C, MINOR_SCALE_INTERVALS, 3, 0.4),
  },
];
```

- [ ] **Step 4: Run tests to verify they all pass**

Run: `cd frontend && npm test`
Expected: PASS — all tests in `exercises.test.ts`, and the full suite (nothing else references the exercises list in a way that would break).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/exercises.ts frontend/src/lib/exercises.test.ts
git commit -m "feat: add minor scale and stepped-descent minor scale exercises"
```

---

### Task 2: `lastExercise.ts` persistence module

**Files:**
- Create: `frontend/src/lib/lastExercise.ts`
- Test: Create `frontend/src/lib/lastExercise.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/lastExercise.test.ts` with:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { loadLastExerciseId, saveLastExerciseId } from './lastExercise';

const STORAGE_KEY = 'singer-trainer:last-exercise-id';

describe('lastExercise', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored yet', () => {
    expect(loadLastExerciseId()).toBeNull();
  });

  it('round-trips a saved id through load', () => {
    saveLastExerciseId('escala-menor-c4');
    expect(loadLastExerciseId()).toBe('escala-menor-c4');
  });

  it('returns null when the stored value is an empty string', () => {
    localStorage.setItem(STORAGE_KEY, '');
    expect(loadLastExerciseId()).toBeNull();
  });

  it('does not throw when localStorage.getItem throws', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('unavailable');
    };
    expect(() => loadLastExerciseId()).not.toThrow();
    expect(loadLastExerciseId()).toBeNull();
    Storage.prototype.getItem = original;
  });

  it('does not throw when localStorage.setItem throws', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota exceeded');
    };
    expect(() => saveLastExerciseId('escala-menor-c4')).not.toThrow();
    Storage.prototype.setItem = original;
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — every test in `lastExercise.test.ts` fails because `frontend/src/lib/lastExercise.ts` doesn't exist yet (module not found). All other test files still PASS.

- [ ] **Step 3: Implement the minimal module**

Create `frontend/src/lib/lastExercise.ts` with:

```ts
const STORAGE_KEY = 'singer-trainer:last-exercise-id';

/** Reads the last selected exercise id from localStorage, or null if unset/invalid. */
export function loadLastExerciseId(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/** Writes the last selected exercise id to localStorage; silently no-ops if unavailable. */
export function saveLastExerciseId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private browsing / quota exceeded — this is a nice-to-have, not critical.
  }
}
```

- [ ] **Step 4: Run tests to verify they all pass**

Run: `cd frontend && npm test`
Expected: PASS — all tests in `lastExercise.test.ts`, and the full suite.

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/lastExercise.ts frontend/src/lib/lastExercise.test.ts
git commit -m "feat: persist the last selected exercise id to localStorage"
```

---

### Task 3: Dropdown UI in `App.tsx`, wired to persistence

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write the failing tests**

Overwrite `frontend/src/App.test.tsx` with:

```tsx
// frontend/src/App.test.tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { BUILTIN_EXERCISES } from './lib/exercises';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists every built-in exercise as an option in the dropdown', () => {
    render(<App />);
    const select = screen.getByLabelText('Exercício');
    expect(select.tagName).toBe('SELECT');
    BUILTIN_EXERCISES.forEach((exercise) => {
      expect(screen.getByRole('option', { name: exercise.name })).toBeDefined();
    });
  });

  it('shows the first exercise selected and displayed by default', () => {
    render(<App />);
    const select = screen.getByLabelText('Exercício') as HTMLSelectElement;
    expect(select.value).toBe(BUILTIN_EXERCISES[0].id);
    expect(screen.getByRole('heading', { name: BUILTIN_EXERCISES[0].name })).toBeDefined();
  });

  it('switches the displayed exercise when a different option is selected', () => {
    render(<App />);
    const secondExercise = BUILTIN_EXERCISES[1];
    fireEvent.change(screen.getByLabelText('Exercício'), { target: { value: secondExercise.id } });
    expect(screen.getByRole('heading', { name: secondExercise.name })).toBeDefined();
  });

  it('renders the chromatic wheel with all 12 note bubbles for the active exercise', () => {
    render(<App />);
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((name) => {
      expect(screen.getByTestId(`note-bubble-${name}`)).toBeDefined();
    });
  });

  it('persists the selected exercise to localStorage and restores it on remount', () => {
    const first = render(<App />);
    const thirdExercise = BUILTIN_EXERCISES[2];
    fireEvent.change(screen.getByLabelText('Exercício'), { target: { value: thirdExercise.id } });
    expect(localStorage.getItem('singer-trainer:last-exercise-id')).toBe(thirdExercise.id);

    first.unmount();
    render(<App />);
    const restoredSelect = screen.getByLabelText('Exercício') as HTMLSelectElement;
    expect(restoredSelect.value).toBe(thirdExercise.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — every test in `App.test.tsx` fails, since `App.tsx` still renders `role="tab"` buttons, not a labeled `<select>` (`screen.getByLabelText('Exercício')` finds nothing). All other test files still PASS.

- [ ] **Step 3: Implement the minimal change — `App.tsx`**

Overwrite `frontend/src/App.tsx` with:

```tsx
// frontend/src/App.tsx
import { useEffect, useState } from 'react';
import { BUILTIN_EXERCISES } from './lib/exercises';
import { loadLastExerciseId, saveLastExerciseId } from './lib/lastExercise';
import { ExercisePlayer } from './components/ExercisePlayer';

export default function App() {
  const [activeExerciseId, setActiveExerciseId] = useState(
    () => loadLastExerciseId() ?? BUILTIN_EXERCISES[0].id
  );
  const activeExercise =
    BUILTIN_EXERCISES.find((exercise) => exercise.id === activeExerciseId) ?? BUILTIN_EXERCISES[0];

  useEffect(() => {
    saveLastExerciseId(activeExerciseId);
  }, [activeExerciseId]);

  return (
    <main className="app">
      <header className="app-header">
        <h1 className="app-title">Singer Trainer</h1>
        <p className="app-subtitle">Feedback de afinação em tempo real, ao vivo.</p>
      </header>

      <select
        className="exercise-select"
        aria-label="Exercício"
        value={activeExerciseId}
        onChange={(event) => setActiveExerciseId(event.target.value)}
      >
        {BUILTIN_EXERCISES.map((exercise) => (
          <option key={exercise.id} value={exercise.id}>
            {exercise.name}
          </option>
        ))}
      </select>

      <ExercisePlayer exercise={activeExercise} />
    </main>
  );
}
```

- [ ] **Step 4: Update the CSS — `index.css`**

In `frontend/src/index.css`, find this block:

```css
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
```

Replace it with:

```css
.exercise-select {
  display: block;
  margin: 0 auto 2.5rem;
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.6rem 1.25rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-text);
  cursor: pointer;
}

.exercise-select:hover {
  border-color: var(--color-accent);
}

.exercise-select:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Run tests to verify they all pass**

Run: `cd frontend && npm test`
Expected: PASS — all tests in `App.test.tsx`, and the full suite (this is the last task, so this run covers everything from Tasks 1-3 together).

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx frontend/src/index.css frontend/src/App.test.tsx
git commit -m "feat: replace exercise tabs with a dropdown, restore last selection"
```

---

### Task 4: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `cd frontend && npm run dev` (background/long-running — leave it running, note the printed local URL, typically `http://localhost:5173`).

- [ ] **Step 2: Load the app and check the golden path**

Open the printed URL in a browser. Confirm:
- The dropdown lists all 9 exercises (7 pre-existing + "Escala Menor (Dó central)" + "Escala Menor em Degraus"), styled as a dark pill matching the rest of the app (not the browser's unstyled default look).
- Selecting "Escala Menor (Dó central)" loads that exercise (title/description update, reference tone plays the minor scale up then down).
- Selecting "Escala Menor em Degraus" loads that exercise and plays a descending pattern where each note repeats a few times before stepping down.

- [ ] **Step 3: Check persistence**

Select a non-default exercise (e.g. "Escala Menor em Degraus"), then reload the page. Confirm the dropdown still shows that same exercise selected (not reset to the first one).

- [ ] **Step 4: Report results honestly**

If browser automation isn't available in the environment used for this check, say so explicitly rather than claiming the golden path was verified — confirm what *was* checked (e.g., dev server builds and serves without errors) and flag what still needs a manual check by the user in a real browser.

- [ ] **Step 5: Stop the dev server**

Stop the `npm run dev` process started in Step 1.
