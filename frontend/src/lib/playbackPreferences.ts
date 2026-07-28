export interface PlaybackPreferences {
  playbackRate: number;
  loop: boolean;
  micSensitivity: number;
}

const STORAGE_KEY = 'singer-trainer:playback-preferences';

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  playbackRate: 1,
  loop: false,
  micSensitivity: 0.15,
};

/** Reads playback preferences from localStorage, falling back to defaults on any problem. */
export function loadPlaybackPreferences(): PlaybackPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLAYBACK_PREFERENCES;

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_PLAYBACK_PREFERENCES;
    }

    const playbackRate =
      typeof parsed.playbackRate === 'number' &&
      Number.isFinite(parsed.playbackRate) &&
      parsed.playbackRate > 0
        ? parsed.playbackRate
        : DEFAULT_PLAYBACK_PREFERENCES.playbackRate;
    const loop = typeof parsed.loop === 'boolean' ? parsed.loop : DEFAULT_PLAYBACK_PREFERENCES.loop;
    const micSensitivity =
      typeof parsed.micSensitivity === 'number' &&
      Number.isFinite(parsed.micSensitivity) &&
      parsed.micSensitivity > 0
        ? parsed.micSensitivity
        : DEFAULT_PLAYBACK_PREFERENCES.micSensitivity;

    return { playbackRate, loop, micSensitivity };
  } catch {
    return DEFAULT_PLAYBACK_PREFERENCES;
  }
}

/** Writes playback preferences to localStorage; silently no-ops if storage is unavailable. */
export function savePlaybackPreferences(preferences: PlaybackPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Private browsing / quota exceeded — this is a nice-to-have, not critical.
  }
}
