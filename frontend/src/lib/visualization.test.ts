import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadPianoRollFill,
  loadVisualization,
  nextVisualization,
  savePianoRollFill,
  saveVisualization,
  VISUALIZATION_MODES,
} from './visualization';

describe('visualization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to the wheel', () => {
    expect(loadVisualization()).toBe('wheel');
  });

  it('round-trips a saved mode and ignores invalid values', () => {
    saveVisualization('piano-roll');
    expect(loadVisualization()).toBe('piano-roll');
    localStorage.setItem('singer-trainer:visualization', 'hologram');
    expect(loadVisualization()).toBe('wheel');
  });

  it('cycles through every mode in order', () => {
    expect(VISUALIZATION_MODES.map((mode) => mode.id)).toEqual(['wheel', 'piano-roll', 'tuner', 'keyboard']);
    expect(nextVisualization('wheel')).toBe('piano-roll');
    expect(nextVisualization('keyboard')).toBe('wheel');
  });

  it('defaults the piano-roll fill to 1, round-trips it and treats invalid values as 1', () => {
    expect(loadPianoRollFill()).toBe(1);
    savePianoRollFill(0.35);
    expect(loadPianoRollFill()).toBe(0.35);
    savePianoRollFill(0);
    expect(loadPianoRollFill()).toBe(0);
    for (const invalid of ['abc', '1.5', '-0.1', '']) {
      localStorage.setItem('singer-trainer:piano-roll-fill', invalid);
      expect(loadPianoRollFill()).toBe(1);
    }
  });
});
