// frontend/src/hooks/useAudioInputs.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAudioInputs } from './useAudioInputs';

let devices: Array<{ deviceId: string; label: string; kind: string }>;
let deviceChangeListener: (() => void) | null;
let enumerateDevices: ReturnType<typeof vi.fn>;

function stubMediaDevices() {
  enumerateDevices = vi.fn(async () => devices.map((device) => ({ ...device })));
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      enumerateDevices,
      addEventListener: (_type: string, listener: () => void) => {
        deviceChangeListener = listener;
      },
      removeEventListener: () => {
        deviceChangeListener = null;
      },
    },
    configurable: true,
  });
}

describe('useAudioInputs', () => {
  beforeEach(() => {
    devices = [
      { deviceId: 'default', label: 'Padrão', kind: 'audioinput' },
      { deviceId: 'speakers', label: 'Alto-falantes', kind: 'audiooutput' },
      { deviceId: 'usb', label: '', kind: 'audioinput' },
    ];
    deviceChangeListener = null;
    stubMediaDevices();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
  });

  it('lists only microphones, naming the unlabeled ones', async () => {
    const { result } = renderHook(() => useAudioInputs(null));
    await waitFor(() =>
      expect(result.current.inputs).toEqual([
        { deviceId: 'default', label: 'Padrão' },
        { deviceId: 'usb', label: 'Microfone 2' },
      ])
    );
  });

  it('re-reads the list when a device is plugged in', async () => {
    const { result } = renderHook(() => useAudioInputs(null));
    await waitFor(() => expect(result.current.inputs).toHaveLength(2));
    devices.push({ deviceId: 'headset', label: 'Headset', kind: 'audioinput' });
    await act(async () => deviceChangeListener!());
    expect(result.current.inputs.map((input) => input.label)).toContain('Headset');
  });

  it('re-reads the list when refreshKey changes', async () => {
    const { rerender } = renderHook(({ key }) => useAudioInputs(key), { initialProps: { key: 'a' } });
    await waitFor(() => expect(enumerateDevices).toHaveBeenCalledTimes(1));
    rerender({ key: 'b' });
    await waitFor(() => expect(enumerateDevices).toHaveBeenCalledTimes(2));
  });

  it('re-reads the list on demand', async () => {
    const { result } = renderHook(() => useAudioInputs(null));
    await waitFor(() => expect(result.current.inputs).toHaveLength(2));
    devices.push({ deviceId: 'headset', label: 'Headset', kind: 'audioinput' });
    await act(async () => result.current.refresh());
    expect(result.current.inputs).toHaveLength(3);
  });

  it('returns an empty list when the browser exposes no media devices', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    const { result } = renderHook(() => useAudioInputs(null));
    expect(result.current.inputs).toEqual([]);
  });
});
