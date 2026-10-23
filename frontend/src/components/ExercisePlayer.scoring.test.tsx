import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ExercisePlayer } from './ExercisePlayer';
import type { Exercise } from '../lib/exercises';
import type { PitchTrackerState } from '../hooks/usePitchTracker';

const tracker: { state: PitchTrackerState } = {
  state: { status: 'listening', errorMessage: null, currentNote: null, waveform: [], deviceName: null, deviceId: null },
};

// InputLane calls usePitchTracker(sensitivity, enabled, deviceId, options); every lane gets the same state.
vi.mock('../hooks/usePitchTracker', () => ({
  usePitchTracker: (_sensitivity: number, _enabled: boolean, _deviceId: string | null, _options?: unknown) =>
    tracker.state,
}));

// One second-long C4, so a full pass is ten 100ms scoring ticks.
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
    const oscillator = {
      type: 'sine',
      frequency: { value: 0, setValueAtTime() {} },
      connect: (node: unknown) => node,
      start() {},
      stop() {},
    };
    return oscillator;
  }
  createGain() {
    return { gain: { value: 0, setValueAtTime() {} }, connect: (node: unknown) => node };
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

function renderPlayer() {
  return render(<ExercisePlayer exercise={EXERCISE} onPreviousExercise={() => {}} onNextExercise={() => {}} exerciseSelect={null} />);
}

function savedHistory() {
  return JSON.parse(localStorage.getItem('singer-trainer:score-history') ?? '[]');
}

describe('ExercisePlayer scoring', () => {
  beforeEach(() => {
    localStorage.clear();
    mockClockMs = 0;
    tracker.state = { ...tracker.state, status: 'listening', currentNote: null };
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('records a perfect pass when the target is sung in tune the whole time', () => {
    tracker.state = { ...tracker.state, currentNote: { noteName: 'C', octave: 3, midiNumber: 48, cents: 2 } };
    renderPlayer();
    advance(1200);
    const history = savedHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ exerciseId: 'one-note', exerciseName: 'Uma nota' });
    expect(history[0].hitSeconds / history[0].targetSeconds).toBeCloseTo(1);
    expect(screen.getByTestId('score-session-percent-primary').textContent).toBe('100%');
    expect(screen.getByTestId('score-overall-percent-primary').textContent).toBe('100%');
  });

  it('counts silence as a miss', () => {
    renderPlayer();
    advance(1200);
    expect(savedHistory()[0].hitSeconds).toBe(0);
    expect(screen.getByTestId('score-session-percent-primary').textContent).toBe('0%');
  });

  it('does not count time while paused', () => {
    tracker.state = { ...tracker.state, currentNote: { noteName: 'C', octave: 4, midiNumber: 60, cents: 0 } };
    renderPlayer();
    fireEvent.keyDown(document.body, { key: ' ' });
    advance(500);
    expect(screen.getByTestId('score-session-time-primary').textContent).toBe('0,0 s');
  });

  it('does not record passes while the microphone is not listening', () => {
    tracker.state = { ...tracker.state, status: 'off' };
    renderPlayer();
    advance(1200);
    expect(savedHistory()).toEqual([]);
  });

  it('adds the stored history to the overall score but not to the session', () => {
    localStorage.setItem(
      'singer-trainer:score-history',
      JSON.stringify([
        { exerciseId: 'x', exerciseName: 'X', finishedAt: 1, playbackRate: 1, targetSeconds: 10, hitSeconds: 0 },
      ])
    );
    tracker.state = { ...tracker.state, currentNote: { noteName: 'C', octave: 4, midiNumber: 60, cents: 0 } };
    renderPlayer();
    advance(1200);
    expect(screen.getByTestId('score-session-percent-primary').textContent).toBe('100%');
    expect(screen.getByTestId('score-overall-percent-primary').textContent).toBe('9%');
  });

  it('opens the score history with H and from the score board', () => {
    renderPlayer();
    fireEvent.keyDown(document.body, { key: 'h' });
    expect(screen.getByRole('dialog', { name: 'Histórico de pontuação' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pontuação — abrir histórico' }));
    expect(screen.getByRole('dialog', { name: 'Histórico de pontuação' })).toBeDefined();
  });
});
