# Várias entradas (faixas) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O usuário adiciona quantas entradas de áudio quiser; cada uma vira uma faixa com seletor de dispositivo, liga/desliga, roda, onda e pontuação própria (sessão/geral por faixa, um registro por faixa no fim da passada). A montagem fica salva.

**Architecture:** `inputLanes.ts` persiste `[{id, deviceId}]` (faixa `primary` migrada do mic salvo). `InputLane` encapsula um `usePitchTracker` + roda + onda + cabeçalho e amostra a pontuação, reportando ao `ExercisePlayer` (`onSample`). O player guarda contagens por faixa e grava um registro por faixa. `ScoreBoard`/`ScoreHistory` passam a ser por faixa.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + Testing Library (jsdom 25).

**Spec:** `docs/superpowers/specs/2026-10-22-multi-input-lanes-design.md`

**Convenções do repo:**
- Rodar comandos de dentro de `frontend/` (`npm test`, `npx tsc -b`).
- Commits com a identidade configurada no git, **sem** trailer `Co-Authored-By`.
- Textos de UI em português; código e comentários em inglês.

---

### Task 1: Bases — faixas salvas, histórico por faixa, tracker sem fallback

**Files:**
- Create: `frontend/src/lib/inputLanes.ts`, `frontend/src/lib/inputLanes.test.ts`
- Modify: `frontend/src/lib/scoreHistory.ts`, `frontend/src/lib/scoreHistory.test.ts`
- Modify: `frontend/src/hooks/usePitchTracker.ts`, `frontend/src/hooks/usePitchTracker.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/lib/inputLanes.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createLaneId, loadInputLanes, nextFreeDeviceId, PRIMARY_LANE_ID, saveInputLanes } from './inputLanes';

const LANES_KEY = 'singer-trainer:input-lanes';
const MIC_KEY = 'singer-trainer:mic-device-id';

describe('inputLanes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with a single primary lane using the saved microphone', () => {
    localStorage.setItem(MIC_KEY, 'usb');
    expect(loadInputLanes()).toEqual([{ id: PRIMARY_LANE_ID, deviceId: 'usb' }]);
  });

  it('starts with the system default when nothing is saved', () => {
    expect(loadInputLanes()).toEqual([{ id: PRIMARY_LANE_ID, deviceId: null }]);
  });

  it('round-trips the lanes and mirrors the primary device into the saved microphone', () => {
    const lanes = [
      { id: PRIMARY_LANE_ID, deviceId: 'usb' },
      { id: 'lane-2', deviceId: 'monitor' },
    ];
    saveInputLanes(lanes);
    expect(loadInputLanes()).toEqual(lanes);
    expect(localStorage.getItem(MIC_KEY)).toBe('usb');
  });

  it('falls back to a single primary lane when the stored value is invalid', () => {
    localStorage.setItem(LANES_KEY, '{bad');
    expect(loadInputLanes()).toEqual([{ id: PRIMARY_LANE_ID, deviceId: null }]);
    localStorage.setItem(LANES_KEY, JSON.stringify([{ id: 'lane-2', deviceId: 'x' }]));
    expect(loadInputLanes()).toEqual([{ id: PRIMARY_LANE_ID, deviceId: null }]);
  });

  it('picks the first device not used by any lane', () => {
    const lanes = [{ id: PRIMARY_LANE_ID, deviceId: 'usb' }];
    const available = [
      { deviceId: 'usb', label: 'USB' },
      { deviceId: 'monitor', label: 'Monitor' },
    ];
    expect(nextFreeDeviceId(lanes, available)).toBe('monitor');
    expect(nextFreeDeviceId([...lanes, { id: 'b', deviceId: 'monitor' }], available)).toBeNull();
  });

  it('creates distinct lane ids', () => {
    expect(createLaneId()).not.toBe(createLaneId());
    expect(createLaneId()).not.toBe(PRIMARY_LANE_ID);
  });
});
```

In `frontend/src/lib/scoreHistory.test.ts`:
1. Replace the import of `bestPercentByExercise` with `bestScores` and add `totalTallyForInput`.
2. Replace the `'finds the best percentage per exercise'` test with:

```ts
  it('finds the best percentage per exercise and input', () => {
    const history = [
      record({ exerciseId: 'a', exerciseName: 'A', targetSeconds: 10, hitSeconds: 5 }),
      record({ exerciseId: 'a', exerciseName: 'A', targetSeconds: 10, hitSeconds: 8 }),
      record({ exerciseId: 'a', exerciseName: 'A', inputId: 'lane-2', inputLabel: 'Monitor', targetSeconds: 4, hitSeconds: 1 }),
    ];
    expect(bestScores(history)).toEqual([
      { exerciseName: 'A', inputLabel: null, percent: 80 },
      { exerciseName: 'A', inputLabel: 'Monitor', percent: 25 },
    ]);
  });

  it('sums the records of one input, counting records without input as the primary lane', () => {
    const history = [
      record({ targetSeconds: 10, hitSeconds: 5 }),
      record({ inputId: 'primary', targetSeconds: 2, hitSeconds: 2 }),
      record({ inputId: 'lane-2', targetSeconds: 100, hitSeconds: 0 }),
    ];
    expect(totalTallyForInput(history, 'primary')).toEqual({ targetSeconds: 12, hitSeconds: 7 });
    expect(totalTallyForInput(history, 'lane-2')).toEqual({ targetSeconds: 100, hitSeconds: 0 });
  });

  it('accepts records with input fields and rejects invalid ones', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([record({ inputId: 'lane-2', inputLabel: 'Monitor' }), { ...record(), inputId: 3 }])
    );
    expect(loadScoreHistory()).toEqual([record({ inputId: 'lane-2', inputLabel: 'Monitor' })]);
  });
```

