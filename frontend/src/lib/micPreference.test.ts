// frontend/src/lib/micPreference.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { loadMicDeviceId, saveMicDeviceId } from './micPreference';

const STORAGE_KEY = 'singer-trainer:mic-device-id';

describe('micPreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored yet', () => {
    expect(loadMicDeviceId()).toBeNull();
  });

  it('round-trips a saved id through load', () => {
    saveMicDeviceId('usb-mic');
    expect(loadMicDeviceId()).toBe('usb-mic');
  });

  it('returns null when the stored value is an empty string', () => {
    localStorage.setItem(STORAGE_KEY, '');
    expect(loadMicDeviceId()).toBeNull();
  });

  it('does not throw when localStorage.getItem throws', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('unavailable');
    };
    expect(loadMicDeviceId()).toBeNull();
    Storage.prototype.getItem = original;
  });

  it('does not throw when localStorage.setItem throws', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota exceeded');
    };
    expect(() => saveMicDeviceId('usb-mic')).not.toThrow();
    Storage.prototype.setItem = original;
  });
});
