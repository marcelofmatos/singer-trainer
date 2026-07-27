export interface PlaybackPreferences {
  playbackRate: number;
  loop: boolean;
}

const STORAGE_KEY = 'singer-trainer:playback-preferences';

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  playbackRate: 1,
  loop: false,
};

/** Reads playback preferences from localStorage, falling back to defaults on any problem. */
export function loadPlaybackPreferences(): PlaybackPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLAYBACK_PREFERENCES;

    const parsed = JSON.parse(raw);
    const playbackRate =
      typeof parsed.playbackRate === 'number'
        ? parsed.playbackRate
        : DEFAULT_PLAYBACK_PREFERENCES.playbackRate;
    const loop = typeof parsed.loop === 'boolean' ? parsed.loop : DEFAULT_PLAYBACK_PREFERENCES.loop;

    return { playbackRate, loop };
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
