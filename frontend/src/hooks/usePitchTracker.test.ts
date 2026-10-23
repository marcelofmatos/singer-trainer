// frontend/src/hooks/usePitchTracker.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePitchTracker } from './usePitchTracker';

let stopSpies: ReturnType<typeof vi.fn>[] = [];
let getUserMedia: ReturnType<typeof vi.fn>;
let trackLabel = 'USB Audio Device';
let endedListeners: Array<() => void> = [];
// Pitch detection wants the raw signal, without the browser's voice-call processing.
const RAW_AUDIO = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

class MockAudioContext {
  sampleRate = 44100;
  createMediaStreamSource() {
    return { connect() {} };
  }
  createAnalyser() {
    return { fftSize: 0, getFloatTimeDomainData() {} };
  }
  close() {
    return Promise.resolve();
  }
}

describe('usePitchTracker', () => {
  beforeEach(() => {
    stopSpies = [];
    trackLabel = 'USB Audio Device';
    endedListeners = [];
    getUserMedia = vi.fn(async (constraints: { audio: { deviceId?: { exact: string } } }) => {
      const stop = vi.fn();
      stopSpies.push(stop);
      const deviceId = constraints.audio.deviceId?.exact ?? 'default';
      const track = {
        stop,
        label: trackLabel,
        getSettings: () => ({ deviceId, groupId: `g-${deviceId}` }),
        addEventListener: (type: string, listener: () => void) => {
          if (type === 'ended') endedListeners.push(listener);
        },
      };
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    });
    vi.stubGlobal('AudioContext', MockAudioContext);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the microphone and listens when enabled', async () => {
    const { result } = renderHook(() => usePitchTracker(0.15, true));
    await waitFor(() => expect(result.current.status).toBe('listening'));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: RAW_AUDIO });
  });

  it('does not open the microphone and reports "off" when disabled', () => {
    const { result } = renderHook(() => usePitchTracker(0.15, false));
    expect(result.current.status).toBe('off');
    expect(result.current.currentNote).toBeNull();
    expect(result.current.waveform).toEqual([]);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('releases the stream when disabled and reopens it when re-enabled', async () => {
    const { result, rerender } = renderHook(({ enabled }) => usePitchTracker(0.15, enabled), {
      initialProps: { enabled: true },
    });
    await waitFor(() => expect(result.current.status).toBe('listening'));

    rerender({ enabled: false });
    expect(result.current.status).toBe('off');
    expect(stopSpies[0]).toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe('listening'));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('reports the active microphone name while listening', async () => {
    const { result } = renderHook(() => usePitchTracker(0.15, true));
    await waitFor(() => expect(result.current.status).toBe('listening'));
    expect(result.current.deviceName).toBe('USB Audio Device');
  });

  it('reports no microphone name when the browser hides the label', async () => {
    trackLabel = '';
    const { result } = renderHook(() => usePitchTracker(0.15, true));
    await waitFor(() => expect(result.current.status).toBe('listening'));
    expect(result.current.deviceName).toBeNull();
  });

  it('clears the microphone name when turned off', async () => {
    const { result, rerender } = renderHook(({ enabled }) => usePitchTracker(0.15, enabled), {
      initialProps: { enabled: true },
    });
    await waitFor(() => expect(result.current.deviceName).toBe('USB Audio Device'));
    rerender({ enabled: false });
    expect(result.current.deviceName).toBeNull();
  });

  it('opens the requested microphone and reports the device in use', async () => {
    const { result } = renderHook(() => usePitchTracker(0.15, true, 'usb'));
    await waitFor(() => expect(result.current.status).toBe('listening'));
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { ...RAW_AUDIO, deviceId: { exact: 'usb' } } });
    expect(result.current.deviceId).toBe('usb');
    expect(result.current.groupId).toBe('g-usb');
  });

  it('reports a disconnected input instead of falling back when asked not to', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('gone'), { name: 'OverconstrainedError' }));
    const { result } = renderHook(() => usePitchTracker(0.15, true, 'unplugged', { fallbackToDefault: false }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toBe('Entrada desconectada');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('falls back to the default microphone when the requested one is not connected', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('gone'), { name: 'OverconstrainedError' }));
    const { result } = renderHook(() => usePitchTracker(0.15, true, 'unplugged'));
    await waitFor(() => expect(result.current.status).toBe('listening'));
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: RAW_AUDIO });
    expect(result.current.deviceId).toBe('default');
  });

  it('reports other errors without falling back', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('busy'), { name: 'NotReadableError' }));
    const { result } = renderHook(() => usePitchTracker(0.15, true, 'usb'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(result.current.deviceId).toBeNull();
    expect(result.current.groupId).toBeNull();
  });

  it('reports no group when the browser does not give one', async () => {
    getUserMedia.mockResolvedValueOnce({
      getTracks: () => [],
      getAudioTracks: () => [{ stop() {}, label: '', getSettings: () => ({ deviceId: 'usb' }), addEventListener() {} }],
    });
    const { result } = renderHook(() => usePitchTracker(0.15, true, 'usb'));
    await waitFor(() => expect(result.current.status).toBe('listening'));
    expect(result.current.groupId).toBeNull();
  });

  it('reopens the microphone when switching devices', async () => {
    const { result, rerender } = renderHook(({ id }) => usePitchTracker(0.15, true, id), {
      initialProps: { id: null as string | null },
    });
    await waitFor(() => expect(result.current.deviceId).toBe('default'));
    rerender({ id: 'usb' });
    await waitFor(() => expect(result.current.deviceId).toBe('usb'));
    expect(stopSpies[0]).toHaveBeenCalled();
  });

  it('reopens the microphone when its track ends (unplugged)', async () => {
    const { result } = renderHook(() => usePitchTracker(0.15, true));
    await waitFor(() => expect(result.current.status).toBe('listening'));
    act(() => endedListeners[0]());
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.status).toBe('listening'));
    expect(stopSpies[0]).toHaveBeenCalled();
  });
});
