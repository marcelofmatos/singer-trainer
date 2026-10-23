// frontend/src/components/InputLane.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { InputLane, type InputLaneProps } from './InputLane';
import type { PitchTrackerState } from '../hooks/usePitchTracker';

const trackerCalls: unknown[][] = [];
const tracker: { state: PitchTrackerState } = {
  state: {
    status: 'listening',
    errorMessage: null,
    currentNote: null,
    waveform: [],
    deviceName: 'USB',
    deviceId: 'usb',
    groupId: 'g-usb',
  },
};

const calibration = vi.hoisted(() => ({
  // Onsets relative to the moment the sequence is scheduled.
  offsets: [100, 600, 1100, 1600, 2100, 2600],
}));

vi.mock('../audio/calibrationTone', () => ({
  playCalibrationSequence: vi.fn((_context: AudioContext, now: () => number) =>
    calibration.offsets.map((offset) => now() + offset)
  ),
}));

const closeContext = vi.fn(() => Promise.resolve());
class MockAudioContext {
  close = closeContext;
}

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

function laneProps(overrides: Partial<InputLaneProps> = {}): InputLaneProps {
  return {
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
    onDeviceInUse: vi.fn(),
    onSample: vi.fn(),
    onNote: vi.fn(),
    isReference: false,
    onPlayNote: vi.fn(),
    visualization: 'wheel',
    ...overrides,
  };
}

function renderLane(overrides: Partial<InputLaneProps> = {}) {
  const props = laneProps(overrides);
  render(<InputLane {...props} />);
  return props;
}

