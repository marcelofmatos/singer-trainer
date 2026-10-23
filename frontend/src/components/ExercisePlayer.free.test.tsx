// frontend/src/components/ExercisePlayer.free.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ExercisePlayer } from './ExercisePlayer';
import { FREE_EXERCISE, type Exercise } from '../lib/exercises';
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

const C4_IN_TUNE: NoteInfo = { noteName: 'C', octave: 4, midiNumber: 60, cents: 3 };
const C4_OUT_OF_TUNE: NoteInfo = { noteName: 'C', octave: 4, midiNumber: 60, cents: 30 };
const A3_IN_TUNE: NoteInfo = { noteName: 'A', octave: 3, midiNumber: 57, cents: -2 };

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

function element(exercise: Exercise = FREE_EXERCISE) {
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

describe('ExercisePlayer free mode', () => {
  beforeEach(() => {
    localStorage.clear();
    audioContextsCreated = 0;
    for (const key of Object.keys(trackers)) delete trackers[key];
    trackers.mic = { ...base, deviceId: 'mic' };
    trackers.other = { ...base, deviceId: 'other' };
    storeLanes([
      { id: 'primary', deviceId: 'mic' },
      { id: 'lane-2', deviceId: 'other' },
    ]);
    vi.stubGlobal('AudioContext', MockAudioContext);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        enumerateDevices: vi.fn(async () => [
          { deviceId: 'mic', label: 'USB Mic', kind: 'audioinput' },
          { deviceId: 'other', label: 'Headset Mic', kind: 'audioinput' },
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

  it('has no reference tone and no target: no AudioContext, no mute button, no loop toggle, keeps the speed slider', async () => {
    const { container } = renderPlayer();
    await flush();
    expect(audioContextsCreated).toBe(0);
    expect(screen.queryByRole('button', { name: 'Silenciar' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Repetir' })).toBeNull();
    expect(screen.getByRole('toolbar').querySelector('input[type="range"]')).not.toBeNull();
    expect(container.querySelector('[data-active="true"]')).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Referência' })).toBeNull();
  });

  it('records each singing lane on pause, timed only while a note is heard, with per-note tallies', async () => {
    const { setNote } = renderPlayer();
    await flush();
    advance(500); // silence counts nothing
    setNote('mic', C4_IN_TUNE);
    advance(1000);
    setNote('mic', null);
    advance(500);
    fireEvent.keyDown(document.body, { key: ' ' });
    const history = savedHistory();
    expect(history).toHaveLength(1);
    const [entry] = history;
    expect(entry).toMatchObject({ exerciseId: 'livre', exerciseName: 'Exercício livre', inputId: 'primary' });
    expect(entry.targetSeconds).toBeCloseTo(1, 1);
    expect(entry.hitSeconds / entry.targetSeconds).toBeCloseTo(1, 1);
    expect(entry.noteTallies).toHaveLength(12);
    expect(entry.noteTallies[0].targetSeconds).toBeCloseTo(1, 1);
    expect(entry.noteTallies[0].hitSeconds).toBeCloseTo(1, 1);
    expect(entry.noteTallies[9]).toEqual({ targetSeconds: 0, hitSeconds: 0 });
  });

  it('records one entry per lane, each with its own notes', async () => {
    const { setNote } = renderPlayer();
    await flush();
    setNote('mic', C4_IN_TUNE);
    setNote('other', A3_IN_TUNE);
    advance(500);
    fireEvent.keyDown(document.body, { key: ' ' });
    const history = savedHistory();
    expect(history.map((entry: { inputId: string }) => entry.inputId).sort()).toEqual(['lane-2', 'primary']);
    const other = history.find((entry: { inputId: string }) => entry.inputId === 'lane-2');
    expect(other.noteTallies[9].targetSeconds).toBeCloseTo(0.5, 1);
    expect(other.noteTallies[0].targetSeconds).toBe(0);
  });

  it('counts out-of-tune singing as target time but not as a hit', async () => {
    const { setNote } = renderPlayer();
    await flush();
    setNote('mic', C4_OUT_OF_TUNE);
    advance(1000);
    fireEvent.keyDown(document.body, { key: ' ' });
    const [entry] = savedHistory();
    expect(entry.targetSeconds).toBeCloseTo(1, 1);
    expect(entry.hitSeconds).toBe(0);
    expect(entry.noteTallies[0].hitSeconds).toBe(0);
  });

  it("shows the singing lane's per-note % live on its wheel", async () => {
    const { container, setNote } = renderPlayer();
    await flush();
    const lanes = container.querySelectorAll('.input-lane');
    expect(lanes[0].querySelector('[data-testid^="note-percent-"]')).toBeNull();
    setNote('mic', C4_IN_TUNE);
    advance(500);
    expect(lanes[0].querySelector('[data-testid="note-percent-C"]')?.textContent).toBe('100%');
    expect(lanes[0].querySelector('[data-testid="note-percent-A"]')).toBeNull();
    expect(lanes[1].querySelector('[data-testid^="note-percent-"]')).toBeNull();
    // Recording the stretch starts the live percentages over.
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(lanes[0].querySelector('[data-testid^="note-percent-"]')).toBeNull();
  });

  it('records the running stretch when switching exercise', async () => {
    const { setNote, rerender } = renderPlayer();
    await flush();
    setNote('mic', C4_IN_TUNE);
    advance(500);
    rerender(element(OTHER_EXERCISE));
    const history = savedHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ exerciseId: 'livre', inputId: 'primary' });
    expect(history[0].noteTallies[0].targetSeconds).toBeCloseTo(0.5, 1);
  });

  it('records the running stretch once when the page is hidden', async () => {
    const { setNote } = renderPlayer();
    await flush();
    setNote('mic', C4_IN_TUNE);
    advance(500);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(savedHistory()).toHaveLength(1);
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(savedHistory()).toHaveLength(1);
  });
});