In `frontend/src/hooks/usePitchTracker.test.ts` add:

```ts
  it('reports a disconnected input instead of falling back when asked not to', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('gone'), { name: 'OverconstrainedError' }));
    const { result } = renderHook(() => usePitchTracker(0.15, true, 'unplugged', { fallbackToDefault: false }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toBe('Entrada desconectada');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd frontend && npx vitest run src/lib/inputLanes.test.ts src/lib/scoreHistory.test.ts src/hooks/usePitchTracker.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// frontend/src/lib/inputLanes.ts
import type { AudioInput } from '../hooks/useAudioInputs';
import { loadMicDeviceId, saveMicDeviceId } from './micPreference';

const STORAGE_KEY = 'singer-trainer:input-lanes';
export const PRIMARY_LANE_ID = 'primary';

/** One audio input shown as its own wheel; deviceId null means the system default. */
export interface InputLaneConfig {
  id: string;
  deviceId: string | null;
}

function isLane(value: unknown): value is InputLaneConfig {
  if (typeof value !== 'object' || value === null) return false;
  const lane = value as Record<string, unknown>;
  return typeof lane.id === 'string' && (typeof lane.deviceId === 'string' || lane.deviceId === null);
}

/** Stored lanes, always starting with the primary one; migrates from the single saved mic. */
export function loadInputLanes(): InputLaneConfig[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(parsed) && parsed.every(isLane) && parsed[0]?.id === PRIMARY_LANE_ID) {
      return parsed;
    }
  } catch {
    // Fall through to the default below.
  }
  return [{ id: PRIMARY_LANE_ID, deviceId: loadMicDeviceId() }];
}

export function saveInputLanes(lanes: InputLaneConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lanes));
  } catch {
    // Private browsing / quota exceeded — the layout just won't be remembered.
  }
  const primaryDeviceId = lanes[0]?.deviceId;
  if (primaryDeviceId) saveMicDeviceId(primaryDeviceId);
}

/** First available device not already used by a lane, or null when all are taken. */
export function nextFreeDeviceId(lanes: InputLaneConfig[], available: AudioInput[]): string | null {
  const used = new Set(lanes.map((lane) => lane.deviceId));
  return available.find((input) => !used.has(input.deviceId))?.deviceId ?? null;
}

export function createLaneId(): string {
  return `lane-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
```

In `frontend/src/lib/scoreHistory.ts`:
1. Add to `ScoreRecord`:

```ts
  /** Lane that produced the record; absent on records from before multiple inputs (= primary). */
  inputId?: string;
  inputLabel?: string;
```

2. In `isScoreRecord`, add to the conjunction:

```ts
    (entry.inputId === undefined || typeof entry.inputId === 'string') &&
    (entry.inputLabel === undefined || typeof entry.inputLabel === 'string')
```

3. Replace `bestPercentByExercise` with:

```ts
export interface BestScore {
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
        exerciseName: entry.exerciseName,
        inputLabel: inputId === PRIMARY_INPUT_ID ? null : (entry.inputLabel ?? null),
        percent,
      });
    }
  }
  return [...best.values()];
}

export function totalTallyForInput(history: ScoreRecord[], inputId: string): ScoreTally {
  return totalTally(history.filter((entry) => (entry.inputId ?? PRIMARY_INPUT_ID) === inputId));
}
```

with `const PRIMARY_INPUT_ID = 'primary';` near the top (same value as `PRIMARY_LANE_ID`; kept local to avoid a lib→lib cycle). `totalTally` must stay exported.

4. `ScoreHistory.tsx` imports `bestPercentByExercise` — update it in Task 3; to keep this task compiling, change `ScoreHistory.tsx`'s Recordes block now to use `bestScores(history)`:

```tsx
              {bestScores(history).map((score) => (
                <tr key={`${score.exerciseName}|${score.inputLabel ?? ''}`}>
                  <th scope="row">
                    {score.exerciseName}
                    {score.inputLabel ? ` · ${score.inputLabel}` : ''}
                  </th>
                  <td>{score.percent}%</td>
                </tr>
              ))}
