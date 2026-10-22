# Pontuação e histórico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Placar no canto superior direito com tempo afinado e % de acerto da sessão e geral (todos os exercícios), um registro por passada completa gravado no navegador, e um painel de histórico (tecla H).

**Architecture:** Funções puras de pontuação (`scoring.ts`) e persistência (`scoreHistory.ts`); dois componentes de apresentação (`ScoreBoard`, `ScoreHistory`); o `ExercisePlayer` amostra a cada 100 ms a contagem da passada, grava no fim da passada e compõe sessão/geral.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + Testing Library (jsdom 25).

**Spec:** `docs/superpowers/specs/2026-10-22-score-and-history-design.md`

**Convenções do repo:**
- Rodar comandos de dentro de `frontend/` (`npm test`, `npx tsc -b`).
- Commits com a identidade configurada no git, **sem** trailer `Co-Authored-By`.
- Textos de UI em português; código e comentários em inglês.

---

### Task 1: Regras de pontuação e histórico (puro)

**Files:**
- Create: `frontend/src/lib/scoring.ts`, `frontend/src/lib/scoring.test.ts`
- Create: `frontend/src/lib/scoreHistory.ts`, `frontend/src/lib/scoreHistory.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/lib/scoring.test.ts
import { describe, expect, it } from 'vitest';
import { addSample, addTallies, EMPTY_TALLY, formatSeconds, hitPercent, isHit } from './scoring';

const note = (midiNumber: number, cents: number) => ({ noteName: 'X', octave: 4, midiNumber, cents });

describe('isHit', () => {
  it('accepts the target note within ±10 cents', () => {
    expect(isHit(note(60, 0), 60)).toBe(true);
    expect(isHit(note(60, 10), 60)).toBe(true);
    expect(isHit(note(60, -10), 60)).toBe(true);
    expect(isHit(note(60, 11), 60)).toBe(false);
  });

  it('accepts the target note in any octave', () => {
    expect(isHit(note(48, 3), 60)).toBe(true);
    expect(isHit(note(72, -5), 60)).toBe(true);
  });

  it('rejects other notes, including neighbours across the octave boundary', () => {
    expect(isHit(note(61, 0), 60)).toBe(false);
    expect(isHit(note(59, 0), 60)).toBe(false);
    expect(isHit(note(71, 0), 60)).toBe(false);
  });

  it('counts a neighbouring note bent into tune as a hit', () => {
    expect(isHit(note(59, 95), 60)).toBe(true);
  });

  it('is never a hit without a detected note or a target', () => {
    expect(isHit(null, 60)).toBe(false);
    expect(isHit(note(60, 0), null)).toBe(false);
  });
});

describe('tallies', () => {
  it('adds target time always and hit time only on hits', () => {
    const tally = addSample(addSample(EMPTY_TALLY, 0.1, true), 0.1, false);
    expect(tally.targetSeconds).toBeCloseTo(0.2);
    expect(tally.hitSeconds).toBeCloseTo(0.1);
  });

  it('sums tallies', () => {
    expect(addTallies({ targetSeconds: 1, hitSeconds: 0.5 }, { targetSeconds: 2, hitSeconds: 1 })).toEqual({
      targetSeconds: 3,
      hitSeconds: 1.5,
    });
  });

  it('computes the hit percentage, 0 without target time', () => {
    expect(hitPercent({ targetSeconds: 3, hitSeconds: 2 })).toBe(67);
    expect(hitPercent(EMPTY_TALLY)).toBe(0);
  });
});

describe('formatSeconds', () => {
  it('uses one decimal below a minute and minutes above', () => {
    expect(formatSeconds(0)).toBe('0,0 s');
    expect(formatSeconds(48.24)).toBe('48,2 s');
    expect(formatSeconds(725)).toBe('12 min 05 s');
    expect(formatSeconds(59.96)).toBe('1 min 00 s');
  });
});
```

