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

  sampleRate = 44100;

  createMediaStreamSource() {
    return { connect() {} };
  }

  createAnalyser() {
    return { fftSize: 0, getFloatTimeDomainData() {} };
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

  it('steps the speed with - and + (or =) and stops at the limit', () => {
    renderPlayer();
    press('+');
    expect(screen.getByText('1.25x')).toBeDefined();
    for (let i = 0; i < 10; i++) press('=');
    expect(screen.getByText('2.00x')).toBeDefined();
    press('-');
    expect(screen.getByText('1.75x')).toBeDefined();
  });

  it('steps the mic sensitivity with , and . and stops at the limit', () => {
    renderPlayer();
    press('.');
    expect(screen.getByText('0.20')).toBeDefined();
    for (let i = 0; i < 10; i++) press(',');
    expect(screen.getByText('0.05')).toBeDefined();
  });

  it('leaves arrows to a focused slider', () => {
    renderPlayer();
    const slider = screen.getByRole('slider', { name: /velocidade/i });
    slider.focus();
    press('ArrowRight', slider);
    expect(document.activeElement).toBe(slider);
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
    expect(screen.getByText('Mic desativado')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Ligar microfone' }));
    expect(screen.getByRole('button', { name: 'Desligar microfone' })).toBeDefined();
    expect(screen.queryByText('Mic desativado')).toBeNull();
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

    press('s');
    expect(screen.getByRole('button', { name: 'Ativar som' })).toBeDefined();
  });

  it('ignores auto-repeat for toggle shortcuts', () => {
    renderPlayer();
    press(' ', document.body, { repeat: true });
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeDefined();
    press('m', document.body, { repeat: true });
    expect(screen.getByRole('button', { name: 'Desligar microfone' })).toBeDefined();
  });

  it('keeps stepping on auto-repeat', () => {
    renderPlayer();
    press('+', document.body, { repeat: true });
    expect(screen.getByText('1.25x')).toBeDefined();
  });

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
    const track = {
      stop: vi.fn(),
      label: 'USB Audio Device',
      getSettings: () => ({ deviceId: 'usb' }),
      addEventListener: vi.fn(),
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track], getAudioTracks: () => [track] })) },
      configurable: true,
    });
    try {
      renderPlayer();
      await act(async () => {});
      expect(screen.getByText('🎙️ USB Audio Device')).toBeDefined();
    } finally {
      Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    }
  });

  it('opens the help from the keyboard button', () => {
    renderPlayer();
    fireEvent.click(screen.getByRole('button', { name: 'Atalhos de teclado' }));
    expect(screen.getByRole('dialog', { name: 'Atalhos de teclado' })).toBeDefined();
  });
});

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

  it('keeps the picker mounted and focused while the microphone reopens', async () => {
    renderPlayer();
    await flush();
    const select = screen.getByRole('combobox', { name: 'Microfone' });
    select.focus();
    fireEvent.change(select, { target: { value: 'usb' } });
    expect(screen.getByRole('combobox', { name: 'Microfone' })).toBe(select);
    expect(document.activeElement).toBe(select);
    await flush();
    expect(screen.getByRole('combobox', { name: 'Microfone' })).toBe(select);
    expect(document.activeElement).toBe(select);
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
    await flush();
    expect(screen.queryByRole('combobox', { name: 'Microfone' })).toBeNull();
    expect(screen.getByText('Mic desativado')).toBeDefined();
  });
});
