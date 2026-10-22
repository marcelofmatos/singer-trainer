// frontend/src/lib/scoreHistory.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendScoreRecord,
  bestScores,
  loadScoreHistory,
  MAX_HISTORY,
  totalTally,
  totalTallyForInput,
  type ScoreRecord,
} from './scoreHistory';

const STORAGE_KEY = 'singer-trainer:score-history';

function record(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    exerciseId: 'escala-maior',
    exerciseName: 'Escala Maior',
    finishedAt: 1_700_000_000_000,
    playbackRate: 1,
    targetSeconds: 10,
    hitSeconds: 5,
    ...overrides,
  };
}

describe('scoreHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty', () => {
    expect(loadScoreHistory()).toEqual([]);
  });

  it('appends records and loads them back, oldest first', () => {
    appendScoreRecord(record({ finishedAt: 1 }));
    const history = appendScoreRecord(record({ finishedAt: 2 }));
    expect(history.map((entry) => entry.finishedAt)).toEqual([1, 2]);
    expect(loadScoreHistory()).toEqual(history);
  });

  it(`keeps only the latest ${MAX_HISTORY} records`, () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from({ length: MAX_HISTORY }, (_, index) => record({ finishedAt: index })))
    );
    const history = appendScoreRecord(record({ finishedAt: MAX_HISTORY }));
    expect(history).toHaveLength(MAX_HISTORY);
    expect(history[0].finishedAt).toBe(1);
    expect(history[history.length - 1].finishedAt).toBe(MAX_HISTORY);
  });

  it('ignores corrupted storage and invalid entries', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadScoreHistory()).toEqual([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([record(), { exerciseId: 'x' }, 42]));
    expect(loadScoreHistory()).toEqual([record()]);
  });

  it('does not throw when localStorage is unavailable', () => {
    const originalGet = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new Error('unavailable');
    };
    Storage.prototype.setItem = () => {
      throw new Error('unavailable');
    };
    try {
      expect(loadScoreHistory()).toEqual([]);
      expect(appendScoreRecord(record())).toEqual([record()]);
    } finally {
      Storage.prototype.getItem = originalGet;
      Storage.prototype.setItem = originalSet;
    }
  });

  it('finds the best percentage per exercise and input', () => {
    const history = [
      record({ exerciseId: 'a', exerciseName: 'A', targetSeconds: 10, hitSeconds: 5 }),
      record({ exerciseId: 'a', exerciseName: 'A', targetSeconds: 10, hitSeconds: 8 }),
      record({ exerciseId: 'a', exerciseName: 'A', inputId: 'lane-2', inputLabel: 'Monitor', targetSeconds: 4, hitSeconds: 1 }),
    ];
    expect(bestScores(history)).toEqual([
      { exerciseName: 'A', inputLabel: null, percent: 80 },
      { exerciseName: 'A', inputLabel: 'Monitor', percent: 25 },
    ]);
  });

  it('sums the records of one input, counting records without input as the primary lane', () => {
    const history = [
      record({ targetSeconds: 10, hitSeconds: 5 }),
      record({ inputId: 'primary', targetSeconds: 2, hitSeconds: 2 }),
      record({ inputId: 'lane-2', targetSeconds: 100, hitSeconds: 0 }),
    ];
    expect(totalTallyForInput(history, 'primary')).toEqual({ targetSeconds: 12, hitSeconds: 7 });
    expect(totalTallyForInput(history, 'lane-2')).toEqual({ targetSeconds: 100, hitSeconds: 0 });
  });

  it('accepts records with input fields and rejects invalid ones', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([record({ inputId: 'lane-2', inputLabel: 'Monitor' }), { ...record(), inputId: 3 }])
    );
    expect(loadScoreHistory()).toEqual([record({ inputId: 'lane-2', inputLabel: 'Monitor' })]);
  });

  it('sums every record into one tally', () => {
    expect(totalTally([record({ targetSeconds: 10, hitSeconds: 5 }), record({ targetSeconds: 2, hitSeconds: 2 })])).toEqual({
      targetSeconds: 12,
      hitSeconds: 7,
    });
  });
});
