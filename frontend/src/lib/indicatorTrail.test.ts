import { describe, expect, it } from 'vitest';
import { advanceTrail } from './indicatorTrail';

describe('advanceTrail', () => {
  it('appends a new value to the end of the trail', () => {
    expect(advanceTrail([1, 2, 3], 4, 10)).toEqual([1, 2, 3, 4]);
  });

  it('caps the trail at maxLength, dropping the oldest values first', () => {
    expect(advanceTrail([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });

  it('drops the oldest value when there is no new one, to age the trail out', () => {
    expect(advanceTrail([1, 2, 3], null, 3)).toEqual([2, 3]);
  });

  it('returns the same array reference when already empty and there is no new value', () => {
    const empty: number[] = [];
    expect(advanceTrail(empty, null, 3)).toBe(empty);
  });

  it('starts a trail from empty when a new value arrives', () => {
    expect(advanceTrail([], 1, 3)).toEqual([1]);
  });
});
