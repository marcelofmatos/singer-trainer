// frontend/src/components/ExercisePlayer.reference.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ExercisePlayer } from './ExercisePlayer';
import { AUDIO_INPUT_EXERCISE, type Exercise } from '../lib/exercises';
import type { NoteInfo } from '../lib/noteUtils';
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
  groupId: null,
};

vi.mock('../hooks/usePitchTracker', () => ({
  usePitchTracker: (_s: number, enabled: boolean, deviceId: string | null) =>
    enabled ? (trackers[deviceId ?? 'mic'] ?? { ...base, deviceId }) : { ...base, status: 'off' },
}));

const OTHER_EXERCISE: Exercise = {
  id: 'one-note',
  name: 'Uma nota',
  category: 'escala',
  description: 'Teste.',
  notes: [{ midiNumber: 60, startTime: 0, duration: 1 }],
};

const C4: NoteInfo = { noteName: 'C', octave: 4, midiNumber: 60, cents: 0 };
const C3: NoteInfo = { noteName: 'C', octave: 3, midiNumber: 48, cents: 3 };
const A4: NoteInfo = { noteName: 'A', octave: 4, midiNumber: 69, cents: 0 };

let audioContextsCreated = 0;
class MockAudioContext {
  destination = {};
  currentTime = 0;
  constructor() {
    audioContextsCreated += 1;
  }
  createOscillator() {
    return { type: 'sine', frequency: { value: 0, setValueAtTime() {} }, start() {}, stop() {}, connect: (d: unknown) => d };
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

function element(exercise: Exercise = AUDIO_INPUT_EXERCISE) {
  return <ExercisePlayer exercise={exercise} onPreviousExercise={() => {}} onNextExercise={() => {}} exerciseSelect={null} />;
}

function renderPlayer() {
  const view = render(element());
  // Tracker states are read on render, so changing one needs a re-render to reach the lanes.
  const setNote = (deviceId: string, note: NoteInfo | null) => {
    trackers[deviceId] = { ...trackers[deviceId], currentNote: note };
    view.rerender(element());
  };
  return { ...view, setNote };
}

// Fake timers also drive Date.now(), so the reference history ages with the scoring ticks.
function advance(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    act(() => {
      vi.advanceTimersByTime(100);
    });
  }
}

async function flush() {
  await act(async () => {});
  await act(async () => {});
}

function savedHistory() {
  return JSON.parse(localStorage.getItem('singer-trainer:score-history') ?? '[]');
}

function storeLanes(lanes: { id: string; deviceId: string }[]) {
  localStorage.setItem('singer-trainer:input-lanes', JSON.stringify(lanes));
}

describe('ExercisePlayer reference mode', () => {
  beforeEach(() => {
    localStorage.clear();
    audioContextsCreated = 0;
    for (const key of Object.keys(trackers)) delete trackers[key];
    trackers.mic = { ...base, deviceId: 'mic' };
    trackers.monitor = { ...base, deviceId: 'monitor' };
    storeLanes([
      { id: 'primary', deviceId: 'mic' },
      { id: 'lane-2', deviceId: 'monitor' },
    ]);
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
    vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('defaults the reference to the monitor lane, badges it and keeps it off the score board', async () => {
    const { container } = renderPlayer();
    await flush();
    expect((screen.getByRole('combobox', { name: 'Referência' }) as HTMLSelectElement).value).toBe('lane-2');
    const lanes = container.querySelectorAll('.input-lane');
    expect(lanes[0].querySelector('.lane-badge')).toBeNull();
    expect(lanes[1].querySelector('.lane-badge')?.textContent).toBe('Referência');
    expect(screen.getByTestId('score-session-percent-primary')).toBeDefined();
    expect(screen.queryByTestId('score-session-percent-lane-2')).toBeNull();
  });

  it('keeps the default reference when another input is added later', async () => {
    trackers.stereo = { ...base, deviceId: 'stereo' };
    storeLanes([
      { id: 'primary', deviceId: 'mic' },
      { id: 'lane-2', deviceId: 'stereo' },
    ]);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        enumerateDevices: vi.fn(async () => [
          { deviceId: 'mic', label: 'USB Mic', kind: 'audioinput' },
          { deviceId: 'stereo', label: 'Stereo Mix', kind: 'audioinput' },
          { deviceId: 'monitor', label: 'Monitor of JBL', kind: 'audioinput' },
        ]),
        addEventListener() {},
        removeEventListener() {},
      },
      configurable: true,
    });
    renderPlayer();
    await flush();
    expect((screen.getByRole('combobox', { name: 'Referência' }) as HTMLSelectElement).value).toBe('lane-2');
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar entrada' }));
    await flush();
    expect((screen.getByRole('combobox', { name: 'Referência' }) as HTMLSelectElement).value).toBe('lane-2');
    expect(localStorage.getItem('singer-trainer:reference-lane')).toBe('lane-2');
  });

  it('remembers the chosen reference lane', async () => {
    renderPlayer();
    await flush();
    fireEvent.change(screen.getByRole('combobox', { name: 'Referência' }), { target: { value: 'lane-2' } });
    expect(localStorage.getItem('singer-trainer:reference-lane')).toBe('lane-2');
  });

  it("targets the reference's current note on the other lanes", async () => {
    const { container, setNote } = renderPlayer();
    await flush();
    setNote('monitor', A4);
    const lanes = container.querySelectorAll('.input-lane');
    expect(lanes[0].querySelector('[data-testid="note-bubble-A"]')?.getAttribute('data-active')).toBe('true');
    expect(lanes[1].querySelector('[data-active="true"]')).toBeNull();
  });

  it("counts singing the reference's note 300 ms late, in another octave, as a hit", async () => {
    const { setNote } = renderPlayer();
    await flush();
    setNote('monitor', C4);
    advance(300);
    setNote('mic', C3);
    advance(700);
    setNote('monitor', null);
    advance(500);
    fireEvent.keyDown(document.body, { key: ' ' });
    const history = savedHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ exerciseId: 'entrada-de-audio', inputId: 'primary' });
    expect(history[0].targetSeconds).toBeCloseTo(1, 1);
    expect(history[0].hitSeconds / history[0].targetSeconds).toBeGreaterThanOrEqual(0.6);
  });

  it('still counts a hit within 500 ms after the reference moves on', async () => {
    const { setNote } = renderPlayer();
    await flush();
    setNote('monitor', C4);
    advance(1000);
    setNote('monitor', A4);
    setNote('mic', C4);
    advance(300);
    fireEvent.keyDown(document.body, { key: ' ' });
    const [entry] = savedHistory();
    // Ten silent ticks on C4, then three on A4 sung as the C4 that was just heard.
    expect(entry.targetSeconds).toBeCloseTo(1.3, 1);
    expect(entry.hitSeconds).toBeCloseTo(0.3, 1);
  });

  it('counts no time while the reference is silent', async () => {
    const { setNote } = renderPlayer();
    await flush();
    setNote('mic', C4);
    advance(1000);
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(savedHistory()).toEqual([]);
    expect(screen.getByTestId('score-session-time-primary').textContent).toBe('0,0 s');
  });

  it('records the running pass when switching exercise', async () => {
    const { setNote, rerender } = renderPlayer();
    await flush();
    setNote('monitor', C4);
    setNote('mic', C4);
    advance(500);
    rerender(element(OTHER_EXERCISE));
    const history = savedHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ exerciseId: 'entrada-de-audio', inputId: 'primary' });
  });

  it('records the running pass when the page is hidden', async () => {
    const { setNote } = renderPlayer();
    await flush();
    setNote('monitor', C4);
    setNote('mic', C4);
    advance(500);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(savedHistory()).toHaveLength(1);
    // The pass was consumed, so another trigger doesn't record it twice.
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(savedHistory()).toHaveLength(1);
  });

  it('records the running pass on pagehide', async () => {
    const { setNote } = renderPlayer();
    await flush();
    setNote('monitor', C4);
    setNote('mic', C4);
    advance(500);
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(savedHistory()).toHaveLength(1);
  });

  it('asks for another input and scores nothing with only the primary lane', async () => {
    storeLanes([{ id: 'primary', deviceId: 'mic' }]);
    const { setNote } = renderPlayer();
    await flush();
    expect(screen.getByText('Adicione uma entrada (ex.: Monitor of …) para usar como referência.')).toBeDefined();
    expect(screen.queryByRole('combobox', { name: 'Referência' })).toBeNull();
    setNote('mic', C4);
    advance(1000);
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(savedHistory()).toEqual([]);
  });

  it('has no reference tone: no AudioContext, no mute button, no loop toggle, but keeps the speed slider', async () => {
    renderPlayer();
    await flush();
    expect(audioContextsCreated).toBe(0);
    expect(screen.queryByRole('button', { name: 'Silenciar' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Repetir' })).toBeNull();
    expect(screen.getByRole('toolbar').querySelector('input[type="range"]')).not.toBeNull();
  });
});
