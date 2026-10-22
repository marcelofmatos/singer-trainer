# Seletor de microfone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dropdown para escolher o microfone (lembrado entre sessões, lista atualizada no hot-plug e por um botão 🔄), com fallback para o padrão quando o mic salvo não está conectado.

**Architecture:** `micPreference` guarda o id escolhido; `useAudioInputs` lista os microfones (`enumerateDevices` + `devicechange` + `refresh`); `usePitchTracker` recebe o `deviceId`, abre com `exact`, cai no padrão se ele não existir, expõe o `deviceId` real e reabre quando a trilha termina; o `ExercisePlayer` mostra o dropdown no lugar da linha "🎙️ nome".

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + Testing Library (jsdom 25).

**Spec:** `docs/superpowers/specs/2026-10-22-mic-selector-design.md`

**Convenções do repo:**
- Rodar comandos de dentro de `frontend/` (`npm test`, `npx tsc -b`).
- Commits com a identidade configurada no git, **sem** trailer `Co-Authored-By`.
- Textos de UI em português; código e comentários em inglês.

---

### Task 1: Preferência do mic e lista de microfones

**Files:**
- Create: `frontend/src/lib/micPreference.ts`, `frontend/src/lib/micPreference.test.ts`
- Create: `frontend/src/hooks/useAudioInputs.ts`, `frontend/src/hooks/useAudioInputs.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/lib/micPreference.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { loadMicDeviceId, saveMicDeviceId } from './micPreference';

const STORAGE_KEY = 'singer-trainer:mic-device-id';

describe('micPreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored yet', () => {
    expect(loadMicDeviceId()).toBeNull();
  });

  it('round-trips a saved id through load', () => {
    saveMicDeviceId('usb-mic');
    expect(loadMicDeviceId()).toBe('usb-mic');
  });

  it('returns null when the stored value is an empty string', () => {
    localStorage.setItem(STORAGE_KEY, '');
    expect(loadMicDeviceId()).toBeNull();
  });

  it('does not throw when localStorage.getItem throws', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('unavailable');
    };
    expect(loadMicDeviceId()).toBeNull();
    Storage.prototype.getItem = original;
  });

  it('does not throw when localStorage.setItem throws', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota exceeded');
    };
    expect(() => saveMicDeviceId('usb-mic')).not.toThrow();
    Storage.prototype.setItem = original;
  });
});
```

```ts
// frontend/src/hooks/useAudioInputs.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAudioInputs } from './useAudioInputs';

let devices: Array<{ deviceId: string; label: string; kind: string }>;
let deviceChangeListener: (() => void) | null;
let enumerateDevices: ReturnType<typeof vi.fn>;

function stubMediaDevices() {
  enumerateDevices = vi.fn(async () => devices.map((device) => ({ ...device })));
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      enumerateDevices,
      addEventListener: (_type: string, listener: () => void) => {
        deviceChangeListener = listener;
      },
      removeEventListener: () => {
        deviceChangeListener = null;
      },
    },
    configurable: true,
  });
}

describe('useAudioInputs', () => {
  beforeEach(() => {
    devices = [
      { deviceId: 'default', label: 'Padrão', kind: 'audioinput' },
      { deviceId: 'speakers', label: 'Alto-falantes', kind: 'audiooutput' },
      { deviceId: 'usb', label: '', kind: 'audioinput' },
    ];
    deviceChangeListener = null;
    stubMediaDevices();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
  });

  it('lists only microphones, naming the unlabeled ones', async () => {
    const { result } = renderHook(() => useAudioInputs(null));
    await waitFor(() =>
      expect(result.current.inputs).toEqual([
        { deviceId: 'default', label: 'Padrão' },
        { deviceId: 'usb', label: 'Microfone 2' },
      ])
    );
  });

  it('re-reads the list when a device is plugged in', async () => {
    const { result } = renderHook(() => useAudioInputs(null));
    await waitFor(() => expect(result.current.inputs).toHaveLength(2));
    devices.push({ deviceId: 'headset', label: 'Headset', kind: 'audioinput' });
    await act(async () => deviceChangeListener!());
    expect(result.current.inputs.map((input) => input.label)).toContain('Headset');
  });

  it('re-reads the list when refreshKey changes', async () => {
    const { rerender } = renderHook(({ key }) => useAudioInputs(key), { initialProps: { key: 'a' } });
    await waitFor(() => expect(enumerateDevices).toHaveBeenCalledTimes(1));
    rerender({ key: 'b' });
    await waitFor(() => expect(enumerateDevices).toHaveBeenCalledTimes(2));
  });

  it('re-reads the list on demand', async () => {
    const { result } = renderHook(() => useAudioInputs(null));
    await waitFor(() => expect(result.current.inputs).toHaveLength(2));
    devices.push({ deviceId: 'headset', label: 'Headset', kind: 'audioinput' });
    await act(async () => result.current.refresh());
    expect(result.current.inputs).toHaveLength(3);
  });

  it('returns an empty list when the browser exposes no media devices', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    const { result } = renderHook(() => useAudioInputs(null));
    expect(result.current.inputs).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd frontend && npx vitest run src/lib/micPreference.test.ts src/hooks/useAudioInputs.test.ts`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement**

