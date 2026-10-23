// frontend/src/components/ExercisePlayer.latency.test.tsx
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

vi.mock('../audio/calibrationTone', () => ({
  playCalibrationSequence: (_context: AudioContext, now: () => number) =>
    [0, 500, 1000, 1500, 2000, 2500].map((offset) => now() + 100 + offset),
}));

// C4 for half a second, then E4 for half a second: ten 100 ms scoring ticks per pass.
const TWO_NOTES: Exercise = {
  id: 'two-notes',
  name: 'Duas notas',
  category: 'escala',
  description: 'Teste.',
  notes: [
    { midiNumber: 60, startTime: 0, duration: 0.5 },
    { midiNumber: 64, startTime: 0.5, duration: 0.5 },
  ],
};

const C4: NoteInfo = { noteName: 'C', octave: 4, midiNumber: 60, cents: 0 };
const E4: NoteInfo = { noteName: 'E', octave: 4, midiNumber: 64, cents: 0 };

let mockClockMs = 0;
class MockAudioContext {
  destination = {};
  private startedAtMs = mockClockMs;
  get currentTime() {
    return (mockClockMs - this.startedAtMs) / 1000;
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

function element(exercise: Exercise) {
  return <ExercisePlayer exercise={exercise} onPreviousExercise={() => {}} onNextExercise={() => {}} exerciseSelect={null} />;
}

function renderPlayer(exercise: Exercise) {
  const view = render(element(exercise));
  // Tracker states are read on render, so changing one needs a re-render to reach the lanes.
  const setNote = (deviceIds: string[], note: NoteInfo | null) => {
    for (const deviceId of deviceIds) trackers[deviceId] = { ...trackers[deviceId], currentNote: note };
    view.rerender(element(exercise));
  };
  return { ...view, setNote };
}

// The audio clock, Date.now() and every interval move together, 100 ms at a time.
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

function storeLanes(lanes: { id: string; deviceId: string; latencyMs?: number }[]) {
  localStorage.setItem('singer-trainer:input-lanes', JSON.stringify(lanes));
}

function savedHistory(): { inputId: string; hitSeconds: number; targetSeconds: number }[] {
  return JSON.parse(localStorage.getItem('singer-trainer:score-history') ?? '[]');
}

function ratioFor(inputId: string): number {
  const entry = savedHistory().find((record) => record.inputId === inputId)!;
  return entry.hitSeconds / entry.targetSeconds;
}

describe('ExercisePlayer input latency', () => {
  beforeEach(() => {
    localStorage.clear();
    mockClockMs = 0;
    for (const key of Object.keys(trackers)) delete trackers[key];
    trackers.mic = { ...base, deviceId: 'mic' };
    trackers.monitor = { ...base, deviceId: 'monitor' };
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('scores an input that hears the exercise 200 ms late against the note of its corrected time', async () => {
    // Both inputs hear the same voice, singing each note 200 ms after it starts.
    storeLanes([
      { id: 'primary', deviceId: 'mic', latencyMs: 200 },
      { id: 'lane-2', deviceId: 'monitor' },
    ]);
    const { setNote } = renderPlayer(TWO_NOTES);
    await flush();
    advance(200);
    setNote(['mic', 'monitor'], C4);
    advance(500);
    setNote(['mic', 'monitor'], E4);
    advance(300);
    expect(savedHistory()).toHaveLength(2);
    expect(ratioFor('primary')).toBeCloseTo(1);
    expect(ratioFor('lane-2')).toBeLessThan(0.7);
  });

  it("targets each input's wheel at the exercise note of its corrected time", async () => {
    storeLanes([
      { id: 'primary', deviceId: 'mic', latencyMs: 200 },
      { id: 'lane-2', deviceId: 'monitor' },
    ]);
    const { container } = renderPlayer(TWO_NOTES);
    await flush();
    advance(600);
    const lanes = container.querySelectorAll('.input-lane');
    expect(lanes[0].querySelector('[data-testid="note-bubble-C"]')?.getAttribute('data-active')).toBe('true');
    expect(lanes[1].querySelector('[data-testid="note-bubble-E"]')?.getAttribute('data-active')).toBe('true');
  });

  // The mic sings along with what the reference really played; the monitor hears it referenceLatency later.
  async function scoreAlignedSinger(referenceLatency: number) {
    storeLanes([
      { id: 'primary', deviceId: 'mic' },
      { id: 'lane-2', deviceId: 'monitor', latencyMs: referenceLatency },
    ]);
    const { setNote } = renderPlayer(AUDIO_INPUT_EXERCISE);
    await flush();
    setNote(['mic'], C4);
    advance(200);
    setNote(['monitor'], C4);
    advance(800);
    setNote(['mic'], E4);
    advance(200);
    setNote(['monitor'], E4);
    advance(800);
    setNote(['mic'], null);
    advance(200);
    setNote(['monitor'], null);
    advance(500);
    fireEvent.keyDown(document.body, { key: ' ' });
    return ratioFor('primary');
  }

  it("matches a mic against the reference at the reference's corrected time", async () => {
    expect(await scoreAlignedSinger(200)).toBeCloseTo(1);
  });

  it('without the reference latency, the same singer is marked wrong around each change', async () => {
    expect(await scoreAlignedSinger(0)).toBeLessThan(0.85);
  });

  it('saves the latency set in a lane', async () => {
    renderPlayer(TWO_NOTES);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Atraso da entrada' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Atraso' }), { target: { value: '300' } });
    expect(screen.getByRole('button', { name: 'Atraso da entrada' }).textContent).toBe('⏱ 300 ms');
    expect(JSON.parse(localStorage.getItem('singer-trainer:input-lanes')!)[0].latencyMs).toBe(300);
  });

  it('pauses the exercise when a calibration starts', async () => {
    renderPlayer(TWO_NOTES);
    await flush();
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Atraso da entrada' }));
    fireEvent.click(screen.getByRole('button', { name: 'Calibrar' }));
    expect(screen.getByRole('button', { name: 'Retomar' })).toBeDefined();
  });
});
