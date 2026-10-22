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

function renderPlayer(overrides: { onPreviousExercise?: () => void; onNextExercise?: () => void } = {}) {
  return render(
    <ExercisePlayer
      exercise={TEST_EXERCISE}
      onPreviousExercise={overrides.onPreviousExercise ?? (() => {})}
      onNextExercise={overrides.onNextExercise ?? (() => {})}
    />
  );
}

function press(key: string, target: Element = document.body, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(target, { key, ...init });
}

describe('ExercisePlayer', () => {
  beforeEach(() => {
    localStorage.clear();
    mockClockMs = 0;
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('offers a restart affordance once the exercise ends without looping', () => {
    renderPlayer();

    // Exercise duration is 0.2s; poll ticks every 100ms.
    advance(100);
    advance(100);

    expect(screen.getByRole('button', { name: /reiniciar/i })).toBeDefined();
  });

  it('restarts playback from the beginning when play is pressed after the exercise ends', () => {
    renderPlayer();

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

describe('ExercisePlayer keyboard shortcuts', () => {
  beforeEach(() => {
    localStorage.clear();
    mockClockMs = 0;
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('toggles playback with Space', () => {
    renderPlayer();
    press(' ');
    expect(screen.getByRole('button', { name: 'Retomar' })).toBeDefined();
    press(' ');
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeDefined();
  });

  it('toggles the reference sound with S', () => {
    renderPlayer();
    press('s');
    expect(screen.getByRole('button', { name: 'Ativar som' })).toBeDefined();
  });

  it('toggles loop with R', () => {
    renderPlayer();
    const loop = screen.getByRole('checkbox', { name: 'Repetir' }) as HTMLInputElement;
    expect(loop.checked).toBe(false);
    press('r');
    expect(loop.checked).toBe(true);
  });

  it('steps the speed with the horizontal arrows and stops at the limit', () => {
    renderPlayer();
    press('ArrowRight');
    expect(screen.getByText('1.25x')).toBeDefined();
    for (let i = 0; i < 10; i++) press('ArrowRight');
    expect(screen.getByText('2.00x')).toBeDefined();
    press('ArrowLeft');
    expect(screen.getByText('1.75x')).toBeDefined();
  });

  it('steps the mic sensitivity with the vertical arrows and stops at the limit', () => {
    renderPlayer();
    press('ArrowUp');
    expect(screen.getByText('0.20')).toBeDefined();
    for (let i = 0; i < 10; i++) press('ArrowDown');
    expect(screen.getByText('0.05')).toBeDefined();
  });

  it('leaves arrows to a focused slider', () => {
    renderPlayer();
    press('ArrowRight', screen.getByRole('slider', { name: /velocidade/i }));
    expect(screen.getByText('1.00x')).toBeDefined();
  });

  it('still honors letter shortcuts while a button has focus', () => {
    renderPlayer();
    press('s', screen.getByRole('button', { name: 'Pausar' }));
    expect(screen.getByRole('button', { name: 'Ativar som' })).toBeDefined();
  });

  it('ignores shortcuts with Ctrl held', () => {
    renderPlayer();
    press('s', document.body, { ctrlKey: true });
    expect(screen.getByRole('button', { name: 'Silenciar' })).toBeDefined();
  });

  it('turns the microphone off and on with M and with the mic button', () => {
    renderPlayer();
    press('m');
    expect(screen.getByRole('button', { name: 'Ligar microfone' })).toBeDefined();
    expect(screen.getByText('Microfone desligado')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Ligar microfone' }));
    expect(screen.getByRole('button', { name: 'Desligar microfone' })).toBeDefined();
    expect(screen.queryByText('Microfone desligado')).toBeNull();
  });

  it('asks for the previous/next exercise with PageUp/PageDown and [ ]', () => {
    const onPreviousExercise = vi.fn();
    const onNextExercise = vi.fn();
    renderPlayer({ onPreviousExercise, onNextExercise });
    press('PageDown');
    press(']');
    press('PageUp');
    press('[');
    expect(onNextExercise).toHaveBeenCalledTimes(2);
    expect(onPreviousExercise).toHaveBeenCalledTimes(2);
  });

  it('opens the help with ? and suspends shortcuts while it is open', () => {
    renderPlayer();
    press('?', document.body, { shiftKey: true });
    expect(screen.getByRole('dialog', { name: 'Atalhos de teclado' })).toBeDefined();

    press('s');
    expect(screen.getByRole('button', { name: 'Silenciar' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the help from the keyboard button', () => {
    renderPlayer();
    fireEvent.click(screen.getByRole('button', { name: 'Atalhos de teclado' }));
    expect(screen.getByRole('dialog', { name: 'Atalhos de teclado' })).toBeDefined();
  });
});