```ts
// frontend/src/lib/micPreference.ts
const STORAGE_KEY = 'singer-trainer:mic-device-id';

/** Reads the chosen microphone's deviceId from localStorage, or null if unset/invalid. */
export function loadMicDeviceId(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/** Writes the chosen microphone's deviceId to localStorage; silently no-ops if unavailable. */
export function saveMicDeviceId(deviceId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, deviceId);
  } catch {
    // Private browsing / quota exceeded — this is a nice-to-have, not critical.
  }
}
```

```ts
// frontend/src/hooks/useAudioInputs.ts
import { useCallback, useEffect, useState } from 'react';

export interface AudioInput {
  deviceId: string;
  label: string;
}

/**
 * Lists the microphones the system exposes. Re-reads them when `refreshKey` changes (labels
 * only appear once microphone permission is granted), on the browser's `devicechange` event
 * and on demand through `refresh`.
 */
export function useAudioInputs(refreshKey: unknown): { inputs: AudioInput[]; refresh: () => void } {
  const [inputs, setInputs] = useState<AudioInput[]>([]);

  const refresh = useCallback(async () => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return;
    const devices = await mediaDevices.enumerateDevices();
    setInputs(
      devices
        .filter((device) => device.kind === 'audioinput')
        .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Microfone ${index + 1}` }))
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return;
    mediaDevices.addEventListener('devicechange', refresh);
    return () => mediaDevices.removeEventListener('devicechange', refresh);
  }, [refresh]);

  return { inputs, refresh };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `cd frontend && npx vitest run src/lib/micPreference.test.ts src/hooks/useAudioInputs.test.ts && npx tsc -b`
