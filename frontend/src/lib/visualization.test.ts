import { beforeEach, describe, expect, it } from 'vitest';
import { loadVisualization, nextVisualization, saveVisualization, VISUALIZATION_MODES } from './visualization';

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
});
