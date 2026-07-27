import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAYBACK_PREFERENCES,
  loadPlaybackPreferences,
  savePlaybackPreferences,
} from './playbackPreferences';

const STORAGE_KEY = 'singer-trainer:playback-preferences';

describe('playbackPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the defaults when nothing is stored yet', () => {
    expect(loadPlaybackPreferences()).toEqual(DEFAULT_PLAYBACK_PREFERENCES);
  });

  it('round-trips a saved value through load', () => {
    savePlaybackPreferences({ playbackRate: 1.5, loop: true });
    expect(loadPlaybackPreferences()).toEqual({ playbackRate: 1.5, loop: true });
  });

  it('falls back to defaults when the stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(loadPlaybackPreferences()).toEqual(DEFAULT_PLAYBACK_PREFERENCES);
  });

  it('falls back per-field when a stored value has the wrong type', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ playbackRate: 'fast', loop: 'yes' }));
    expect(loadPlaybackPreferences()).toEqual(DEFAULT_PLAYBACK_PREFERENCES);
  });

  it('keeps a valid field even when the other one is invalid', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ playbackRate: 1.75, loop: 'yes' }));
    expect(loadPlaybackPreferences()).toEqual({ playbackRate: 1.75, loop: false });
  });

  it('falls back to defaults when the stored JSON is not an object', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(null));
    expect(loadPlaybackPreferences()).toEqual(DEFAULT_PLAYBACK_PREFERENCES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(loadPlaybackPreferences()).toEqual(DEFAULT_PLAYBACK_PREFERENCES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(5));
    expect(loadPlaybackPreferences()).toEqual(DEFAULT_PLAYBACK_PREFERENCES);
  });

  it('falls back to the default rate when the stored rate is non-finite or non-positive', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ playbackRate: 1e999, loop: false }));
    expect(loadPlaybackPreferences().playbackRate).toBe(DEFAULT_PLAYBACK_PREFERENCES.playbackRate);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ playbackRate: -1, loop: false }));
    expect(loadPlaybackPreferences().playbackRate).toBe(DEFAULT_PLAYBACK_PREFERENCES.playbackRate);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ playbackRate: 0, loop: false }));
    expect(loadPlaybackPreferences().playbackRate).toBe(DEFAULT_PLAYBACK_PREFERENCES.playbackRate);
  });
});
