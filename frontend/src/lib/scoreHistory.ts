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
