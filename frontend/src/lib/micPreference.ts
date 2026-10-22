// frontend/src/lib/micPreference.ts
const STORAGE_KEY = 'singer-trainer:mic-device-id';

/** Reads the chosen microphone's deviceId from localStorage, or null if unset/invalid. */
export function loadMicDeviceId(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/** Writes the chosen microphone's deviceId to localStorage; silently no-ops if unavailable. */
export function saveMicDeviceId(deviceId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, deviceId);
  } catch {
    // Private browsing / quota exceeded — this is a nice-to-have, not critical.
  }
}
