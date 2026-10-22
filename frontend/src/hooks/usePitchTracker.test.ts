// frontend/src/hooks/usePitchTracker.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePitchTracker } from './usePitchTracker';

let stopSpies: ReturnType<typeof vi.fn>[] = [];
let getUserMedia: ReturnType<typeof vi.fn>;

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
    getUserMedia = vi.fn(async () => {
      const stop = vi.fn();
      stopSpies.push(stop);
      return { getTracks: () => [{ stop }] };
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
});
