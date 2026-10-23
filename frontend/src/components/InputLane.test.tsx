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
    onPlayNote: vi.fn(),
    visualization: 'wheel',
    keyboardLowMidi: 60,
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
  });

  afterEach(() => {
    vi.useRealTimers();
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
});