```ts
// frontend/src/lib/scoreHistory.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendScoreRecord,
  bestPercentByExercise,
  loadScoreHistory,
  MAX_HISTORY,
  totalTally,
  type ScoreRecord,
} from './scoreHistory';

const STORAGE_KEY = 'singer-trainer:score-history';

function record(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    exerciseId: 'escala-maior',
    exerciseName: 'Escala Maior',
    finishedAt: 1_700_000_000_000,
    playbackRate: 1,
    targetSeconds: 10,
    hitSeconds: 5,
    ...overrides,
  };
}

describe('scoreHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty', () => {
    expect(loadScoreHistory()).toEqual([]);
  });

  it('appends records and loads them back, oldest first', () => {
    appendScoreRecord(record({ finishedAt: 1 }));
    const history = appendScoreRecord(record({ finishedAt: 2 }));
    expect(history.map((entry) => entry.finishedAt)).toEqual([1, 2]);
    expect(loadScoreHistory()).toEqual(history);
  });

  it(`keeps only the latest ${MAX_HISTORY} records`, () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from({ length: MAX_HISTORY }, (_, index) => record({ finishedAt: index })))
    );
    const history = appendScoreRecord(record({ finishedAt: MAX_HISTORY }));
    expect(history).toHaveLength(MAX_HISTORY);
    expect(history[0].finishedAt).toBe(1);
    expect(history[history.length - 1].finishedAt).toBe(MAX_HISTORY);
  });

  it('ignores corrupted storage and invalid entries', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadScoreHistory()).toEqual([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([record(), { exerciseId: 'x' }, 42]));
    expect(loadScoreHistory()).toEqual([record()]);
  });

  it('does not throw when localStorage is unavailable', () => {
    const originalGet = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new Error('unavailable');
    };
    Storage.prototype.setItem = () => {
      throw new Error('unavailable');
    };
    try {
      expect(loadScoreHistory()).toEqual([]);
      expect(appendScoreRecord(record())).toEqual([record()]);
    } finally {
      Storage.prototype.getItem = originalGet;
      Storage.prototype.setItem = originalSet;
    }
  });

  it('finds the best percentage per exercise', () => {
    const history = [
      record({ exerciseId: 'a', targetSeconds: 10, hitSeconds: 5 }),
      record({ exerciseId: 'a', targetSeconds: 10, hitSeconds: 8 }),
      record({ exerciseId: 'b', targetSeconds: 4, hitSeconds: 1 }),
    ];
    expect(bestPercentByExercise(history)).toEqual({ a: 80, b: 25 });
  });

  it('sums every record into one tally', () => {
    expect(totalTally([record({ targetSeconds: 10, hitSeconds: 5 }), record({ targetSeconds: 2, hitSeconds: 2 })])).toEqual({
      targetSeconds: 12,
      hitSeconds: 7,
    });
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd frontend && npx vitest run src/lib/scoring.test.ts src/lib/scoreHistory.test.ts`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement**

```ts
// frontend/src/lib/scoring.ts
import type { NoteInfo } from './noteUtils';

/** Same tolerance as the green "in tune" color of the live indicator. */
export const HIT_TOLERANCE_CENTS = 10;

export interface ScoreTally {
  /** Seconds during which there was a target note to sing. */
  targetSeconds: number;
  /** Of those, seconds sung in tune. */
  hitSeconds: number;
}

export const EMPTY_TALLY: ScoreTally = { targetSeconds: 0, hitSeconds: 0 };

/** True when the detected note matches the target's pitch class within the tolerance, in any octave. */
export function isHit(detected: NoteInfo | null, targetMidi: number | null): boolean {
  if (!detected || targetMidi === null) return false;
  const semitones = detected.midiNumber - targetMidi;
  const wrapped = ((((semitones % 12) + 18) % 12) - 6); // nearest octave, in [-6, 6)
  return Math.abs(wrapped * 100 + detected.cents) <= HIT_TOLERANCE_CENTS;
}

export function addSample(tally: ScoreTally, seconds: number, hit: boolean): ScoreTally {
  return {
    targetSeconds: tally.targetSeconds + seconds,
    hitSeconds: tally.hitSeconds + (hit ? seconds : 0),
  };
}

export function addTallies(a: ScoreTally, b: ScoreTally): ScoreTally {
  return { targetSeconds: a.targetSeconds + b.targetSeconds, hitSeconds: a.hitSeconds + b.hitSeconds };
}

export function hitPercent(tally: ScoreTally): number {
  return tally.targetSeconds > 0 ? Math.round((tally.hitSeconds / tally.targetSeconds) * 100) : 0;
}

/** "48,2 s" below a minute, "12 min 05 s" from a minute on. */
export function formatSeconds(seconds: number): string {
  const tenths = Math.round(seconds * 10) / 10;
  if (tenths < 60) {
    return `${tenths.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
  }
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)} min ${String(whole % 60).padStart(2, '0')} s`;
}
```

