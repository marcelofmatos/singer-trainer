export type VisualizationMode = 'wheel' | 'piano-roll' | 'tuner' | 'keyboard';

export const VISUALIZATION_MODES: { id: VisualizationMode; label: string }[] = [
  { id: 'wheel', label: 'Roda' },
  { id: 'piano-roll', label: 'Piano-roll' },
  { id: 'tuner', label: 'Afinador' },
  { id: 'keyboard', label: 'Teclado' },
];

const STORAGE_KEY = 'singer-trainer:visualization';

function isMode(value: unknown): value is VisualizationMode {
  return VISUALIZATION_MODES.some((mode) => mode.id === value);
}

export function loadVisualization(): VisualizationMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isMode(stored) ? stored : 'wheel';
  } catch {
    return 'wheel';
  }
}

export function saveVisualization(mode: VisualizationMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private browsing / quota exceeded — the choice just won't be remembered.
  }
}

export function nextVisualization(mode: VisualizationMode): VisualizationMode {
  const index = VISUALIZATION_MODES.findIndex((entry) => entry.id === mode);
  return VISUALIZATION_MODES[(index + 1) % VISUALIZATION_MODES.length].id;
}

const FILL_STORAGE_KEY = 'singer-trainer:piano-roll-fill';

/** How much of its note row each piano-roll voice block fills, 0-1 (1 by default). */
export function loadPianoRollFill(): number {
  try {
    const stored = localStorage.getItem(FILL_STORAGE_KEY);
    const fill = stored === null || stored.trim() === '' ? NaN : Number(stored);
    return fill >= 0 && fill <= 1 ? fill : 1;
  } catch {
    return 1;
  }
}

export function savePianoRollFill(fill: number): void {
  try {
    localStorage.setItem(FILL_STORAGE_KEY, String(fill));
  } catch {
    // Private browsing / quota exceeded — the choice just won't be remembered.
  }
}
