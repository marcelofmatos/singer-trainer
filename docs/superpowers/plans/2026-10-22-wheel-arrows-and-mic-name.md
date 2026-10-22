# Setas na roda por padrão e nome do microfone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setas navegam nas notas da roda por padrão (sem precisar focar a roda), velocidade/sensibilidade passam para `-`/`+`/`=` e `,`/`.`, Espaço é sempre play/pausa, e a linha de status mostra o nome do microfone ativo ou "Mic desativado".

**Architecture:** O mapa puro (`resolveShortcut`) ganha as ações `nextNote`/`previousNote`/`firstNote` e as teclas novas. O `PitchMeter` vira `forwardRef` e expõe `navigate(direction)`, chamado pelo listener global do `ExercisePlayer`. O `usePitchTracker` passa a devolver `deviceName` (label da trilha de áudio).

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + Testing Library (jsdom 25).

**Spec:** `docs/superpowers/specs/2026-10-22-wheel-arrows-and-mic-name-design.md`

**Convenções do repo:**
- Rodar comandos de dentro de `frontend/` (`npm test`, `npx tsc -b`).
- Commits com a identidade configurada no git, **sem** trailer `Co-Authored-By`.
- Textos de UI em português; código e comentários em inglês.

---

### Task 1: Novo mapa de teclas

**Files:**
- Modify: `frontend/src/lib/keyboardShortcuts.ts`
- Test: `frontend/src/lib/keyboardShortcuts.test.ts`

- [ ] **Step 1: Update the tests first**

In `frontend/src/lib/keyboardShortcuts.test.ts`:

1. Replace the `it.each([...])('maps %j to %s', ...)` table with:

```ts
  it.each([
    [' ', 'togglePlay'],
    ['s', 'toggleMute'],
    ['m', 'toggleMic'],
    ['r', 'toggleLoop'],
    ['ArrowRight', 'nextNote'],
    ['ArrowDown', 'nextNote'],
    ['ArrowLeft', 'previousNote'],
    ['ArrowUp', 'previousNote'],
    ['Home', 'firstNote'],
    ['-', 'slower'],
    ['+', 'faster'],
    ['=', 'faster'],
    [',', 'lessSensitive'],
    ['.', 'moreSensitive'],
    ['PageUp', 'previousExercise'],
    ['[', 'previousExercise'],
    ['PageDown', 'nextExercise'],
    [']', 'nextExercise'],
    ['?', 'showHelp'],
  ])('maps %j to %s', (key, action) => {
    expect(resolveShortcut(keyEvent(key))).toBe(action);
  });
```

2. Replace the three focus tests about buttons / checkboxes / `role="button"` and the range-slider test with:

```ts
  it('lets a focused button or checkbox keep only Space', () => {
    for (const target of [document.createElement('button'), input('checkbox')]) {
      expect(resolveShortcut(keyEvent(' ', { target }))).toBeNull();
      expect(resolveShortcut(keyEvent('ArrowRight', { target }))).toBe('nextNote');
      expect(resolveShortcut(keyEvent('s', { target }))).toBe('toggleMute');
    }
  });

  it('sends Space, arrows and Home from a focused wheel bubble to the global shortcuts', () => {
    const bubble = document.createElement('div');
    bubble.setAttribute('role', 'button');
    expect(resolveShortcut(keyEvent(' ', { target: bubble }))).toBe('togglePlay');
    expect(resolveShortcut(keyEvent('ArrowLeft', { target: bubble }))).toBe('previousNote');
    expect(resolveShortcut(keyEvent('Home', { target: bubble }))).toBe('firstNote');
  });

  it('lets a focused range slider keep arrows, PageUp/PageDown, Home and End', () => {
    const slider = input('range');
    for (const key of ['ArrowUp', 'ArrowRight', 'PageDown', 'PageUp', 'Home', 'End']) {
      expect(resolveShortcut(keyEvent(key, { target: slider }))).toBeNull();
    }
    expect(resolveShortcut(keyEvent('+', { target: slider }))).toBe('faster');
    expect(resolveShortcut(keyEvent(' ', { target: slider }))).toBe('togglePlay');
  });
```

Keep the other existing tests (uppercase letters, unmapped keys, modifiers, select/textarea/text input own all keys, `stepWithin`, `SHORTCUT_HELP`).

