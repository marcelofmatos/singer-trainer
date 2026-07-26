import { describe, expect, it } from 'vitest';
import { centsToGaugePercent, tuningStatus } from './tuningGauge';

describe('centsToGaugePercent', () => {
  it('maps 0 cents to the center (50%)', () => {
    expect(centsToGaugePercent(0)).toBe(50);
  });

  it('maps -50 cents (or below) to 0%', () => {
    expect(centsToGaugePercent(-50)).toBe(0);
    expect(centsToGaugePercent(-100)).toBe(0);
  });

  it('maps +50 cents (or above) to 100%', () => {
    expect(centsToGaugePercent(50)).toBe(100);
    expect(centsToGaugePercent(100)).toBe(100);
  });

  it('maps +25 cents to 75%', () => {
    expect(centsToGaugePercent(25)).toBe(75);
  });
});

describe('tuningStatus', () => {
  it('is "in-tune" within 10 cents', () => {
    expect(tuningStatus(0)).toBe('in-tune');
    expect(tuningStatus(10)).toBe('in-tune');
    expect(tuningStatus(-10)).toBe('in-tune');
  });

  it('is "close" between 10 and 25 cents', () => {
    expect(tuningStatus(15)).toBe('close');
    expect(tuningStatus(-20)).toBe('close');
  });

  it('is "off" beyond 25 cents', () => {
    expect(tuningStatus(30)).toBe('off');
    expect(tuningStatus(-40)).toBe('off');
  });
});
