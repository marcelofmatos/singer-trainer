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