- [ ] **Step 2: Run tests — expect failures**

Run: `cd frontend && npx vitest run src/lib/keyboardShortcuts.test.ts`
Expected: FAIL (new keys/actions unmapped, focus rules differ).

- [ ] **Step 3: Implement**

In `frontend/src/lib/keyboardShortcuts.ts`:

1. Add to the `ShortcutAction` union: `| 'nextNote' | 'previousNote' | 'firstNote'`.

2. Replace `ACTIONS_BY_KEY` with:

```ts
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
};
```

3. Replace `ARROW_KEYS` and `keysOwnedByFocus` with:

```ts
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
```

4. Replace `SHORTCUT_HELP` with:

```ts
export const SHORTCUT_HELP: { keys: string; description: string }[] = [
  { keys: 'Espaço', description: 'Tocar / pausar / reiniciar o exercício' },
  { keys: '← → ↑ ↓', description: 'Navegar entre as notas da roda' },
  { keys: 'Home', description: 'Voltar para o C' },
  { keys: 'Enter', description: 'Tocar a nota selecionada' },
  { keys: '- / +', description: 'Diminuir / aumentar a velocidade' },
  { keys: ', / .', description: 'Diminuir / aumentar a sensibilidade do microfone' },
  { keys: 'S', description: 'Silenciar / ativar o som da referência' },
  { keys: 'M', description: 'Ligar / desligar o microfone' },
  { keys: 'R', description: 'Repetir o exercício' },
  { keys: 'PageUp ou [', description: 'Exercício anterior' },
  { keys: 'PageDown ou ]', description: 'Próximo exercício' },
  { keys: '?', description: 'Mostrar estes atalhos' },
];
```

- [ ] **Step 4: Run the lib tests — expect PASS**

