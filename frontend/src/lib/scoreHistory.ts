// frontend/src/lib/scoreHistory.ts
import {
  addNoteTallies,
  addTallies,
  EMPTY_NOTE_TALLIES,
  EMPTY_TALLY,
  hitPercent,
  type NoteTallies,
  type ScoreTally,
} from './scoring';

const STORAGE_KEY = 'singer-trainer:score-history';
export const MAX_HISTORY = 500;
const PRIMARY_INPUT_ID = 'primary';

/** One completed pass of an exercise. */
export interface ScoreRecord extends ScoreTally {
  exerciseId: string;
  exerciseName: string;
  /** Epoch milliseconds. */
  finishedAt: number;
  playbackRate: number;
  /** Lane that produced the record; absent on records from before multiple inputs (= primary). */
  inputId?: string;
  inputLabel?: string;
  /** Per pitch class (C…B), only on free-exercise records. */
  noteTallies?: ScoreTally[];
}

function isTally(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const tally = value as Record<string, unknown>;
  return typeof tally.targetSeconds === 'number' && typeof tally.hitSeconds === 'number';
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
    typeof entry.hitSeconds === 'number' &&
    (entry.inputId === undefined || typeof entry.inputId === 'string') &&
    (entry.inputLabel === undefined || typeof entry.inputLabel === 'string') &&
    (entry.noteTallies === undefined ||
      (Array.isArray(entry.noteTallies) && entry.noteTallies.length === 12 && entry.noteTallies.every(isTally)))
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

export function clearScoreHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — there is nothing stored to clear.
  }
}

export interface BestScore {
  /** `exerciseId|inputId` — unique even when two inputs share a label. */
  key: string;
  exerciseName: string;
  /** null for the primary lane. */
  inputLabel: string | null;
  percent: number;
}

/** Best percentage per exercise and input, in order of first appearance. */
export function bestScores(history: ScoreRecord[]): BestScore[] {
  const best = new Map<string, BestScore>();
  for (const entry of history) {
    const inputId = entry.inputId ?? PRIMARY_INPUT_ID;
    const key = `${entry.exerciseId}|${inputId}`;
    const percent = hitPercent(entry);
    const current = best.get(key);
    if (!current || percent > current.percent) {
      best.set(key, {
        key,
        exerciseName: entry.exerciseName,
        inputLabel: inputId === PRIMARY_INPUT_ID ? null : (entry.inputLabel ?? null),
        percent,
      });
    }
  }
  return [...best.values()];
}

export function totalTally(history: ScoreRecord[]): ScoreTally {
  return history.reduce<ScoreTally>((sum, entry) => addTallies(sum, entry), EMPTY_TALLY);
}

export function totalTallyForInput(history: ScoreRecord[], inputId: string): ScoreTally {
  return totalTally(history.filter((entry) => (entry.inputId ?? PRIMARY_INPUT_ID) === inputId));
}

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
