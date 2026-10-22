// frontend/src/hooks/useAudioInputs.ts
import { useCallback, useEffect, useState } from 'react';

export interface AudioInput {
  deviceId: string;
  label: string;
}

/**
 * Lists the microphones the system exposes. Re-reads them when `refreshKey` changes (labels
 * only appear once microphone permission is granted), on the browser's `devicechange` event
 * and on demand through `refresh`.
 */
export function useAudioInputs(refreshKey: unknown): { inputs: AudioInput[]; refresh: () => void } {
  const [inputs, setInputs] = useState<AudioInput[]>([]);

  const refresh = useCallback(async () => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return;
    const devices = await mediaDevices.enumerateDevices();
    setInputs(
      devices
        .filter((device) => device.kind === 'audioinput')
        .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Microfone ${index + 1}` }))
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return;
    mediaDevices.addEventListener('devicechange', refresh);
    return () => mediaDevices.removeEventListener('devicechange', refresh);
  }, [refresh]);

  return { inputs, refresh };
}