Run: `cd frontend && npx vitest run src/lib/keyboardShortcuts.test.ts`
Expected: PASS. (`ExercisePlayer` tests that press arrows for speed/sensitivity will fail until Task 4 — that's expected; do not run the full suite as a gate here.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/keyboardShortcuts.ts frontend/src/lib/keyboardShortcuts.test.ts
git commit -m "feat: map arrows to wheel navigation and move speed/sensitivity to - + , ."
```

---

### Task 2: `PitchMeter.navigate` controlado de fora

**Files:**
- Modify: `frontend/src/components/PitchMeter.tsx`
- Test: `frontend/src/components/PitchMeter.test.tsx`

- [ ] **Step 1: Replace the keyboard tests**

In `frontend/src/components/PitchMeter.test.tsx`, keep `'exposes a single tab stop on the wheel, starting at C'` and the Enter test (`'calls onNoteClick when a bubble is activated via keyboard (Enter)'`). Delete `'moves focus around the wheel with the arrow keys, wrapping B<->C'` and `'jumps back to C with Home'`, and add (import `createRef` from `react` and `type PitchMeterHandle` from `./PitchMeter`):

```tsx
  function renderWheel() {
    const wheel = createRef<PitchMeterHandle>();
    render(
      <PitchMeter
        ref={wheel}
        detectedNote={null}
        targetMidiNumber={null}
        micDisconnected={false}
        onNoteClick={() => {}}
      />
    );
    return wheel;
  }

  it('enters the wheel at the selected note on the first navigation, without advancing', () => {
    const wheel = renderWheel();
    act(() => wheel.current!.navigate('next'));
    expect(document.activeElement).toBe(screen.getByTestId('note-bubble-C'));
  });

  it('moves around the wheel from the focused note, wrapping B<->C', () => {
    const wheel = renderWheel();
    act(() => wheel.current!.navigate('next'));
    act(() => wheel.current!.navigate('next'));
    expect(document.activeElement).toBe(screen.getByTestId('note-bubble-C#'));

    act(() => wheel.current!.navigate('previous'));
    act(() => wheel.current!.navigate('previous'));
    expect(document.activeElement).toBe(screen.getByTestId('note-bubble-B'));
    expect(screen.getByTestId('note-bubble-B').getAttribute('tabindex')).toBe('0');
    expect(screen.getByTestId('note-bubble-C').getAttribute('tabindex')).toBe('-1');
  });

  it('re-enters at the last selected note after focus leaves the wheel', () => {
    const wheel = renderWheel();
    act(() => wheel.current!.navigate('next'));
    act(() => wheel.current!.navigate('next'));
    act(() => (document.activeElement as HTMLElement).blur());
    act(() => wheel.current!.navigate('previous'));
    expect(document.activeElement).toBe(screen.getByTestId('note-bubble-C#'));
  });

  it('goes to C with first, from inside or outside the wheel', () => {
    const wheel = renderWheel();
    act(() => wheel.current!.navigate('next'));
    act(() => wheel.current!.navigate('next'));
    act(() => wheel.current!.navigate('first'));
    expect(document.activeElement).toBe(screen.getByTestId('note-bubble-C'));
  });

  it('does not play the note on Space (Space is the global play/pause)', () => {
    const handleClick = vi.fn();
    render(
      <PitchMeter detectedNote={null} targetMidiNumber={null} micDisconnected={false} onNoteClick={handleClick} />
    );
    fireEvent.keyDown(screen.getByTestId('note-bubble-A'), { key: ' ' });
    expect(handleClick).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd frontend && npx vitest run src/components/PitchMeter.test.tsx`
Expected: FAIL (`ref`/`navigate` don't exist; Space still plays).

- [ ] **Step 3: Implement**

In `frontend/src/components/PitchMeter.tsx`:

1. Imports:

```ts
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react';
```

2. After `PitchMeterProps`, add:

```ts
export interface PitchMeterHandle {
  /**
   * Moves the keyboard selection around the wheel and focuses it. With focus outside the
   * wheel, 'next'/'previous' just enter it at the last selected note; 'first' always goes to C.
   */
  navigate(direction: 'next' | 'previous' | 'first'): void;
}
```

3. Turn the component into a `forwardRef` (keep the body):

```tsx
export const PitchMeter = forwardRef<PitchMeterHandle, PitchMeterProps>(function PitchMeter(
  { detectedNote, targetMidiNumber, micDisconnected, onNoteClick },
  ref
) {
  // ...existing body...
});
```

4. Replace the roving-tabindex block (the comment, `moveFocus` and `handleBubbleKeyDown`) with:

```ts
  // Roving tabindex: the wheel is one tab stop; the global arrow shortcuts move the
  // selection through `navigate`.
  const [focusableIndex, setFocusableIndex] = useState(0);
  const bubbleRefs = useRef<(SVGGElement | null)[]>([]);

  function moveFocus(index: number) {
    setFocusableIndex(index);
    bubbleRefs.current[index]?.focus();
  }

  useImperativeHandle(ref, () => ({
    navigate(direction) {
      if (direction === 'first') {
        moveFocus(0);
        return;
      }
      const focusedIndex = bubbleRefs.current.findIndex((bubble) => bubble !== null && bubble === document.activeElement);
      if (focusedIndex === -1) {
        moveFocus(focusableIndex);
        return;
      }
      const step = direction === 'next' ? 1 : NOTE_COUNT - 1;
      moveFocus((focusedIndex + step) % NOTE_COUNT);
    },
  }));

  function handleBubbleKeyDown(event: KeyboardEvent, index: number) {
    if (!onNoteClick || event.key !== 'Enter') return;
    event.preventDefault();
    onNoteClick(index);
  }
```

The `<g>` attributes (`ref`, `tabIndex`, `onFocus`, `onKeyDown`) stay as they are.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd frontend && npx vitest run src/components/PitchMeter.test.tsx && npx tsc -b`
Expected: PASS; `tsc` clean (existing `<PitchMeter ... />` usages without `ref` still typecheck).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PitchMeter.tsx frontend/src/components/PitchMeter.test.tsx
git commit -m "feat: let the wheel be navigated from outside through an imperative handle"
```

---

### Task 3: Nome do microfone no `usePitchTracker`

**Files:**
- Modify: `frontend/src/hooks/usePitchTracker.ts`
- Test: `frontend/src/hooks/usePitchTracker.test.ts`

- [ ] **Step 1: Update the test mock and add tests**

In `frontend/src/hooks/usePitchTracker.test.ts`:

1. Add `let trackLabel = 'USB Audio Device';` next to the other module-level `let`s, and reset it in `beforeEach` (`trackLabel = 'USB Audio Device';`).
2. Make the mocked stream expose audio tracks with a label:

```ts
    getUserMedia = vi.fn(async () => {
      const stop = vi.fn();
      stopSpies.push(stop);
      const track = { stop, label: trackLabel };
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    });
```

3. Add tests:

```ts
  it('reports the active microphone name while listening', async () => {
    const { result } = renderHook(() => usePitchTracker(0.15, true));
    await waitFor(() => expect(result.current.status).toBe('listening'));
    expect(result.current.deviceName).toBe('USB Audio Device');
  });

  it('reports no microphone name when the browser hides the label', async () => {
    trackLabel = '';
    const { result } = renderHook(() => usePitchTracker(0.15, true));
    await waitFor(() => expect(result.current.status).toBe('listening'));
    expect(result.current.deviceName).toBeNull();
  });

  it('clears the microphone name when turned off', async () => {
    const { result, rerender } = renderHook(({ enabled }) => usePitchTracker(0.15, enabled), {
      initialProps: { enabled: true },
    });
    await waitFor(() => expect(result.current.deviceName).toBe('USB Audio Device'));
    rerender({ enabled: false });
    expect(result.current.deviceName).toBeNull();
  });
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd frontend && npx vitest run src/hooks/usePitchTracker.test.ts`
Expected: FAIL (`deviceName` undefined).

- [ ] **Step 3: Implement**

In `frontend/src/hooks/usePitchTracker.ts`:

1. Add to `PitchTrackerState`:

```ts
  /** Label of the active microphone while listening; null when unknown, off or failed. */
  deviceName: string | null;
```

2. Add `deviceName: null` to every full state object: the `useState` initial value, the `'off'` reset, the `'requesting'` reset and the `'error'` state in the `catch`.
3. Replace `setState((prev) => ({ ...prev, status: 'listening' }));` with:

```ts
        const deviceName = stream.getAudioTracks()[0]?.label || null;
        setState((prev) => ({ ...prev, status: 'listening', deviceName }));
```

- [ ] **Step 4: Run tests and typecheck**

Run: `cd frontend && npx vitest run src/hooks/usePitchTracker.test.ts && npx tsc -b`
Expected: PASS, `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/usePitchTracker.ts frontend/src/hooks/usePitchTracker.test.ts
git commit -m "feat: expose the active microphone name from the pitch tracker"
```

---

### Task 4: Ligar tudo no `ExercisePlayer` + README

**Files:**
- Modify: `frontend/src/components/ExercisePlayer.tsx`
- Test: `frontend/src/components/ExercisePlayer.test.tsx`
- Modify: `README.md`

Context: in this test file `navigator.mediaDevices` is undefined by default (tracker goes to `'error'`). Defaults: speed `1.00x`, sensitivity `0.15`.

- [ ] **Step 1: Update the tests**

In the `ExercisePlayer keyboard shortcuts` describe of `frontend/src/components/ExercisePlayer.test.tsx`:

1. Replace `'steps the speed with the horizontal arrows and stops at the limit'` with:

```tsx
  it('steps the speed with - and + (or =) and stops at the limit', () => {
    renderPlayer();
    press('+');
    expect(screen.getByText('1.25x')).toBeDefined();
    for (let i = 0; i < 10; i++) press('=');
    expect(screen.getByText('2.00x')).toBeDefined();
    press('-');
    expect(screen.getByText('1.75x')).toBeDefined();
  });
```

2. Replace `'steps the mic sensitivity with the vertical arrows and stops at the limit'` with:

```tsx
  it('steps the mic sensitivity with , and . and stops at the limit', () => {
    renderPlayer();
    press('.');
    expect(screen.getByText('0.20')).toBeDefined();
    for (let i = 0; i < 10; i++) press(',');
    expect(screen.getByText('0.05')).toBeDefined();
  });
```

3. Replace `'leaves arrows to a focused slider'` with:

```tsx
  it('leaves arrows to a focused slider', () => {
    renderPlayer();
    const slider = screen.getByRole('slider', { name: /velocidade/i });
    slider.focus();
    press('ArrowRight', slider);
    expect(document.activeElement).toBe(slider);
  });
```

4. In `'keeps stepping on auto-repeat'`, change the key from `'ArrowRight'` to `'+'` (still expecting `1.25x`).
5. Replace the mic-toggle test's `'Microfone desligado'` expectations with `'Mic desativado'`.
6. Add:

```tsx
  it('navigates the wheel with the arrows from anywhere', () => {
    renderPlayer();
    press('ArrowRight');
    expect(document.activeElement).toBe(screen.getByTestId('note-bubble-C'));
    press('ArrowRight', document.activeElement!);
    press('ArrowDown', document.activeElement!);
    expect(document.activeElement).toBe(screen.getByTestId('note-bubble-D'));
    press('ArrowLeft', document.activeElement!);
    expect(document.activeElement).toBe(screen.getByTestId('note-bubble-C#'));
    press('Home', document.activeElement!);
    expect(document.activeElement).toBe(screen.getByTestId('note-bubble-C'));
  });

  it('keeps Space as play/pause while a wheel note is selected', () => {
    renderPlayer();
    press('ArrowRight');
    press(' ', document.activeElement!);
    expect(screen.getByRole('button', { name: 'Retomar' })).toBeDefined();
  });

  it('keeps navigating the wheel on auto-repeat', () => {
    renderPlayer();
    press('ArrowRight');
    press('ArrowRight', document.activeElement!, { repeat: true });
    expect(document.activeElement).toBe(screen.getByTestId('note-bubble-C#'));
  });

  it('shows the active microphone name', async () => {
    const track = { stop: vi.fn(), label: 'USB Audio Device' };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track], getAudioTracks: () => [track] })) },
      configurable: true,
    });
    renderPlayer();
    await act(async () => {});
    expect(screen.getByText('🎙️ USB Audio Device')).toBeDefined();
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
  });
