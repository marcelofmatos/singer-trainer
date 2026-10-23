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
  return render(<ExercisePlayer exercise={EXERCISE} onPreviousExercise={() => {}} onNextExercise={() => {}} exerciseSelect={null} />);
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

  it('skips the pseudo "default" device and the one the primary lane actually opened', async () => {
    localStorage.removeItem('singer-trainer:mic-device-id');
    // The primary lane is on the system default (deviceId null) and its tracker reports 'usb'.
    trackers.mic = { ...base, deviceId: 'usb' };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        enumerateDevices: vi.fn(async () => [
          { deviceId: 'default', label: 'Padrão', kind: 'audioinput' },
          { deviceId: 'usb', label: 'USB Mic', kind: 'audioinput' },
          { deviceId: 'monitor', label: 'Monitor of JBL', kind: 'audioinput' },
        ]),
        addEventListener() {},
        removeEventListener() {},
      },
      configurable: true,
    });
    renderPlayer();
    await flush();
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar entrada' }));
    await flush();
    expect((screen.getByRole('combobox', { name: 'Entrada 2' }) as HTMLSelectElement).value).toBe('monitor');
  });

  it('still adds a lane, asking for a device, when every device is taken', async () => {
    localStorage.setItem(
      'singer-trainer:input-lanes',
      JSON.stringify([
        { id: 'primary', deviceId: 'mic' },
        { id: 'lane-2', deviceId: 'monitor' },
      ])
    );
    renderPlayer();
    await flush();
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar entrada' }));
    await flush();
    const select = screen.getByRole('combobox', { name: 'Entrada 3' }) as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(select.selectedOptions[0].textContent).toBe('Escolha um dispositivo');
    expect(JSON.parse(localStorage.getItem('singer-trainer:input-lanes')!)[2].deviceId).toBeNull();
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