Expected: PASS, `tsc` clean, no "not wrapped in act" warnings.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/micPreference.ts frontend/src/lib/micPreference.test.ts frontend/src/hooks/useAudioInputs.ts frontend/src/hooks/useAudioInputs.test.ts
git commit -m "feat: add microphone preference storage and audio input listing"
```

---

### Task 2: `usePitchTracker` abre o mic escolhido

**Files:**
- Modify: `frontend/src/hooks/usePitchTracker.ts`
- Test: `frontend/src/hooks/usePitchTracker.test.ts`

- [ ] **Step 1: Update the mock and write the failing tests**

In `frontend/src/hooks/usePitchTracker.test.ts`:

1. Add `let endedListeners: Array<() => void> = [];` next to the other module-level `let`s and reset it in `beforeEach`.
2. Replace the `getUserMedia` mock with one that records the requested device and exposes `getSettings`/`addEventListener`:

```ts
    getUserMedia = vi.fn(async (constraints: { audio: true | { deviceId: { exact: string } } }) => {
      const stop = vi.fn();
      stopSpies.push(stop);
      const deviceId = constraints.audio === true ? 'default' : constraints.audio.deviceId.exact;
      const track = {
        stop,
        label: trackLabel,
        getSettings: () => ({ deviceId }),
        addEventListener: (type: string, listener: () => void) => {
          if (type === 'ended') endedListeners.push(listener);
        },
      };
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    });
```

3. In `'opens the microphone and listens when enabled'`, also assert `expect(getUserMedia).toHaveBeenCalledWith({ audio: true });`.
4. Add:

```ts
  it('opens the requested microphone and reports the device in use', async () => {
    const { result } = renderHook(() => usePitchTracker(0.15, true, 'usb'));
    await waitFor(() => expect(result.current.status).toBe('listening'));
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { deviceId: { exact: 'usb' } } });
    expect(result.current.deviceId).toBe('usb');
  });

  it('falls back to the default microphone when the requested one is not connected', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('gone'), { name: 'OverconstrainedError' }));
    const { result } = renderHook(() => usePitchTracker(0.15, true, 'unplugged'));
    await waitFor(() => expect(result.current.status).toBe('listening'));
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: true });
    expect(result.current.deviceId).toBe('default');
  });

  it('reports other errors without falling back', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('busy'), { name: 'NotReadableError' }));
    const { result } = renderHook(() => usePitchTracker(0.15, true, 'usb'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(result.current.deviceId).toBeNull();
  });

  it('reopens the microphone when switching devices', async () => {
    const { result, rerender } = renderHook(({ id }) => usePitchTracker(0.15, true, id), {
      initialProps: { id: null as string | null },
    });
    await waitFor(() => expect(result.current.deviceId).toBe('default'));
    rerender({ id: 'usb' });
    await waitFor(() => expect(result.current.deviceId).toBe('usb'));
    expect(stopSpies[0]).toHaveBeenCalled();
  });

  it('reopens the microphone when its track ends (unplugged)', async () => {
    const { result } = renderHook(() => usePitchTracker(0.15, true));
    await waitFor(() => expect(result.current.status).toBe('listening'));
    act(() => endedListeners[0]());
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.status).toBe('listening'));
    expect(stopSpies[0]).toHaveBeenCalled();
  });
```

(import `act` from `@testing-library/react`.)

- [ ] **Step 2: Run tests — expect failures**

Run: `cd frontend && npx vitest run src/hooks/usePitchTracker.test.ts`
Expected: FAIL (third param ignored, no `deviceId` in state, no reopen).

- [ ] **Step 3: Implement**

In `frontend/src/hooks/usePitchTracker.ts`:

1. Add to `PitchTrackerState`:

```ts
  /** deviceId of the microphone actually in use while listening; null otherwise. */
  deviceId: string | null;
```

and add `deviceId: null` to every full state object (initial `useState`, `'off'`, `'requesting'`, `'error'`).

2. Signature and doc comment (append a paragraph to the existing comment):

```ts
 * `deviceId` picks the microphone; when it isn't connected the system default is used
 * instead. If the open track ends (e.g. the microphone is unplugged) it is reopened.
 */
export function usePitchTracker(
  sensitivity: number = DEFAULT_THRESHOLD,
  enabled: boolean = true,
  deviceId: string | null = null
): PitchTrackerState {
```

3. After the `sensitivityRef` effect:

```ts
  // Bumped when the open track ends, so the effect below reopens the microphone.
  const [reopenCount, setReopenCount] = useState(0);
```

4. Inside the mic effect, before `async function start()`:

```ts
    async function openStream(): Promise<MediaStream> {
      if (!deviceId) return navigator.mediaDevices.getUserMedia({ audio: true });
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
      } catch (err) {
        // The chosen microphone isn't connected — fall back to the system default.
        const name = (err as { name?: string } | null)?.name;
        if (name === 'OverconstrainedError' || name === 'NotFoundError') {
          return navigator.mediaDevices.getUserMedia({ audio: true });
        }
        throw err;
      }
    }