```

7. The shared `MockAudioContext` at the top of the file needs the analyser API for the last test — add:

```ts
  sampleRate = 44100;

  createMediaStreamSource() {
    return { connect() {} };
  }

  createAnalyser() {
    return { fftSize: 0, getFloatTimeDomainData() {} };
  }
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd frontend && npx vitest run src/components/ExercisePlayer.test.tsx`
Expected: FAIL (navigation, new status texts).

- [ ] **Step 3: Implement**

In `frontend/src/components/ExercisePlayer.tsx`:

1. Import the handle type: `import { PitchMeter, type PitchMeterHandle } from './PitchMeter';`
2. `REPEATABLE_ACTIONS`:

```ts
const REPEATABLE_ACTIONS: ShortcutAction[] = [
  'nextNote',
  'previousNote',
  'slower',
  'faster',
  'lessSensitive',
  'moreSensitive',
];
```

and update its comment to: `// Only navigation and stepping make sense while a key is held; toggles would flicker.`
3. Inside the component (near the other refs): `const wheelRef = useRef<PitchMeterHandle>(null);`
4. In the shortcut `switch`, add:

```ts
        case 'nextNote':
          wheelRef.current?.navigate('next');
          break;
        case 'previousNote':
          wheelRef.current?.navigate('previous');
          break;
        case 'firstNote':
          wheelRef.current?.navigate('first');
          break;
```

