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