```

5. In `start()`, replace `stream = await navigator.mediaDevices.getUserMedia({ audio: true });` with `stream = await openStream();`, and replace the `deviceName`/`setState(... 'listening' ...)` lines with:

```ts
        const track = stream.getAudioTracks()[0];
        const deviceName = track?.label || null;
        const activeDeviceId = track?.getSettings?.().deviceId ?? null;
        track?.addEventListener('ended', () => {
          if (!cancelled) setReopenCount((count) => count + 1);
        });
        setState((prev) => ({ ...prev, status: 'listening', deviceName, deviceId: activeDeviceId }));
```

6. Change the effect's dependency array from `[enabled]` to `[enabled, deviceId, reopenCount]`.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd frontend && npx vitest run src/hooks/usePitchTracker.test.ts && npx tsc -b && npm test`
Expected: PASS everywhere (ExercisePlayer still passes: it calls the hook with two args).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/usePitchTracker.ts frontend/src/hooks/usePitchTracker.test.ts
git commit -m "feat: open the chosen microphone, fall back to the default and reopen on unplug"
```

---

### Task 3: Dropdown e botão 🔄 no `ExercisePlayer` + estilo + README

**Files:**
- Modify: `frontend/src/components/ExercisePlayer.tsx`, `frontend/src/components/ExercisePlayer.test.tsx`
- Modify: `frontend/src/index.css`, `README.md`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/components/ExercisePlayer.test.tsx` (the file already has `MockAudioContext` with `createMediaStreamSource`/`createAnalyser`, `renderPlayer` and `press`):

```tsx
describe('ExercisePlayer microphone picker', () => {
  let devices: Array<{ deviceId: string; label: string; kind: string }>;
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    mockClockMs = 0;
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.useFakeTimers();
    devices = [
      { deviceId: 'default', label: 'Padrão', kind: 'audioinput' },
      { deviceId: 'usb', label: 'USB Mic', kind: 'audioinput' },
    ];
    getUserMedia = vi.fn(async (constraints: { audio: true | { deviceId: { exact: string } } }) => {
      const deviceId = constraints.audio === true ? 'default' : constraints.audio.deviceId.exact;
      const track = {
        stop: vi.fn(),
        label: devices.find((device) => device.deviceId === deviceId)?.label ?? '',
        getSettings: () => ({ deviceId }),
        addEventListener: () => {},
      };
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia,
        enumerateDevices: vi.fn(async () => devices.map((device) => ({ ...device }))),
        addEventListener: () => {},
        removeEventListener: () => {},
      },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function flush() {
    await act(async () => {});
    await act(async () => {});
  }

  it('lists the microphones with the one in use selected', async () => {
    renderPlayer();
    await flush();
    const select = screen.getByRole('combobox', { name: 'Microfone' }) as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(['Padrão', 'USB Mic']);
    expect(select.value).toBe('default');
  });

  it('switches to the chosen microphone and remembers it', async () => {
    renderPlayer();
    await flush();
    fireEvent.change(screen.getByRole('combobox', { name: 'Microfone' }), { target: { value: 'usb' } });
    await flush();
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: { deviceId: { exact: 'usb' } } });
    expect(localStorage.getItem('singer-trainer:mic-device-id')).toBe('usb');
    expect((screen.getByRole('combobox', { name: 'Microfone' }) as HTMLSelectElement).value).toBe('usb');
  });

  it('opens the remembered microphone on start', async () => {
    localStorage.setItem('singer-trainer:mic-device-id', 'usb');
    renderPlayer();
    await flush();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { deviceId: { exact: 'usb' } } });
  });

  it('shows a newly enabled microphone after pressing the refresh button', async () => {
    renderPlayer();
    await flush();
    devices.push({ deviceId: 'headset', label: 'Headset', kind: 'audioinput' });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de microfones' }));
    await flush();
    expect(screen.getByRole('option', { name: 'Headset' })).toBeDefined();
  });

  it('replaces the picker with "Mic desativado" when the microphone is off', async () => {
    renderPlayer();
    await flush();
    press('m');
    expect(screen.queryByRole('combobox', { name: 'Microfone' })).toBeNull();
    expect(screen.getByText('Mic desativado')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd frontend && npx vitest run src/components/ExercisePlayer.test.tsx`