5. Pass `ref={wheelRef}` to `<PitchMeter>`.
6. Replace the `'off'` status line with:

```tsx
        {pitchTracker.status === 'listening' && (
          <p className="status-message">🎙️ {pitchTracker.deviceName ?? 'Microfone ativo'}</p>
        )}
        {pitchTracker.status === 'off' && <p className="status-message">Mic desativado</p>}
```

- [ ] **Step 4: README** — in `README.md`, replace the "Controles pelo teclado" bullet with:

```markdown
- **Controles pelo teclado** — setas navegam entre as notas da roda (Enter toca a nota,
  Home volta ao C), Espaço toca/pausa o exercício, `-`/`+` mudam a velocidade, `,`/`.` a
  sensibilidade do microfone, S/M/R alternam som, microfone e repetição,
  PageUp/PageDown ou `[`/`]` trocam o exercício e `?` mostra a lista de atalhos.
- **Microfone visível** — a linha de status mostra o nome do microfone em uso (ou "Mic
  desativado"); o botão 🎙️ (ou M) libera o microfone de verdade.
```

- [ ] **Step 5: Full verification**

Run: `cd frontend && npm test && npx tsc -b && npm run build`
Expected: all suites PASS (no "not wrapped in act" warnings from the new tests), `tsc` clean, build OK.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ExercisePlayer.tsx frontend/src/components/ExercisePlayer.test.tsx README.md
git commit -m "feat: navigate the wheel with arrows by default and show the active microphone"
```
