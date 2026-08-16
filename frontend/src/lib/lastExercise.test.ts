import { beforeEach, describe, expect, it } from 'vitest';
import { loadLastExerciseId, saveLastExerciseId } from './lastExercise';

const STORAGE_KEY = 'singer-trainer:last-exercise-id';

describe('lastExercise', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored yet', () => {
    expect(loadLastExerciseId()).toBeNull();
  });

  it('round-trips a saved id through load', () => {
    saveLastExerciseId('escala-menor-c4');
    expect(loadLastExerciseId()).toBe('escala-menor-c4');
  });

  it('returns null when the stored value is an empty string', () => {
    localStorage.setItem(STORAGE_KEY, '');
    expect(loadLastExerciseId()).toBeNull();
  });

  it('does not throw when localStorage.getItem throws', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('unavailable');
    };
    expect(() => loadLastExerciseId()).not.toThrow();
    expect(loadLastExerciseId()).toBeNull();
    Storage.prototype.getItem = original;
  });

  it('does not throw when localStorage.setItem throws', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota exceeded');
    };
    expect(() => saveLastExerciseId('escala-menor-c4')).not.toThrow();
    Storage.prototype.setItem = original;
  });
});
