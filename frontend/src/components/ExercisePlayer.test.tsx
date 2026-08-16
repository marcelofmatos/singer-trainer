// frontend/src/components/ExercisePlayer.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ExercisePlayer } from './ExercisePlayer';
import type { Exercise } from '../lib/exercises';

// Short so the tests only need a couple of poll ticks (100ms each) to reach the end.
const TEST_EXERCISE: Exercise = {
  id: 'test-exercise',
  name: 'Exercício de teste',
  category: 'escala',
  description: 'Um único som curto, só para testar o player.',
  notes: [{ midiNumber: 60, startTime: 0, duration: 0.2 }],
};

let mockClockMs = 0;

class MockAudioParam {
  value = 0;
  setValueAtTime() {}
}

class MockAudioNode {
  connect(destination: unknown) {
    return destination;
  }
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = new MockAudioParam();
  start() {}
  stop() {}
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockAudioContext {
  destination = {};
  private startedAtMs = mockClockMs;

  get currentTime() {
    return (mockClockMs - this.startedAtMs) / 1000;
  }

  createOscillator() {
    return new MockOscillatorNode();
  }

  createGain() {
    return new MockGainNode();
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
  mockClockMs += ms;
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('ExercisePlayer', () => {
  beforeEach(() => {
    mockClockMs = 0;
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('offers a restart affordance once the exercise ends without looping', () => {
    render(<ExercisePlayer exercise={TEST_EXERCISE} />);

    // Exercise duration is 0.2s; poll ticks every 100ms.
    advance(100);
    advance(100);

    expect(screen.getByRole('button', { name: /reiniciar/i })).toBeDefined();
  });

  it('restarts playback from the beginning when play is pressed after the exercise ends', () => {
    render(<ExercisePlayer exercise={TEST_EXERCISE} />);

    advance(100);
    advance(100);
    const restartButton = screen.getByRole('button', { name: /reiniciar/i });

    fireEvent.click(restartButton);
    expect(screen.getByRole('button', { name: /pausar/i })).toBeDefined();

    // A full replay should reach the end again, proving this isn't a one-off toggle.
    advance(100);
    advance(100);
    expect(screen.getByRole('button', { name: /reiniciar/i })).toBeDefined();
  });
});
