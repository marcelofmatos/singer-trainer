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
    savePlaybackPreferences({ playbackRate: 1.5, loop: true, micSensitivity: 0.4 });
    expect(loadPlaybackPreferences()).toEqual({ playbackRate: 1.5, loop: true, micSensitivity: 0.4 });
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
    expect(loadPlaybackPreferences()).toEqual({ playbackRate: 1.75, loop: false, micSensitivity: 0.15 });
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

  it('round-trips micSensitivity through save and load', () => {
    savePlaybackPreferences({ playbackRate: 1, loop: false, micSensitivity: 0.25 });
    expect(loadPlaybackPreferences().micSensitivity).toBe(0.25);
  });

  it('falls back to the default micSensitivity when the stored value is non-finite or non-positive', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ playbackRate: 1, loop: false, micSensitivity: -1 })
    );
    expect(loadPlaybackPreferences().micSensitivity).toBe(
      DEFAULT_PLAYBACK_PREFERENCES.micSensitivity
    );
  });

  it('includes micSensitivity in the defaults', () => {
    expect(DEFAULT_PLAYBACK_PREFERENCES.micSensitivity).toBe(0.15);
  });
});