Expected: FAIL (no combobox "Microfone").

- [ ] **Step 3: Implement**

In `frontend/src/components/ExercisePlayer.tsx`:

1. Imports:

```ts
import { loadMicDeviceId, saveMicDeviceId } from '../lib/micPreference';
import { useAudioInputs } from '../hooks/useAudioInputs';
```

2. State and hooks (replace the existing `usePitchTracker(...)` line):

```ts
  const [preferredMicId, setPreferredMicId] = useState(() => loadMicDeviceId());
  const pitchTracker = usePitchTracker(micSensitivity, micEnabled, preferredMicId);
  const audioInputs = useAudioInputs(pitchTracker.deviceId);
```

3. Next to `handleNoteClick`:

```ts
  function selectMic(deviceId: string) {
    setPreferredMicId(deviceId);
    saveMicDeviceId(deviceId);
  }

  const showMicPicker =
    audioInputs.inputs.length > 0 && (pitchTracker.status === 'listening' || pitchTracker.status === 'error');
```

4. Replace the `pitchTracker.status === 'listening'` status line with:

```tsx
        {showMicPicker ? (
          <div className="mic-picker">
            <span aria-hidden="true">🎙️</span>
            <select
              className="mic-select"
              aria-label="Microfone"
              value={pitchTracker.deviceId ?? preferredMicId ?? ''}
              onChange={(event) => selectMic(event.target.value)}
            >
              {audioInputs.inputs.map((input) => (
                <option key={input.deviceId} value={input.deviceId}>
                  {input.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button"
              onClick={audioInputs.refresh}
              aria-label="Atualizar lista de microfones"
            >
              🔄
            </button>
          </div>
        ) : (
          pitchTracker.status === 'listening' && (
            <p className="status-message">🎙️ {pitchTracker.deviceName ?? 'Microfone ativo'}</p>
          )
        )}
```

5. CSS — in `frontend/src/index.css`, after the `.status-message[role='alert']` rule:

```css
.mic-picker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 100%;
  margin: 0 0 1rem;
}

.mic-select {
  min-width: 0;
  max-width: 320px;
  font-family: var(--font-body);
  font-size: 0.9rem;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-text);
  text-overflow: ellipsis;
  cursor: pointer;
}

.mic-select:hover {
  border-color: var(--color-accent);
}

.mic-select:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 4: README** — in `README.md`, replace the "Microfone visível" bullet with:

```markdown
- **Seletor de microfone** — dropdown com os microfones do sistema no lugar do nome do
  mic; a escolha fica salva, a lista se atualiza ao conectar/desconectar (ou no botão 🔄)
  e, se o mic escolhido sumir, o app volta para o padrão do sistema. Com o mic desligado
  (botão 🎙️ ou M) aparece "Mic desativado".
```

and in the Arquitetura flowchart change the Mic node label to `Mic["Microfone<br/>getUserMedia / enumerateDevices"]`. Validate the Mermaid blocks with `~/.local/bin/mmdc` (if "Could not find Chrome": `-p` with a puppeteer config pointing at `/usr/bin/google-chrome-stable` and `--no-sandbox`), writing temp files to the session scratchpad.

- [ ] **Step 5: Full verification**

Run: `cd frontend && npm test && npx tsc -b && npm run build`
Expected: all PASS, no act warnings.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ExercisePlayer.tsx frontend/src/components/ExercisePlayer.test.tsx frontend/src/index.css README.md
git commit -m "feat: add a microphone picker with a refresh button"
```