```

and remove the now-unused `exerciseNames` map.

In `frontend/src/hooks/usePitchTracker.ts`:
1. Signature:

```ts
export function usePitchTracker(
  sensitivity: number = DEFAULT_THRESHOLD,
  enabled: boolean = true,
  deviceId: string | null = null,
  { fallbackToDefault = true }: { fallbackToDefault?: boolean } = {}
): PitchTrackerState {
```

(append to the doc comment: "With `fallbackToDefault: false`, a missing device is reported as the error 'Entrada desconectada' instead.")

2. In `openStream`'s fallback branch (where `OverconstrainedError`/`NotFoundError` is detected), when `!fallbackToDefault` throw `new Error('Entrada desconectada')` instead of retrying with `{ audio: true }`.
3. Add `fallbackToDefault` to the effect's dependency array.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd frontend && npx vitest run src/lib src/hooks src/components/ScoreHistory.test.tsx && npx tsc -b && npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib frontend/src/hooks frontend/src/components/ScoreHistory.tsx
git commit -m "feat: persist input lanes, score history per input and optional mic fallback"
```

---

### Task 2: Componente `InputLane`

**Files:**
- Create: `frontend/src/components/InputLane.tsx`, `frontend/src/components/InputLane.test.tsx`

Contract (the `ExercisePlayer` uses it in Task 4):

```ts
export interface InputLaneProps {
  lane: InputLaneConfig;
  /** 1-based position, used in labels of non-primary lanes ("Entrada 2"). */
  position: number;
  sensitivity: number;
  micEnabled: boolean;
  onToggleMic: () => void;
  targetMidiNumber: number | null;
  /** True while the exercise is playing (not paused, not ended). */
  scoringActive: boolean;
  audioInputs: AudioInput[];
  onRefreshInputs: () => void;
  onSelectDevice: (deviceId: string) => void;
  /** Absent on the primary lane, which can't be removed. */
  onRemove?: () => void;
  /** Called every 100ms while scoring is active, the mic is listening and there is a target. */
  onSample: (laneId: string, hit: boolean) => void;
  onNoteClick: (pitchClass: number) => void;
  /** Only the primary lane's wheel is driven by the keyboard. */
  wheelRef?: Ref<PitchMeterHandle>;
}
```

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/components/InputLane.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { InputLane, type InputLaneProps } from './InputLane';
import type { PitchTrackerState } from '../hooks/usePitchTracker';

const trackerCalls: unknown[][] = [];
const tracker: { state: PitchTrackerState } = {
  state: { status: 'listening', errorMessage: null, currentNote: null, waveform: [], deviceName: 'USB', deviceId: 'usb' },
};

vi.mock('../hooks/usePitchTracker', () => ({
  usePitchTracker: (...args: unknown[]) => {
    trackerCalls.push(args);
    return tracker.state;
  },
}));

const INPUTS = [
  { deviceId: 'usb', label: 'USB' },
  { deviceId: 'monitor', label: 'Monitor' },
];

function renderLane(overrides: Partial<InputLaneProps> = {}) {
  const props: InputLaneProps = {
    lane: { id: 'primary', deviceId: 'usb' },
    position: 1,
    sensitivity: 0.15,
    micEnabled: true,
    onToggleMic: vi.fn(),
    targetMidiNumber: 60,
    scoringActive: true,
    audioInputs: INPUTS,
    onRefreshInputs: vi.fn(),
    onSelectDevice: vi.fn(),
    onSample: vi.fn(),
    onNoteClick: vi.fn(),
    ...overrides,
  };
  render(<InputLane {...props} />);
  return props;
}

describe('InputLane', () => {
  beforeEach(() => {
    trackerCalls.length = 0;
    tracker.state = { ...tracker.state, status: 'listening', currentNote: null, errorMessage: null, deviceId: 'usb' };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens its own device, falling back to the default only on the primary lane', () => {
    renderLane();
    expect(trackerCalls.at(-1)).toEqual([0.15, true, 'usb', { fallbackToDefault: true }]);
    renderLane({ lane: { id: 'lane-2', deviceId: 'monitor' }, position: 2, onRemove: vi.fn() });
    expect(trackerCalls.at(-1)).toEqual([0.15, true, 'monitor', { fallbackToDefault: false }]);
  });

  it('labels the primary lane "Microfone" and others by position, with remove only on non-primary', () => {
    renderLane();
    expect(screen.getByRole('combobox', { name: 'Microfone' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /remover/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Desligar microfone' })).toBeDefined();
  });

  it('removes and toggles a non-primary lane through its own buttons', () => {
    const onRemove = vi.fn();
    const onToggleMic = vi.fn();
    renderLane({ lane: { id: 'lane-2', deviceId: 'monitor' }, position: 2, onRemove, onToggleMic });
    fireEvent.click(screen.getByRole('button', { name: 'Remover entrada 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Desligar entrada 2' }));
    expect(onRemove).toHaveBeenCalled();
    expect(onToggleMic).toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: 'Entrada 2' })).toBeDefined();
  });

  it('selects another device', () => {
    const props = renderLane();
    fireEvent.change(screen.getByRole('combobox', { name: 'Microfone' }), { target: { value: 'monitor' } });
    expect(props.onSelectDevice).toHaveBeenCalledWith('monitor');
  });

  it('samples hits every 100ms while active and listening with a target', () => {
    tracker.state = { ...tracker.state, currentNote: { noteName: 'C', octave: 3, midiNumber: 48, cents: 0 } };
    const props = renderLane();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(props.onSample).toHaveBeenCalledTimes(3);
    expect(props.onSample).toHaveBeenLastCalledWith('primary', true);
  });

  it('does not sample while inactive, without a target or without listening', () => {
    const inactive = renderLane({ scoringActive: false });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(inactive.onSample).not.toHaveBeenCalled();
  });

  it('shows "Entrada desconectada" when its device is missing', () => {
    tracker.state = { ...tracker.state, status: 'error', errorMessage: 'Entrada desconectada', deviceId: null };
    renderLane({ lane: { id: 'lane-2', deviceId: 'gone' }, position: 2, onRemove: vi.fn() });
    expect(screen.getByRole('alert').textContent).toContain('Entrada desconectada');
  });

  it('shows "Mic desativado" when off', () => {
    tracker.state = { ...tracker.state, status: 'off', deviceId: null };
    renderLane({ micEnabled: false });
    expect(screen.getByText('Mic desativado')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd frontend && npx vitest run src/components/InputLane.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```tsx
// frontend/src/components/InputLane.tsx
import { useEffect, useRef, type Ref } from 'react';
import { usePitchTracker } from '../hooks/usePitchTracker';
import type { AudioInput } from '../hooks/useAudioInputs';
import { PRIMARY_LANE_ID, type InputLaneConfig } from '../lib/inputLanes';
import { isHit } from '../lib/scoring';
import type { NoteInfo } from '../lib/noteUtils';
import { PitchMeter, type PitchMeterHandle } from './PitchMeter';
import { Waveform } from './Waveform';

export interface InputLaneProps {
  lane: InputLaneConfig;
  position: number;
  sensitivity: number;
  micEnabled: boolean;
  onToggleMic: () => void;
  targetMidiNumber: number | null;
  scoringActive: boolean;
  audioInputs: AudioInput[];
  onRefreshInputs: () => void;
  onSelectDevice: (deviceId: string) => void;
  onRemove?: () => void;
  onSample: (laneId: string, hit: boolean) => void;
  onNoteClick: (pitchClass: number) => void;
  wheelRef?: Ref<PitchMeterHandle>;
}

const SCORE_TICK_MS = 100;

/** One audio input: its own pitch tracker, wheel, waveform and device controls. */
export function InputLane({
  lane,
  position,
  sensitivity,
  micEnabled,
  onToggleMic,
  targetMidiNumber,
  scoringActive,
  audioInputs,
  onRefreshInputs,
  onSelectDevice,
  onRemove,
  onSample,
  onNoteClick,
  wheelRef,
}: InputLaneProps) {
  const isPrimary = lane.id === PRIMARY_LANE_ID;
  const tracker = usePitchTracker(sensitivity, micEnabled, lane.deviceId, { fallbackToDefault: isPrimary });
  const name = isPrimary ? 'Microfone' : `Entrada ${position}`;
  const detected = tracker.status === 'listening' ? tracker.currentNote : null;

  // Device labels only appear once permission is granted, so re-read them when this lane opens a device.
  useEffect(() => {
    if (tracker.deviceId) onRefreshInputs();
  }, [tracker.deviceId, onRefreshInputs]);

  // Sampled on its own tick from a ref so the interval isn't re-armed on every detection update.
  const scoringRef = useRef<{ active: boolean; target: number | null; detected: NoteInfo | null }>({
    active: false,
    target: null,
    detected: null,
  });
  const onSampleRef = useRef(onSample);
  useEffect(() => {
    scoringRef.current = {
      active: scoringActive && tracker.status === 'listening',
      target: targetMidiNumber,
      detected: tracker.currentNote,
    };
    onSampleRef.current = onSample;
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      const { active, target, detected: note } = scoringRef.current;
      if (!active || target === null) return;
      onSampleRef.current(lane.id, isHit(note, target));
    }, SCORE_TICK_MS);
    return () => clearInterval(intervalId);
  }, [lane.id]);

  return (
    <div className="input-lane">
      <div className="lane-header">
        <span aria-hidden="true">🎙️</span>
        {audioInputs.length > 0 && (
          <select
            className="mic-select"
            aria-label={name}
            value={tracker.deviceId ?? lane.deviceId ?? ''}
            onChange={(event) => onSelectDevice(event.target.value)}
          >
            {audioInputs.map((input) => (
              <option key={input.deviceId} value={input.deviceId}>
                {input.label}
              </option>
            ))}
          </select>
        )}
        {isPrimary && (
          <button type="button" className="icon-button" onClick={onRefreshInputs} aria-label="Atualizar lista de microfones">
            🔄
          </button>
        )}
        <button
          type="button"
          className={micEnabled ? 'icon-button' : 'icon-button is-off'}
          onClick={onToggleMic}
          aria-pressed={!micEnabled}
          aria-label={`${micEnabled ? 'Desligar' : 'Ligar'} ${name.toLowerCase()}`}
        >
          🎙️
        </button>
        {onRemove && (
          <button type="button" className="icon-button" onClick={onRemove} aria-label={`Remover entrada ${position}`}>
            ✕
          </button>
        )}
      </div>

      {tracker.status === 'requesting' && <p className="status-message">Pedindo acesso ao microfone…</p>}
      {tracker.status === 'error' && (
        <p className="status-message" role="alert">
          {tracker.errorMessage === 'Entrada desconectada'
            ? 'Entrada desconectada'
            : `Erro ao acessar o microfone: ${tracker.errorMessage}`}
        </p>
      )}
      {tracker.status === 'listening' && audioInputs.length === 0 && (
        <p className="status-message">🎙️ {tracker.deviceName ?? 'Microfone ativo'}</p>
      )}
      {tracker.status === 'off' && <p className="status-message">Mic desativado</p>}

      <div className="wheel-stage">
        <PitchMeter
          ref={wheelRef}
          detectedNote={detected}
          targetMidiNumber={targetMidiNumber}
          micDisconnected={tracker.status === 'error'}
          onNoteClick={onNoteClick}
        />
      </div>
      <div className="waveform-stage">
        <Waveform
          samples={tracker.waveform}
          detectedNote={detected}
          targetMidiNumber={targetMidiNumber}
          micDisconnected={tracker.status === 'error'}
        />
      </div>
    </div>
  );
}
```

Note: the primary lane's mic toggle label becomes "Desligar microfone"/"Ligar microfone" (same as before) because `name.toLowerCase()` of "Microfone" is "microfone"; non-primary: "Desligar entrada 2".

- [ ] **Step 4: Run tests and typecheck**

Run: `cd frontend && npx vitest run src/components/InputLane.test.tsx && npx tsc -b`
Expected: PASS, no act warnings.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/InputLane.tsx frontend/src/components/InputLane.test.tsx
git commit -m "feat: add an input lane component with its own tracker, wheel and controls"
```

---

### Task 3: Placar e histórico por faixa

**Files:**
- Modify: `frontend/src/components/ScoreBoard.tsx`, `frontend/src/components/ScoreBoard.test.tsx`
- Modify: `frontend/src/components/ScoreHistory.tsx`, `frontend/src/components/ScoreHistory.test.tsx`

- [ ] **Step 1: Update the tests**

Replace `frontend/src/components/ScoreBoard.test.tsx` with:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScoreBoard } from './ScoreBoard';

const ROWS = [
  {
    laneId: 'primary',
    label: 'USB Composite Device Mono',
    session: { targetSeconds: 60, hitSeconds: 48.2 },
    overall: { targetSeconds: 1000, hitSeconds: 725 },
  },
  {
    laneId: 'lane-2',
    label: 'Monitor of JBL',
    session: { targetSeconds: 10, hitSeconds: 1 },
    overall: { targetSeconds: 10, hitSeconds: 1 },
  },
];

describe('ScoreBoard', () => {
  it('shows one row per input with session and overall time in tune and percentage', () => {
    render(<ScoreBoard rows={ROWS} onOpenHistory={() => {}} />);
    const board = screen.getByRole('button', { name: 'Pontuação — abrir histórico' });
    expect(board.textContent).toContain('Sessão');
    expect(board.textContent).toContain('Geral');
    expect(board.textContent).toContain('USB Composite Device Mono');
    expect(screen.getByTestId('score-session-time-primary').textContent).toBe('48,2 s');
    expect(screen.getByTestId('score-session-percent-primary').textContent).toBe('80%');
    expect(screen.getByTestId('score-overall-time-primary').textContent).toBe('12 min 05 s');
    expect(screen.getByTestId('score-overall-percent-primary').textContent).toBe('73%');
    expect(screen.getByTestId('score-session-percent-lane-2').textContent).toBe('10%');
  });

  it('opens the history when clicked', () => {
    const onOpenHistory = vi.fn();
    render(<ScoreBoard rows={ROWS} onOpenHistory={onOpenHistory} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pontuação — abrir histórico' }));
    expect(onOpenHistory).toHaveBeenCalled();
  });
});
```

In `frontend/src/components/ScoreHistory.test.tsx`:
1. In `'lists the latest passes newest first...'`, add `inputLabel: 'Monitor', inputId: 'lane-2'` to the second record and assert `expect(rows[0].textContent).toContain('Monitor');` and that the header row contains "Entrada".
2. Replace the `'shows the best percentage per exercise'` test body's expectation so it still expects `'Escala Maior'` and `'80%'` (unchanged), and add:

```tsx
  it('lists records per input', () => {
    render(
      <ScoreHistory
        open
        onClose={() => {}}
        history={[record({ hitSeconds: 8 }), record({ inputId: 'lane-2', inputLabel: 'Monitor', hitSeconds: 2 })]}
      />
    );
    const records = screen.getByRole('table', { name: 'Recordes' });
    expect(records.textContent).toContain('Escala Maior · Monitor');
    expect(records.textContent).toContain('20%');
  });
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd frontend && npx vitest run src/components/ScoreBoard.test.tsx src/components/ScoreHistory.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Replace `frontend/src/components/ScoreBoard.tsx` with:

```tsx
import { formatSeconds, hitPercent, type ScoreTally } from '../lib/scoring';

export interface ScoreBoardRow {
  laneId: string;
  label: string;
  session: ScoreTally;
  overall: ScoreTally;
}

export interface ScoreBoardProps {
  rows: ScoreBoardRow[];
  onOpenHistory: () => void;
}

export function ScoreBoard({ rows, onOpenHistory }: ScoreBoardProps) {
  return (
    <button type="button" className="score-board" onClick={onOpenHistory} aria-label="Pontuação — abrir histórico">
      <span className="score-board-grid">
        <span />
        <span className="score-board-heading">Sessão</span>
        <span className="score-board-heading">Geral</span>
        {rows.map((row) => (
          <span key={row.laneId} className="score-board-row">
            <span className="score-board-label" title={row.label}>
              {row.label}
            </span>
            <span className="score-board-cell">
              <strong data-testid={`score-session-time-${row.laneId}`}>{formatSeconds(row.session.hitSeconds)}</strong>
              <strong data-testid={`score-session-percent-${row.laneId}`}>{hitPercent(row.session)}%</strong>
            </span>
            <span className="score-board-cell">
              <strong data-testid={`score-overall-time-${row.laneId}`}>{formatSeconds(row.overall.hitSeconds)}</strong>
              <strong data-testid={`score-overall-percent-${row.laneId}`}>{hitPercent(row.overall)}%</strong>
            </span>
          </span>
        ))}
      </span>
    </button>
  );
}
```

In `frontend/src/components/ScoreHistory.tsx` add the "Entrada" column to the latest-passes table: header `<th scope="col">Entrada</th>` after "Exercício", and cell `<td>{entry.inputLabel ?? 'Microfone'}</td>` after the exercise name cell.

CSS adjustments for the new markup are in Task 4.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd frontend && npx vitest run src/components/ScoreBoard.test.tsx src/components/ScoreHistory.test.tsx`
Expected: PASS. `npx tsc -b` will fail in `ExercisePlayer.tsx` (old ScoreBoard props) until Task 4 — expected; report it.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ScoreBoard.tsx frontend/src/components/ScoreBoard.test.tsx frontend/src/components/ScoreHistory.tsx frontend/src/components/ScoreHistory.test.tsx
git commit -m "feat: show scores per input in the score board and history"
```

---

### Task 4: Faixas no `ExercisePlayer` + estilo + README

**Files:**
- Modify: `frontend/src/components/ExercisePlayer.tsx`
- Modify: `frontend/src/components/ExercisePlayer.test.tsx`, `frontend/src/components/ExercisePlayer.scoring.test.tsx`
- Create: `frontend/src/components/ExercisePlayer.lanes.test.tsx`
- Modify: `frontend/src/index.css`, `README.md`

- [ ] **Step 1: Write the failing lanes test**

```tsx
// frontend/src/components/ExercisePlayer.lanes.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ExercisePlayer } from './ExercisePlayer';
import type { Exercise } from '../lib/exercises';
import type { PitchTrackerState } from '../hooks/usePitchTracker';

// Each lane's tracker state is keyed by the device it opens.
const trackers: Record<string, PitchTrackerState> = {};
const base: PitchTrackerState = {
  status: 'listening',
  errorMessage: null,
  currentNote: null,
  waveform: [],
  deviceName: null,
  deviceId: null,
};

vi.mock('../hooks/usePitchTracker', () => ({
  usePitchTracker: (_s: number, enabled: boolean, deviceId: string | null) =>
    enabled ? (trackers[deviceId ?? 'mic'] ?? { ...base, deviceId }) : { ...base, status: 'off' },
}));

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
    const node = { type: 'sine', frequency: { value: 0, setValueAtTime() {} }, start() {}, stop() {}, connect: (d: unknown) => d };
    return node;
  }
  createGain() {
    return { gain: { value: 0, setValueAtTime() {} }, connect: (d: unknown) => d };
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

async function flush() {
  await act(async () => {});
  await act(async () => {});
}

function renderPlayer() {
  return render(<ExercisePlayer exercise={EXERCISE} onPreviousExercise={() => {}} onNextExercise={() => {}} />);
}

describe('ExercisePlayer input lanes', () => {
  beforeEach(() => {
    localStorage.clear();
    mockClockMs = 0;
    for (const key of Object.keys(trackers)) delete trackers[key];
    trackers.mic = { ...base, deviceId: 'mic', currentNote: { noteName: 'C', octave: 4, midiNumber: 60, cents: 0 } };
    trackers.monitor = { ...base, deviceId: 'monitor' };
    localStorage.setItem('singer-trainer:mic-device-id', 'mic');
    vi.stubGlobal('AudioContext', MockAudioContext);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        enumerateDevices: vi.fn(async () => [
          { deviceId: 'mic', label: 'USB Mic', kind: 'audioinput' },
          { deviceId: 'monitor', label: 'Monitor of JBL', kind: 'audioinput' },
        ]),
        addEventListener() {},
        removeEventListener() {},
      },
      configurable: true,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('adds a lane on the next free device and remembers it', async () => {
    renderPlayer();
    await flush();
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar entrada' }));
    await flush();
    expect((screen.getByRole('combobox', { name: 'Entrada 2' }) as HTMLSelectElement).value).toBe('monitor');
    const saved = JSON.parse(localStorage.getItem('singer-trainer:input-lanes')!);
    expect(saved.map((lane: { deviceId: string }) => lane.deviceId)).toEqual(['mic', 'monitor']);
  });

  it('removes a lane', async () => {
    renderPlayer();
    await flush();
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar entrada' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Remover entrada 2' }));
    expect(screen.queryByRole('combobox', { name: 'Entrada 2' })).toBeNull();
    expect(JSON.parse(localStorage.getItem('singer-trainer:input-lanes')!)).toHaveLength(1);
  });

  it('scores each lane separately and records one entry per lane at the end of a pass', async () => {
    localStorage.setItem(
      'singer-trainer:input-lanes',
      JSON.stringify([
        { id: 'primary', deviceId: 'mic' },
        { id: 'lane-2', deviceId: 'monitor' },
      ])
    );
    renderPlayer();
    await flush();
    advance(1200);
    const history = JSON.parse(localStorage.getItem('singer-trainer:score-history')!);
    expect(history).toHaveLength(2);
    const byInput = Object.fromEntries(history.map((entry: { inputId: string }) => [entry.inputId, entry]));
    expect(byInput.primary.hitSeconds / byInput.primary.targetSeconds).toBeCloseTo(1);
    expect(byInput['lane-2'].hitSeconds).toBe(0);
    expect(byInput['lane-2'].inputLabel).toBe('Monitor of JBL');
    expect(screen.getByTestId('score-session-percent-primary').textContent).toBe('100%');
    expect(screen.getByTestId('score-session-percent-lane-2').textContent).toBe('0%');
  });

  it('toggles only the primary lane with M', async () => {
    localStorage.setItem(
      'singer-trainer:input-lanes',
      JSON.stringify([
        { id: 'primary', deviceId: 'mic' },
        { id: 'lane-2', deviceId: 'monitor' },
      ])
    );
    renderPlayer();
    await flush();
    fireEvent.keyDown(document.body, { key: 'm' });
    expect(screen.getByRole('button', { name: 'Ligar microfone' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Desligar entrada 2' })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `cd frontend && npx vitest run src/components/ExercisePlayer.lanes.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Refactor `ExercisePlayer.tsx`**

1. Imports: remove `usePitchTracker`, `loadMicDeviceId`/`saveMicDeviceId`, `PitchMeter` (keep `type PitchMeterHandle`), `Waveform`, `isHit`, `addSample` stays, `NoteInfo` (no longer used), `totalTally` → replace by `totalTallyForInput`. Add:

```ts
import { createLaneId, loadInputLanes, nextFreeDeviceId, PRIMARY_LANE_ID, saveInputLanes, type InputLaneConfig } from '../lib/inputLanes';
import { InputLane } from './InputLane';
import { type PitchMeterHandle } from './PitchMeter';
```

2. Remove `SCORE_TICK_MS` usage from the player (the lane samples) but keep a `const SAMPLE_SECONDS = 0.1;` (must match `InputLane`'s 100 ms tick; add a comment saying so).

3. Replace the mic/scoring state:

```ts
  const [lanes, setLanes] = useState<InputLaneConfig[]>(() => loadInputLanes());
  const [micOff, setMicOff] = useState<Record<string, boolean>>({});
  const [passTallies, setPassTallies] = useState<Record<string, ScoreTally>>({});
  const [sessionTallies, setSessionTallies] = useState<Record<string, ScoreTally>>({});
  const [history, setHistory] = useState(() => loadScoreHistory());
  const audioInputs = useAudioInputs(null);
```

(remove `micEnabled`, `passTally`, `sessionTally`, `historyTally`, `preferredMicId`, `pitchTracker`).

4. `useEffect(() => saveInputLanes(lanes), [lanes]);`

5. Lane helpers:

```ts
  function laneLabel(lane: InputLaneConfig, position: number): string {
    const device = audioInputs.inputs.find((input) => input.deviceId === lane.deviceId);
    return device?.label ?? (lane.id === PRIMARY_LANE_ID ? 'Microfone' : `Entrada ${position}`);
  }

  function addLane() {
    setLanes((current) => [...current, { id: createLaneId(), deviceId: nextFreeDeviceId(current, audioInputs.inputs) }]);
  }

  function removeLane(laneId: string) {
    setLanes((current) => current.filter((lane) => lane.id !== laneId));
  }

  function selectLaneDevice(laneId: string, deviceId: string) {
    setLanes((current) => current.map((lane) => (lane.id === laneId ? { ...lane, deviceId } : lane)));
  }

  function toggleLaneMic(laneId: string) {
    setMicOff((current) => ({ ...current, [laneId]: !current[laneId] }));
  }

  const handleSample = useCallback((laneId: string, hit: boolean) => {
    setPassTallies((current) => ({ ...current, [laneId]: addSample(current[laneId] ?? EMPTY_TALLY, SAMPLE_SECONDS, hit) }));
  }, []);
```

(add `useCallback` to the react import).

6. In the playback effect replace `setPassTally(EMPTY_TALLY);` with `setPassTallies({});`.

7. Delete the scoring `scoringRef` effect and the 100 ms scoring interval (moved to `InputLane`). Replace the `completePassRef` assignment with:

```ts
  useEffect(() => {
    completePassRef.current = () => {
      let latest = history;
      lanes.forEach((lane, index) => {
        const tally = passTallies[lane.id];
        if (!tally || tally.targetSeconds === 0) return;
        latest = appendScoreRecord({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          finishedAt: Date.now(),
          playbackRate,
          inputId: lane.id,
          inputLabel: laneLabel(lane, index + 1),
          ...tally,
        });
      });
      setHistory(latest);
      setSessionTallies((current) => {
        const next = { ...current };
        for (const [laneId, tally] of Object.entries(passTallies)) {
          next[laneId] = addTallies(next[laneId] ?? EMPTY_TALLY, tally);
        }
        return next;
      });
      setPassTallies({});
    };
  });
```

8. Keyboard: `case 'toggleMic': toggleLaneMic(PRIMARY_LANE_ID); break;`

9. Remove `selectMic`, `showMicPicker` and the whole mic/status block in `.exercise-info` (requesting/error/picker/listening/off lines) — those now live in each lane. Keep the `toneError` message.

10. Score board:

```tsx
      <ScoreBoard
        rows={lanes.map((lane, index) => {
          const pass = passTallies[lane.id] ?? EMPTY_TALLY;
          return {
            laneId: lane.id,
            label: laneLabel(lane, index + 1),
            session: addTallies(sessionTallies[lane.id] ?? EMPTY_TALLY, pass),
            overall: addTallies(totalTallyForInput(history, lane.id), pass),
          };
        })}
        onOpenHistory={() => setHistoryOpen(true)}
      />
```

11. Replace the `.exercise-stage` contents with:

```tsx
      <div className="exercise-stage">
        <div className={lanes.length > 1 ? 'lanes lanes-multiple' : 'lanes'}>
          {lanes.map((lane, index) => (
            <InputLane
              key={lane.id}
              lane={lane}
              position={index + 1}
              sensitivity={micSensitivity}
              micEnabled={!micOff[lane.id]}
              onToggleMic={() => toggleLaneMic(lane.id)}
              targetMidiNumber={targetNote?.midiNumber ?? null}
              scoringActive={playing && !ended}
              audioInputs={audioInputs.inputs}
              onRefreshInputs={audioInputs.refresh}
              onSelectDevice={(deviceId) => selectLaneDevice(lane.id, deviceId)}
              onRemove={lane.id === PRIMARY_LANE_ID ? undefined : () => removeLane(lane.id)}
              onSample={handleSample}
              onNoteClick={handleNoteClick}
              wheelRef={lane.id === PRIMARY_LANE_ID ? wheelRef : undefined}
            />
          ))}
        </div>
        <button type="button" className="add-lane" onClick={addLane}>
          + Adicionar entrada
        </button>
      </div>
```

12. Remove the 🎙️ toggle button from `.exercise-controls` (it's in the primary lane header now).

Note: `useAudioInputs`'s `refresh` is stable (`useCallback([])`), so passing it as `onRefreshInputs` doesn't re-trigger the lane's refresh effect.

- [ ] **Step 4: Update the existing player tests**

- `ExercisePlayer.scoring.test.tsx`: change the testids to the `-primary` suffix (`score-session-percent-primary`, `score-overall-percent-primary`, `score-session-time-primary`). The mock `usePitchTracker` signature now receives 4 args; keep returning `tracker.state`. The tracker is used by `InputLane` now — keep the same mock path (`../hooks/usePitchTracker`), which `InputLane` imports.
- `ExercisePlayer.test.tsx`: the mic toggle button is now in the lane header with the same labels; the picker tests ('Microfone' combobox, refresh button) keep working. Adjust only what fails for structural reasons and explain each change in the report. The "Mic desativado" / "Pedindo acesso…" texts now come from the lane.

- [ ] **Step 5: CSS** — in `frontend/src/index.css` (before the `@media (min-width: 900px)` block):

```css
.lanes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
  width: 100%;
}

.input-lane {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.lanes-multiple .input-lane {
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-bg-elevated) 50%, transparent);
}

.lane-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 100%;
  margin-bottom: 1rem;
}

.add-lane {
  margin-top: 0.5rem;
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.45rem 1.1rem;
  border-radius: 999px;
  border: 1px dashed var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.add-lane:hover,
.add-lane:focus-visible {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.score-board-row {
  display: contents;
}

.score-board-label {
  max-width: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-board-cell {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
```

Remove the `.mic-picker` rule if it becomes unused (keep `.mic-select`). Check that `.wheel-stage` (`width: min(100%, 360px)`) still sizes well inside a lane; with several lanes, the grid min width keeps each wheel ≥ 260 px.

- [ ] **Step 6: README** — replace the "Seletor de microfone" bullet with:

```markdown
- **Várias entradas** — cada entrada de áudio vira uma faixa com a própria roda, onda e
  pontuação: adicione o seu microfone, o "Monitor of …" do sistema (para captar a voz de
  um vídeo tocando em outra aba) ou outro mic, com "+ Adicionar entrada". Cada faixa tem
  seletor de dispositivo e liga/desliga; a montagem fica salva, e uma entrada
  desconectada aparece como tal até voltar.
```

Update the Arquitetura flowchart: rename the `Mic` node to `Mic["Entradas de áudio<br/>getUserMedia / enumerateDevices"]` and `Tracker` to `Tracker["usePitchTracker por faixa<br/>YIN no navegador"]`. Validate Mermaid with `~/.local/bin/mmdc` (`-p` puppeteer config if needed; temp files in the session scratchpad).

- [ ] **Step 7: Full verification**

Run: `cd frontend && npm test && npx tsc -b && npm run build`
Expected: all PASS, no act warnings.

- [ ] **Step 8: Visual check** — Vite on port 5179, Playwright MCP at 1366×768 and 680×890 (screenshots under `.playwright-mcp/`): one lane looks like before; after "+ Adicionar entrada", two lane cards side by side (wide) / stacked (narrow), score board with two rows. Stop the server by PID.

- [ ] **Step 9: Commit**

```bash
git add frontend/src README.md
git commit -m "feat: let each audio input have its own wheel, controls and score"
```

---

### Task 5: Velocidade ao lado do seletor de exercício

Pedido do Marcelo: a velocidade fica perto do seletor de exercício (continua disponível
também no exercício livre).

Approach (no state lifting): `App` passes its `<select>` to the player as a prop, and the
player renders a toolbar with the select and the speed slider at the top of the panel.

**Files:**
- Modify: `frontend/src/App.tsx`, `frontend/src/components/ExercisePlayer.tsx`
- Modify: `frontend/src/components/ExercisePlayer.test.tsx` (helper `renderPlayer` gets the new prop)
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Failing test** — in `frontend/src/App.test.tsx` add:

```tsx
  it('shows the speed control next to the exercise selector', () => {
    render(<App />);
    const toolbar = screen.getByRole('toolbar', { name: 'Exercício e velocidade' });
    expect(within(toolbar).getByLabelText('Exercício')).toBeDefined();
    expect(within(toolbar).getByRole('slider', { name: /velocidade/i })).toBeDefined();
  });
```

(import `within`). Run it: FAIL.

- [ ] **Step 2: Implement**

`ExercisePlayer.tsx`:
1. Props: add `exerciseSelect: ReactNode;` (import `type ReactNode` from react) and destructure it.
2. As the first element after `<ScoreBoard … />` inside the section, render:

```tsx
      <div className="exercise-toolbar" role="toolbar" aria-label="Exercício e velocidade">
        {exerciseSelect}
        <label className="speed-control">
          Velocidade
          <input
            type="range"
            min={MIN_PLAYBACK_RATE}
            max={MAX_PLAYBACK_RATE}
            step={PLAYBACK_RATE_STEP}
            value={playbackRate}
            onChange={(event) => setPlaybackRate(Number(event.target.value))}
          />
          <span className="speed-value">{playbackRate.toFixed(2)}x</span>
        </label>
      </div>
```

3. Remove the speed `<label>` from `.exercise-controls`.

`App.tsx`: move the `<select … />` JSX into a `const exerciseSelect = (<select …>…</select>);` and pass `exerciseSelect={exerciseSelect}` to `<ExercisePlayer>`; remove the standalone select from `App`'s JSX.

Tests: every `render(<ExercisePlayer … />)` helper in the `ExercisePlayer*.test.tsx` files passes `exerciseSelect={null}`.

- [ ] **Step 3: CSS** — in `frontend/src/index.css`:
1. Change `.exercise-select` from `display: block; margin: 0 auto 2.5rem;` to `margin: 0;` (it now sits inside the toolbar), and remove the `.exercise-select { margin-bottom: … }` override inside the `@media (min-width: 900px)` block.
2. Add:

```css
.exercise-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  width: 100%;
  margin-bottom: 2rem;
}
```

3. In the `@media (min-width: 900px)` block, put the toolbar on its own row across both columns: change `.exercise-panel`'s `grid-template-areas` to

```css
    grid-template-areas:
      'toolbar toolbar'
      'info stage'
      'controls stage';
    grid-template-rows: auto auto 1fr;
```

and add `.exercise-toolbar { grid-area: toolbar; margin-bottom: 1.5rem; }`.

- [ ] **Step 4: Verify** — `cd frontend && npm test && npx tsc -b && npm run build`; quick Playwright screenshot at 1366×768 and 680×890 (toolbar centered under the header, select + speed on one line on wide).

- [ ] **Step 5: Commit**

```bash
git add frontend/src README.md
git commit -m "feat: move the speed control next to the exercise selector"
```