```ts
// frontend/src/lib/scoreHistory.ts
import { addTallies, EMPTY_TALLY, hitPercent, type ScoreTally } from './scoring';

const STORAGE_KEY = 'singer-trainer:score-history';
export const MAX_HISTORY = 500;

/** One completed pass of an exercise. */
export interface ScoreRecord extends ScoreTally {
  exerciseId: string;
  exerciseName: string;
  /** Epoch milliseconds. */
  finishedAt: number;
  playbackRate: number;
}

function isScoreRecord(value: unknown): value is ScoreRecord {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.exerciseId === 'string' &&
    typeof entry.exerciseName === 'string' &&
    typeof entry.finishedAt === 'number' &&
    typeof entry.playbackRate === 'number' &&
    typeof entry.targetSeconds === 'number' &&
    typeof entry.hitSeconds === 'number'
  );
}

/** Reads the stored history, oldest first; empty if unset, unavailable or corrupted. */
export function loadScoreHistory(): ScoreRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isScoreRecord) : [];
  } catch {
    return [];
  }
}

/** Appends a record (keeping the latest MAX_HISTORY) and returns the new history. */
export function appendScoreRecord(record: ScoreRecord): ScoreRecord[] {
  const history = [...loadScoreHistory(), record].slice(-MAX_HISTORY);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Private browsing / quota exceeded — the session still shows the score.
  }
  return history;
}

export function bestPercentByExercise(history: ScoreRecord[]): Record<string, number> {
  const best: Record<string, number> = {};
  for (const entry of history) {
    best[entry.exerciseId] = Math.max(best[entry.exerciseId] ?? 0, hitPercent(entry));
  }
  return best;
}

export function totalTally(history: ScoreRecord[]): ScoreTally {
  return history.reduce<ScoreTally>((sum, entry) => addTallies(sum, entry), EMPTY_TALLY);
}
```

Note: `addTallies(sum, entry)` must return only the two tally fields (it does), so the reduce result stays a plain `ScoreTally`.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd frontend && npx vitest run src/lib/scoring.test.ts src/lib/scoreHistory.test.ts && npx tsc -b`
Expected: PASS, `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/scoring.ts frontend/src/lib/scoring.test.ts frontend/src/lib/scoreHistory.ts frontend/src/lib/scoreHistory.test.ts
git commit -m "feat: add pitch-hit scoring rules and score history storage"
```

---

### Task 2: `ScoreBoard` e `ScoreHistory` (apresentação)

**Files:**
- Create: `frontend/src/components/ScoreBoard.tsx`, `frontend/src/components/ScoreBoard.test.tsx`
- Create: `frontend/src/components/ScoreHistory.tsx`, `frontend/src/components/ScoreHistory.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/components/ScoreBoard.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScoreBoard } from './ScoreBoard';