describe('InputLane', () => {
  beforeEach(() => {
    trackerCalls.length = 0;
    tracker.state = {
      ...tracker.state,
      status: 'listening',
      currentNote: null,
      errorMessage: null,
      deviceId: 'usb',
      groupId: 'g-usb',
    };
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', MockAudioContext);
    closeContext.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('opens its own device, falling back to the default only on the primary lane', () => {
    renderLane();
    expect(trackerCalls[trackerCalls.length - 1]).toEqual([0.15, true, 'usb', { fallbackToDefault: true }]);
    renderLane({ lane: { id: 'lane-2', deviceId: 'monitor' }, position: 2, onRemove: vi.fn() });
    expect(trackerCalls[trackerCalls.length - 1]).toEqual([0.15, true, 'monitor', { fallbackToDefault: false }]);
  });

  it('labels the primary lane "Microfone" and others by position, with remove only on non-primary', () => {
    renderLane();
    expect(screen.getByRole('combobox', { name: 'Microfone' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /remover/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Desligar microfone' })).toBeDefined();
  });

  it('shows the mic icon only once in the header, on the mic toggle', () => {
    renderLane();
    const header = screen.getByRole('combobox', { name: 'Microfone' }).closest('.lane-header')!;
    expect(header.textContent!.match(/🎙️/g)).toHaveLength(1);
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
    expect(props.onSample).toHaveBeenLastCalledWith('primary', tracker.state.currentNote);
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

  it('shows a disabled "Entrada desconectada" option instead of another device when its device is missing', () => {
    tracker.state = { ...tracker.state, status: 'error', errorMessage: 'Entrada desconectada', deviceId: null };
    renderLane({ lane: { id: 'lane-2', deviceId: 'gone' }, position: 2, onRemove: vi.fn() });
    const select = screen.getByRole('combobox', { name: 'Entrada 2' }) as HTMLSelectElement;
    expect(select.value).toBe('gone');
    expect(select.selectedOptions[0].textContent).toBe('Entrada desconectada');
    expect(select.selectedOptions[0].disabled).toBe(true);
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      'Entrada desconectada',
      'USB',
      'Monitor',
    ]);
  });

  it('does not add the placeholder when the device is listed', () => {
    renderLane();
    const select = screen.getByRole('combobox', { name: 'Microfone' }) as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(['USB', 'Monitor']);
  });

  it('reports the device its tracker actually opened', () => {
    const props = renderLane({ lane: { id: 'primary', deviceId: null } });
    expect(props.onDeviceInUse).toHaveBeenLastCalledWith('primary', 'usb', 'g-usb');
  });

  it('asks for a device, without opening one, when a non-primary lane has none', () => {
    tracker.state = { ...tracker.state, status: 'off', deviceId: null };
    renderLane({ lane: { id: 'lane-2', deviceId: null }, position: 2, onRemove: vi.fn() });
    expect(trackerCalls[trackerCalls.length - 1]).toEqual([0.15, false, null, { fallbackToDefault: false }]);
    const select = screen.getByRole('combobox', { name: 'Entrada 2' }) as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(select.selectedOptions[0].textContent).toBe('Escolha um dispositivo');
    expect(select.selectedOptions[0].disabled).toBe(true);
    expect(screen.queryByText('Mic desativado')).toBeNull();
  });

  it('asks for a device in a status line when a lane has none and no inputs are listed', () => {
    tracker.state = { ...tracker.state, status: 'off', deviceId: null, groupId: null };
    renderLane({ lane: { id: 'lane-2', deviceId: null }, position: 2, onRemove: vi.fn(), audioInputs: [] });
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('Escolha um dispositivo')).toBeDefined();
  });

  it('shows "Mic desativado" when off', () => {
    tracker.state = { ...tracker.state, status: 'off', deviceId: null };
    renderLane({ micEnabled: false });
    expect(screen.getByText('Mic desativado')).toBeDefined();
  });

  it('keeps one status slot before the visualization whether or not a message shows', () => {
    const { container, unmount } = render(<InputLane {...laneProps()} />);
    const quietSlot = container.querySelector('.lane-status');
    expect(quietSlot).not.toBeNull();
    expect(quietSlot!.textContent).toBe('');
    expect(quietSlot!.nextElementSibling?.classList.contains('view-stage')).toBe(true);
    unmount();

    tracker.state = { ...tracker.state, status: 'error', errorMessage: 'Entrada desconectada', deviceId: null };
    const { container: errored } = render(<InputLane {...laneProps()} />);
    const errorSlot = errored.querySelector('.lane-status');
    expect(errorSlot).not.toBeNull();
    expect(errorSlot!.className).toBe(quietSlot!.className);
    expect(errorSlot!.textContent).toBe('Entrada desconectada');
    expect(errorSlot!.nextElementSibling?.classList.contains('view-stage')).toBe(true);
  });

  it('renders the chosen visualization', () => {
    renderLane({ visualization: 'tuner' });
    expect(screen.getByRole('img', { name: /Afinador/ })).toBeDefined();
  });

  it('plays wheel bubbles in the fourth octave', () => {
    const props = renderLane({ visualization: 'wheel' });
    fireEvent.click(screen.getByTestId('note-bubble-A'));
    expect(props.onPlayNote).toHaveBeenCalledWith(69);
  });

  it('shows a reference badge and never samples when it is the reference', () => {
    tracker.state = { ...tracker.state, currentNote: { noteName: 'C', octave: 3, midiNumber: 48, cents: 0 } };
    const props = renderLane({ isReference: true });
    expect(screen.getByText('Referência')).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(props.onSample).not.toHaveBeenCalled();
  });

  it('reports its current note, and null when it goes silent', () => {
    const note = { noteName: 'C', octave: 3, midiNumber: 48, cents: 0 };
    tracker.state = { ...tracker.state, currentNote: note };
    const props = laneProps();
    const { rerender } = render(<InputLane {...props} />);
    expect(props.onNote).toHaveBeenLastCalledWith('primary', note);
    tracker.state = { ...tracker.state, currentNote: null };
    rerender(<InputLane {...props} />);
    expect(props.onNote).toHaveBeenLastCalledWith('primary', null);
    expect(props.onNote).toHaveBeenCalledTimes(2);
  });

  it('samples without a target only when sampleWithoutTarget is set', () => {
    const without = renderLane({ targetMidiNumber: null });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(without.onSample).not.toHaveBeenCalled();
  });

  it('samples every 100 ms without a target when sampleWithoutTarget is set', () => {
    const props = renderLane({ targetMidiNumber: null, sampleWithoutTarget: true });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(props.onSample).toHaveBeenCalledTimes(3);
    expect(props.onSample).toHaveBeenCalledWith('primary', null);
  });

  it('forwards notePercents to the wheel', () => {
    const notePercents = Array<number | null>(12).fill(null);
    notePercents[9] = 80;
    renderLane({ notePercents });
    expect(screen.getByTestId('note-percent-A').textContent).toBe('80%');
  });

  describe('latency', () => {
    const CALIBRATION_MIDIS = [60, 67, 60, 67, 60, 67];

    function note(midiNumber: number) {
      const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      return { noteName: names[midiNumber % 12], octave: Math.floor(midiNumber / 12) - 1, midiNumber, cents: 0 };
    }

    it('shows the latency on the header button only when above zero', () => {
      const { unmount } = render(<InputLane {...laneProps()} />);
      expect(screen.getByRole('button', { name: 'Atraso da entrada' }).textContent).toBe('⏱');
      unmount();
      render(<InputLane {...laneProps({ latencyMs: 180 })} />);
      expect(screen.getByRole('button', { name: 'Atraso da entrada' }).textContent).toBe('⏱ 180 ms');
    });

    it('toggles the latency panel from the header button', () => {
      renderLane({ latencyMs: 180, onLatencyChange: vi.fn() });
      const toggle = screen.getByRole('button', { name: 'Atraso da entrada' });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByRole('slider', { name: 'Atraso' })).toBeNull();
      fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      const slider = screen.getByRole('slider', { name: 'Atraso' }) as HTMLInputElement;
      expect(slider.min).toBe('0');
      expect(slider.max).toBe('1000');
      expect(slider.step).toBe('10');
      expect(slider.value).toBe('180');
      expect(screen.getByText('180 ms')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Calibrar' })).toBeDefined();
      fireEvent.click(toggle);
      expect(screen.queryByRole('slider', { name: 'Atraso' })).toBeNull();
    });

    it('keeps the panel out of the flow before the visualization', () => {
      const { container } = render(<InputLane {...laneProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Atraso da entrada' }));
      const panel = container.querySelector('.lane-latency-panel');
      expect(panel?.parentElement?.classList.contains('lane-header')).toBe(true);
      expect(container.querySelector('.lane-status')!.nextElementSibling?.classList.contains('view-stage')).toBe(true);
    });

    it('reports a slider change for this lane', () => {
      const onLatencyChange = vi.fn();
      renderLane({ lane: { id: 'lane-2', deviceId: 'monitor' }, position: 2, onRemove: vi.fn(), onLatencyChange });
      fireEvent.click(screen.getByRole('button', { name: 'Atraso da entrada' }));
      fireEvent.change(screen.getByRole('slider', { name: 'Atraso' }), { target: { value: '250' } });
      expect(onLatencyChange).toHaveBeenCalledWith('lane-2', 250);
    });

    it('calibrates from the test notes this lane detects', () => {
      const onLatencyChange = vi.fn();
      const onCalibrationStart = vi.fn();
      const props = laneProps({ onLatencyChange, onCalibrationStart });
      const { rerender } = render(<InputLane {...props} />);
      fireEvent.click(screen.getByRole('button', { name: 'Atraso da entrada' }));
      fireEvent.click(screen.getByRole('button', { name: 'Calibrar' }));

      expect(onCalibrationStart).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Calibrando…')).toBeDefined();
      expect((screen.getByRole('button', { name: 'Calibrar' }) as HTMLButtonElement).disabled).toBe(true);

      let elapsed = 0;
      calibration.offsets.forEach((offset, i) => {
        act(() => {
          vi.advanceTimersByTime(offset + 200 - elapsed);
        });
        elapsed = offset + 200;
        // An octave below, as a voice-range tracker may report it: pitch class is what counts.
        tracker.state = { ...tracker.state, currentNote: note(CALIBRATION_MIDIS[i] - 12) };
        rerender(<InputLane {...props} />);
        act(() => {
          vi.advanceTimersByTime(250);
        });
        elapsed += 250;
        tracker.state = { ...tracker.state, currentNote: null };
        rerender(<InputLane {...props} />);
      });
      expect(onLatencyChange).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(onLatencyChange).toHaveBeenCalledWith('primary', 200);
      expect(screen.getByText('Atraso medido: 200 ms')).toBeDefined();
      expect((screen.getByRole('button', { name: 'Calibrar' }) as HTMLButtonElement).disabled).toBe(false);
      expect(closeContext).toHaveBeenCalled();
    });

    it('reports a failure and keeps the latency when nothing was detected', () => {
      const onLatencyChange = vi.fn();
      renderLane({ onLatencyChange });
      fireEvent.click(screen.getByRole('button', { name: 'Atraso da entrada' }));
      fireEvent.click(screen.getByRole('button', { name: 'Calibrar' }));
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onLatencyChange).not.toHaveBeenCalled();
      expect(screen.getByText('Não foi possível calibrar: a entrada não captou as notas de teste.')).toBeDefined();
      expect(closeContext).toHaveBeenCalled();
    });

    it('closes the calibration audio when unmounted mid-run', () => {
      const { unmount } = render(<InputLane {...laneProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Atraso da entrada' }));
      fireEvent.click(screen.getByRole('button', { name: 'Calibrar' }));
      unmount();
      expect(closeContext).toHaveBeenCalled();
    });
  });
});
