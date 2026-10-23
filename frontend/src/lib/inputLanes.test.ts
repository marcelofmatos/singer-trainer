import { beforeEach, describe, expect, it } from 'vitest';
import { createLaneId, loadInputLanes, nextFreeDeviceId, PRIMARY_LANE_ID, saveInputLanes } from './inputLanes';

const LANES_KEY = 'singer-trainer:input-lanes';
const MIC_KEY = 'singer-trainer:mic-device-id';

describe('inputLanes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with a single primary lane using the saved microphone', () => {
    localStorage.setItem(MIC_KEY, 'usb');
    expect(loadInputLanes()).toEqual([{ id: PRIMARY_LANE_ID, deviceId: 'usb' }]);
  });

  it('starts with the system default when nothing is saved', () => {
    expect(loadInputLanes()).toEqual([{ id: PRIMARY_LANE_ID, deviceId: null }]);
  });

  it('round-trips the lanes and mirrors the primary device into the saved microphone', () => {
    const lanes = [
      { id: PRIMARY_LANE_ID, deviceId: 'usb' },
      { id: 'lane-2', deviceId: 'monitor' },
    ];
    saveInputLanes(lanes);
    expect(loadInputLanes()).toEqual(lanes);
    expect(localStorage.getItem(MIC_KEY)).toBe('usb');
  });

  it('falls back to a single primary lane when the stored value is invalid', () => {
    localStorage.setItem(LANES_KEY, '{bad');
    expect(loadInputLanes()).toEqual([{ id: PRIMARY_LANE_ID, deviceId: null }]);
    localStorage.setItem(LANES_KEY, JSON.stringify([{ id: 'lane-2', deviceId: 'x' }]));
    expect(loadInputLanes()).toEqual([{ id: PRIMARY_LANE_ID, deviceId: null }]);
  });

  it('picks the first device not used by any lane', () => {
    const lanes = [{ id: PRIMARY_LANE_ID, deviceId: 'usb' }];
    const available = [
      { deviceId: 'usb', label: 'USB' },
      { deviceId: 'monitor', label: 'Monitor' },
    ];
    expect(nextFreeDeviceId(lanes, available)).toBe('monitor');
    expect(nextFreeDeviceId([...lanes, { id: 'b', deviceId: 'monitor' }], available)).toBeNull();
  });

  it('never picks the pseudo devices "default" and "communications"', () => {
    const available = [
      { deviceId: 'default', label: 'Padrão' },
      { deviceId: 'communications', label: 'Comunicações' },
      { deviceId: 'usb', label: 'USB' },
    ];
    expect(nextFreeDeviceId([{ id: PRIMARY_LANE_ID, deviceId: 'monitor' }], available)).toBe('usb');
  });

  it('skips a device another lane has actually opened', () => {
    const lanes = [{ id: PRIMARY_LANE_ID, deviceId: null }];
    const available = [
      { deviceId: 'default', label: 'Padrão' },
      { deviceId: 'usb', label: 'USB' },
      { deviceId: 'monitor', label: 'Monitor' },
    ];
    expect(nextFreeDeviceId(lanes, available, ['usb'])).toBe('monitor');
  });

  it('returns null when only pseudo or taken devices remain', () => {
    const available = [
      { deviceId: 'default', label: 'Padrão' },
      { deviceId: 'communications', label: 'Comunicações' },
      { deviceId: 'usb', label: 'USB' },
      { deviceId: 'monitor', label: 'Monitor' },
    ];
    const lanes = [
      { id: PRIMARY_LANE_ID, deviceId: null },
      { id: 'lane-2', deviceId: 'monitor' },
    ];
    expect(nextFreeDeviceId(lanes, available, ['usb'])).toBeNull();
  });

  it('creates distinct lane ids', () => {
    expect(createLaneId()).not.toBe(createLaneId());
    expect(createLaneId()).not.toBe(PRIMARY_LANE_ID);
  });
});
