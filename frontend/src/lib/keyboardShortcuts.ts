// frontend/src/lib/keyboardShortcuts.ts
export type ShortcutAction =
  | 'togglePlay'
  | 'toggleMute'
  | 'toggleMic'
  | 'toggleLoop'
  | 'nextNote'
  | 'previousNote'
  | 'firstNote'
  | 'slower'
  | 'faster'
  | 'lessSensitive'
  | 'moreSensitive'
  | 'previousExercise'
  | 'nextExercise'
  | 'showHelp'
  | 'showHistory'
  | 'nextView';

/** The subset of a KeyboardEvent that resolveShortcut needs (keeps it testable without real events). */
export interface ShortcutKeyEvent {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  target: EventTarget | null;
}

const ACTIONS_BY_KEY: Record<string, ShortcutAction> = {
  ' ': 'togglePlay',
  s: 'toggleMute',
  m: 'toggleMic',
  r: 'toggleLoop',
  ArrowRight: 'nextNote',
  ArrowDown: 'nextNote',
  ArrowLeft: 'previousNote',
  ArrowUp: 'previousNote',
  Home: 'firstNote',
  '-': 'slower',
  '+': 'faster',
  '=': 'faster',
  ',': 'lessSensitive',
  '.': 'moreSensitive',
  PageUp: 'previousExercise',
  '[': 'previousExercise',
  PageDown: 'nextExercise',
  ']': 'nextExercise',
  '?': 'showHelp',
  h: 'showHistory',
  v: 'nextView',
};

const RANGE_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'];

/**
 * Keys the focused element already handles natively. Only those keys are left alone — other
 * shortcuts keep working, so a button that kept focus after a mouse click doesn't swallow
 * every shortcut. The wheel bubbles own none: arrows, Home and Space stay global, and Enter
 * (unmapped here) is handled by the bubble itself.
 */
function keysOwnedByFocus(target: EventTarget | null): 'all' | string[] {
  if (!(target instanceof Element)) return [];
  if (target.matches('select, textarea')) return 'all';
  if (target instanceof HTMLInputElement) {
    if (target.type === 'range') return RANGE_KEYS;
    if (target.type === 'checkbox') return [' '];
    return 'all';
  }
  if (target.matches('button')) return [' '];
  return [];
}

export function resolveShortcut(event: ShortcutKeyEvent): ShortcutAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const action = ACTIONS_BY_KEY[key];
  if (!action) return null;
  const owned = keysOwnedByFocus(event.target);
  if (owned === 'all' || owned.includes(key)) return null;
  return action;
}

/** Rows of the keyboard help dialog — kept next to the key map so the two never diverge. */
export const SHORTCUT_HELP: { keys: string; description: string }[] = [
  { keys: 'Espaço', description: 'Tocar / pausar / reiniciar o exercício' },
  { keys: '← → ↑ ↓', description: 'Navegar entre as notas da roda' },
  { keys: 'Home', description: 'Voltar para o C' },
  { keys: 'Enter', description: 'Tocar a nota selecionada' },
  { keys: '- / +', description: 'Diminuir / aumentar a velocidade' },
  { keys: ', / .', description: 'Diminuir / aumentar a sensibilidade do microfone' },
  { keys: 'S', description: 'Silenciar / ativar o som da referência' },
  { keys: 'M', description: 'Ligar / desligar o microfone da primeira entrada' },
  { keys: 'R', description: 'Repetir o exercício' },
  { keys: 'PageUp ou [', description: 'Exercício anterior' },
  { keys: 'PageDown ou ]', description: 'Próximo exercício' },
  { keys: '?', description: 'Mostrar estes atalhos' },
  { keys: 'H', description: 'Abrir o histórico de pontuação' },
  { keys: 'V', description: 'Trocar a visualização (roda, piano-roll, afinador, teclado)' },
];

/** Adds `delta` to `value`, clamped to [min, max] and rounded to 2 decimals (slider steps are 0.05/0.25). */
export function stepWithin(value: number, delta: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100));
}