describe('ScoreBoard', () => {
  it('shows the session and overall time in tune and hit percentage', () => {
    render(
      <ScoreBoard
        session={{ targetSeconds: 60, hitSeconds: 48.2 }}
        overall={{ targetSeconds: 1000, hitSeconds: 725 }}
        onOpenHistory={() => {}}
      />
    );
    const board = screen.getByRole('button', { name: 'Pontuação — abrir histórico' });
    expect(board.textContent).toContain('Sessão');
    expect(board.textContent).toContain('Geral');
    expect(screen.getByTestId('score-session-time').textContent).toBe('48,2 s');
    expect(screen.getByTestId('score-session-percent').textContent).toBe('80%');
    expect(screen.getByTestId('score-overall-time').textContent).toBe('12 min 05 s');
    expect(screen.getByTestId('score-overall-percent').textContent).toBe('73%');
  });

  it('opens the history when clicked', () => {
    const onOpenHistory = vi.fn();
    render(
      <ScoreBoard
        session={{ targetSeconds: 0, hitSeconds: 0 }}
        overall={{ targetSeconds: 0, hitSeconds: 0 }}
        onOpenHistory={onOpenHistory}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pontuação — abrir histórico' }));
    expect(onOpenHistory).toHaveBeenCalled();
  });
});
```

```tsx
// frontend/src/components/ScoreHistory.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ScoreHistory } from './ScoreHistory';
import type { ScoreRecord } from '../lib/scoreHistory';

function record(overrides: Partial<ScoreRecord>): ScoreRecord {
  return {
    exerciseId: 'escala-maior',
    exerciseName: 'Escala Maior',
    finishedAt: Date.UTC(2026, 9, 22, 15, 0),
    playbackRate: 1,
    targetSeconds: 10,
    hitSeconds: 5,
    ...overrides,
  };
}

describe('ScoreHistory', () => {
  it('is not shown while closed', () => {
    render(<ScoreHistory open={false} onClose={() => {}} history={[]} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says there is nothing yet when the history is empty', () => {
    render(<ScoreHistory open onClose={() => {}} history={[]} />);
    expect(screen.getByRole('dialog', { name: 'Histórico de pontuação' }).textContent).toContain(
      'Nenhuma passada completa ainda.'
    );
  });

  it('lists the latest passes newest first, with time in tune and percentage', () => {
    render(
      <ScoreHistory
        open
        onClose={() => {}}
        history={[
          record({ exerciseName: 'Escala Maior', finishedAt: 1, hitSeconds: 5 }),
          record({ exerciseId: 'arpejo', exerciseName: 'Arpejo Maior', finishedAt: 2, hitSeconds: 9 }),
        ]}
      />
    );
    const rows = within(screen.getByRole('table', { name: 'Últimas passadas' })).getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('Arpejo Maior');
    expect(rows[0].textContent).toContain('9,0 s');
    expect(rows[0].textContent).toContain('90%');
    expect(rows[1].textContent).toContain('Escala Maior');
  });

  it('shows the best percentage per exercise', () => {
    render(
      <ScoreHistory
        open
        onClose={() => {}}
        history={[record({ hitSeconds: 5 }), record({ hitSeconds: 8 })]}
      />
    );
    const records = screen.getByRole('table', { name: 'Recordes' });
    expect(records.textContent).toContain('Escala Maior');
    expect(records.textContent).toContain('80%');
  });

  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(<ScoreHistory open onClose={onClose} history={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd frontend && npx vitest run src/components/ScoreBoard.test.tsx src/components/ScoreHistory.test.tsx`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement**

```tsx
// frontend/src/components/ScoreBoard.tsx
import { formatSeconds, hitPercent, type ScoreTally } from '../lib/scoring';

export interface ScoreBoardProps {
  session: ScoreTally;
  overall: ScoreTally;
  onOpenHistory: () => void;
}

export function ScoreBoard({ session, overall, onOpenHistory }: ScoreBoardProps) {
  return (
    <button type="button" className="score-board" onClick={onOpenHistory} aria-label="Pontuação — abrir histórico">
      <span className="score-board-grid">
        <span />
        <span className="score-board-heading">Sessão</span>
        <span className="score-board-heading">Geral</span>
        <span className="score-board-label">Afinado</span>
        <strong data-testid="score-session-time">{formatSeconds(session.hitSeconds)}</strong>
        <strong data-testid="score-overall-time">{formatSeconds(overall.hitSeconds)}</strong>
        <span className="score-board-label">Acerto</span>
        <strong data-testid="score-session-percent">{hitPercent(session)}%</strong>
        <strong data-testid="score-overall-percent">{hitPercent(overall)}%</strong>
      </span>
    </button>
  );
}
```

```tsx
// frontend/src/components/ScoreHistory.tsx
import { useEffect, useRef } from 'react';
import { formatSeconds, hitPercent } from '../lib/scoring';
import { bestPercentByExercise, type ScoreRecord } from '../lib/scoreHistory';

export interface ScoreHistoryProps {
  open: boolean;
  onClose: () => void;
  history: ScoreRecord[];
}

const RECENT_COUNT = 50;

/** Native modal <dialog> with the best score per exercise and the latest completed passes. */
export function ScoreHistory({ open, onClose, history }: ScoreHistoryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const best = bestPercentByExercise(history);
  const exerciseNames = new Map(history.map((entry) => [entry.exerciseId, entry.exerciseName]));
  const recent = history.slice(-RECENT_COUNT).reverse();

  return (
    <dialog ref={dialogRef} className="app-dialog" aria-labelledby="score-history-title" onClose={onClose}>
      <h2 id="score-history-title" className="app-dialog-title">
        Histórico de pontuação
      </h2>
      {history.length === 0 ? (
        <p className="score-history-empty">Nenhuma passada completa ainda.</p>
      ) : (
        <>
          <table className="score-history-table" aria-label="Recordes">
            <caption>Recordes</caption>
            <tbody>
              {Object.entries(best).map(([exerciseId, percent]) => (
                <tr key={exerciseId}>
                  <th scope="row">{exerciseNames.get(exerciseId)}</th>
                  <td>{percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="score-history-table" aria-label="Últimas passadas">
            <caption>Últimas passadas</caption>
            <thead>
              <tr>
                <th scope="col">Quando</th>
                <th scope="col">Exercício</th>
                <th scope="col">Afinado</th>
                <th scope="col">Acerto</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((entry) => (
                <tr key={`${entry.finishedAt}-${entry.exerciseId}`}>
                  <td>
                    {new Date(entry.finishedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td>{entry.exerciseName}</td>
                  <td>{formatSeconds(entry.hitSeconds)}</td>
                  <td>{hitPercent(entry)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <button type="button" className="app-dialog-close" onClick={onClose}>
        Fechar
      </button>
    </dialog>
  );
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `cd frontend && npx vitest run src/components/ScoreBoard.test.tsx src/components/ScoreHistory.test.tsx && npx tsc -b`
Expected: PASS, `tsc` clean. (Note: `aria-label` on the tables gives them the accessible names used by the tests; keep the visible `<caption>` too.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ScoreBoard.tsx frontend/src/components/ScoreBoard.test.tsx frontend/src/components/ScoreHistory.tsx frontend/src/components/ScoreHistory.test.tsx
git commit -m "feat: add score board and score history dialog components"
```

---

### Task 3: Ligar a pontuação no `ExercisePlayer` + tecla H + estilo + README

**Files:**
- Modify: `frontend/src/lib/keyboardShortcuts.ts`, `frontend/src/lib/keyboardShortcuts.test.ts`
- Modify: `frontend/src/components/ExercisePlayer.tsx`
- Create: `frontend/src/components/ExercisePlayer.scoring.test.tsx`
- Modify: `frontend/src/index.css`, `README.md`

- [ ] **Step 1: Shortcut H (TDD)**

In `keyboardShortcuts.test.ts` add `['h', 'showHistory']` to the `it.each` table. Run it (FAIL), then in `keyboardShortcuts.ts`: add `| 'showHistory'` to `ShortcutAction`, `h: 'showHistory'` to `ACTIONS_BY_KEY`, and `{ keys: 'H', description: 'Abrir o histórico de pontuação' }` to `SHORTCUT_HELP` right after the `?` row. Run again (PASS).

- [ ] **Step 2: Write the failing integration tests**

```tsx
// frontend/src/components/ExercisePlayer.scoring.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ExercisePlayer } from './ExercisePlayer';
import type { Exercise } from '../lib/exercises';
import type { PitchTrackerState } from '../hooks/usePitchTracker';

const tracker: { state: PitchTrackerState } = {
  state: { status: 'listening', errorMessage: null, currentNote: null, waveform: [], deviceName: null, deviceId: null },
};

vi.mock('../hooks/usePitchTracker', () => ({
  usePitchTracker: () => tracker.state,
}));

// One second-long C4, so a full pass is ten 100ms scoring ticks.
const EXERCISE: Exercise = {
  id: 'one-note',
  name: 'Uma nota',
  category: 'escala',
  description: 'Teste.',
  notes: [{ midiNumber: 60, startTime: 0, duration: 1 }],
};

let mockClockMs = 0;

class MockAudioContext {
  destination = {};
  private startedAtMs = mockClockMs;
  get currentTime() {
    return (mockClockMs - this.startedAtMs) / 1000;
  }
  createOscillator() {
    return { type: 'sine', frequency: { value: 0, setValueAtTime() {} }, connect() {}, start() {}, stop() {} };
  }
  createGain() {
    return { gain: { value: 0, setValueAtTime() {} }, connect() {} };
  }
  resume() {
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

function advance(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    mockClockMs += 100;
    act(() => {
      vi.advanceTimersByTime(100);
    });
  }
}

function renderPlayer() {
  return render(<ExercisePlayer exercise={EXERCISE} onPreviousExercise={() => {}} onNextExercise={() => {}} />);
}

function savedHistory() {
  return JSON.parse(localStorage.getItem('singer-trainer:score-history') ?? '[]');
}

describe('ExercisePlayer scoring', () => {
  beforeEach(() => {
    localStorage.clear();
    mockClockMs = 0;
    tracker.state = { ...tracker.state, status: 'listening', currentNote: null };
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('records a perfect pass when the target is sung in tune the whole time', () => {
    tracker.state = { ...tracker.state, currentNote: { noteName: 'C', octave: 3, midiNumber: 48, cents: 2 } };
    renderPlayer();
    advance(1200);
    const history = savedHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ exerciseId: 'one-note', exerciseName: 'Uma nota' });
    expect(history[0].hitSeconds / history[0].targetSeconds).toBeCloseTo(1);
    expect(screen.getByTestId('score-session-percent').textContent).toBe('100%');
    expect(screen.getByTestId('score-overall-percent').textContent).toBe('100%');
  });

  it('counts silence as a miss', () => {
    renderPlayer();
    advance(1200);
    expect(savedHistory()[0].hitSeconds).toBe(0);
    expect(screen.getByTestId('score-session-percent').textContent).toBe('0%');
  });

  it('does not count time while paused', () => {
    tracker.state = { ...tracker.state, currentNote: { noteName: 'C', octave: 4, midiNumber: 60, cents: 0 } };
    renderPlayer();
    fireEvent.keyDown(document.body, { key: ' ' });
    advance(500);
    expect(screen.getByTestId('score-session-time').textContent).toBe('0,0 s');
  });

  it('does not record passes while the microphone is not listening', () => {
    tracker.state = { ...tracker.state, status: 'off' };
    renderPlayer();
    advance(1200);
    expect(savedHistory()).toEqual([]);
  });

  it('adds the stored history to the overall score but not to the session', () => {
    localStorage.setItem(
      'singer-trainer:score-history',
      JSON.stringify([
        { exerciseId: 'x', exerciseName: 'X', finishedAt: 1, playbackRate: 1, targetSeconds: 10, hitSeconds: 0 },
      ])
    );
    tracker.state = { ...tracker.state, currentNote: { noteName: 'C', octave: 4, midiNumber: 60, cents: 0 } };
    renderPlayer();
    advance(1200);
    expect(screen.getByTestId('score-session-percent').textContent).toBe('100%');
    expect(screen.getByTestId('score-overall-percent').textContent).toBe('9%');
  });

  it('opens the score history with H and from the score board', () => {
    renderPlayer();
    fireEvent.keyDown(document.body, { key: 'h' });
    expect(screen.getByRole('dialog', { name: 'Histórico de pontuação' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pontuação — abrir histórico' }));
    expect(screen.getByRole('dialog', { name: 'Histórico de pontuação' })).toBeDefined();
  });
});
```

Notes for the implementer:
- In the "overall" test the expected 9% is `1 / (10 + 1)` rounded (history: 10 s target, 0 hit; this pass: ~1 s target, ~1 s hit). If the number of scoring ticks inside the one-second pass makes it 9 or 10 ticks, the percentage still rounds to 9%; if your tick alignment yields something else, assert on the session/overall relationship with the actual recorded `targetSeconds` instead of a magic number, and mention it.
- The ExercisePlayer's existing tone code calls `createOscillator`/`createGain` via `playExerciseTone`; if the mock above misses a method it uses, add it.

- [ ] **Step 3: Run tests — expect failures**

Run: `cd frontend && npx vitest run src/components/ExercisePlayer.scoring.test.tsx`
Expected: FAIL (no score board, nothing recorded).

- [ ] **Step 4: Implement in `ExercisePlayer.tsx`**

1. Imports:

```ts
import { addSample, addTallies, EMPTY_TALLY, isHit, type ScoreTally } from '../lib/scoring';
import { appendScoreRecord, loadScoreHistory, totalTally } from '../lib/scoreHistory';
import { ScoreBoard } from './ScoreBoard';
import { ScoreHistory } from './ScoreHistory';
import type { NoteInfo } from '../lib/noteUtils';
```

2. Module constant: `const SCORE_TICK_MS = 100;`

3. State (next to `helpOpen`):

```ts
  const [historyOpen, setHistoryOpen] = useState(false);
  const [passTally, setPassTally] = useState<ScoreTally>(EMPTY_TALLY);
  const [sessionTally, setSessionTally] = useState<ScoreTally>(EMPTY_TALLY);
  const [history, setHistory] = useState(() => loadScoreHistory());
  const historyTally = useMemo(() => totalTally(history), [history]);
```

4. In the playback effect: right after `setEnded(false);` add `setPassTally(EMPTY_TALLY);` (a new pass starts — an interrupted one is discarded). Inside the poll, right after `hasEnded = true;` add `completePassRef.current();`.

5. After `const targetNote = noteAtTime(scaledExercise, elapsed);` add the sampling and the pass completion:

```ts
  // Scoring samples on its own 100ms tick from refs, so it reads the latest pitch and target
  // without re-arming the interval on every detection update.
  const scoringRef = useRef<{ active: boolean; targetMidi: number | null; detected: NoteInfo | null }>({
    active: false,
    targetMidi: null,
    detected: null,
  });
  useEffect(() => {
    scoringRef.current = {
      active: playing && !ended && pitchTracker.status === 'listening',
      targetMidi: targetNote?.midiNumber ?? null,
      detected: pitchTracker.currentNote,
    };
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      const { active, targetMidi, detected } = scoringRef.current;
      if (!active || targetMidi === null) return;
      setPassTally((tally) => addSample(tally, SCORE_TICK_MS / 1000, isHit(detected, targetMidi)));
    }, SCORE_TICK_MS);
    return () => clearInterval(intervalId);
  }, []);

  // Called by the playback poll when a pass reaches its end: the pass moves into the session
  // and the stored history (and leaves the live pass tally, so nothing is counted twice).
  const completePassRef = useRef(() => {});
  useEffect(() => {
    completePassRef.current = () => {
      if (passTally.targetSeconds === 0) return;
      setHistory(
        appendScoreRecord({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          finishedAt: Date.now(),
          playbackRate,
          ...passTally,
        })
      );
      setSessionTally((tally) => addTallies(tally, passTally));
      setPassTally(EMPTY_TALLY);
    };
  });
```

Note: `completePassRef` is used inside the playback effect, which is declared earlier in the component; that's fine because the ref is only read when the poll fires. Declare the `useRef` line for `completePassRef` **before** the playback effect (move just that `const completePassRef = useRef(() => {});` line up near the other refs) so it's in scope there; keep the `useEffect` that assigns it after `targetNote`.

6. Shortcuts: change `if (helpOpen) return;` to `if (helpOpen || historyOpen) return;` and add:

```ts
        case 'showHistory':
          setHistoryOpen(true);
          break;
```

7. Render: as the **first** child of `<section className="exercise-panel">`:

```tsx
      <ScoreBoard
        session={addTallies(sessionTally, passTally)}
        overall={addTallies(historyTally, passTally)}
        onOpenHistory={() => setHistoryOpen(true)}
      />
```

and next to `<KeyboardHelp ... />`:

```tsx
      <ScoreHistory open={historyOpen} onClose={() => setHistoryOpen(false)} history={history} />
```

- [ ] **Step 5: Dialog styles shared + score styles**

In `frontend/src/index.css`:

1. Make the help dialog styles shared: rename the selectors `.keyboard-help` → `.keyboard-help, .app-dialog`, `.keyboard-help::backdrop` → `.keyboard-help::backdrop, .app-dialog::backdrop`, `.keyboard-help-title` → `.keyboard-help-title, .app-dialog-title`, `.keyboard-help-close` (and its `:hover`/`:focus-visible` rule) → add `.app-dialog-close` alongside. Do not rename the classes used by `KeyboardHelp`.
2. Add `position: relative;` to the existing `.app` rule.
3. Add (before the `@media (min-width: 900px)` block):

```css
.score-board {
  position: absolute;
  top: 1rem;
  right: 1.5rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-elevated);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 0.8rem;
  cursor: pointer;
}

.score-board:hover,
.score-board:focus-visible {
  border-color: var(--color-accent);
}

.score-board-grid {
  display: grid;
  grid-template-columns: auto auto auto;
  column-gap: 0.9rem;
  row-gap: 0.15rem;
  align-items: baseline;
  text-align: right;
}

.score-board-heading,
.score-board-label {
  color: var(--color-text-muted);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.score-board-label {
  text-align: left;
}

.score-board strong {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--color-accent);
}

.score-history-table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 1rem;
  font-size: 0.85rem;
}

.score-history-table caption {
  text-align: left;
  font-weight: 600;
  margin-bottom: 0.4rem;
}

.score-history-table th,
.score-history-table td {
  padding: 0.3rem 0.5rem 0.3rem 0;
  text-align: left;
  font-weight: 400;
}

.score-history-table td:last-child {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.score-history-empty {
  color: var(--color-text-muted);
}

@media (max-width: 899px) {
  .score-board {
    position: static;
    margin: 0 auto 1rem;
  }
}
```

Also make the history dialog a bit wider than the help one: add `.app-dialog { max-width: min(560px, calc(100vw - 2rem)); max-height: 80vh; overflow: auto; }` after the shared dialog rule.

- [ ] **Step 6: README** — under `## Funcionalidades`, add after the keyboard bullet:

```markdown
- **Pontuação e histórico** — placar no canto superior direito com o tempo afinado (±10
  cents da nota-alvo, em qualquer oitava) e a % de acerto da sessão e geral; cada passada
  completa é gravada no navegador, e o painel de histórico (clique no placar ou H) mostra
  os recordes por exercício e as últimas passadas.
```

and change the Arquitetura flowchart node to `Prefs["localStorage<br/>preferências, último exercício e histórico de pontuação"]`. Validate the Mermaid blocks with `~/.local/bin/mmdc` (puppeteer config with `/usr/bin/google-chrome-stable` + `--no-sandbox` via `-p` if needed), temp files in the session scratchpad.

- [ ] **Step 7: Full verification**

Run: `cd frontend && npm test && npx tsc -b && npm run build`
Expected: all PASS, no act warnings.

- [ ] **Step 8: Visual check** — run `npx vite --port 5179 --strictPort` from `frontend/`, open with the Playwright MCP at 1366×768 and 680×890 (screenshots under `.playwright-mcp/`), confirm the score board sits top-right without covering the title/selector (wide) and is in the flow on narrow screens, and that pressing `h` opens a legible history dialog. Stop the server by PID.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/keyboardShortcuts.ts frontend/src/lib/keyboardShortcuts.test.ts frontend/src/components/ExercisePlayer.tsx frontend/src/components/ExercisePlayer.scoring.test.tsx frontend/src/index.css README.md
git commit -m "feat: score time in tune per pass, with session/overall totals and history"
```
