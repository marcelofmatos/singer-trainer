import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLaneId,
  findRealInput,
  loadInputLanes,
  nextFreeDeviceId,
  PRIMARY_LANE_ID,
  saveInputLanes,
} from './inputLanes';

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

  it('round-trips a lane latency', () => {
    const lanes = [
      { id: PRIMARY_LANE_ID, deviceId: 'usb', latencyMs: 180 },
      { id: 'lane-2', deviceId: null },
    ];
    saveInputLanes(lanes);
    expect(loadInputLanes()).toEqual(lanes);
  });

  it('loads lanes stored without latencyMs unchanged', () => {
    localStorage.setItem(LANES_KEY, JSON.stringify([{ id: PRIMARY_LANE_ID, deviceId: 'usb' }]));
    expect(loadInputLanes()).toEqual([{ id: PRIMARY_LANE_ID, deviceId: 'usb' }]);
  });

  it('drops an invalid latencyMs but still loads the lane', () => {
    localStorage.setItem(
      LANES_KEY,
      JSON.stringify([
        { id: PRIMARY_LANE_ID, deviceId: 'usb', latencyMs: 5000 },
        { id: 'a', deviceId: null, latencyMs: 'x' },
        { id: 'b', deviceId: null, latencyMs: -1 },
        { id: 'c', deviceId: null, latencyMs: null },
        { id: 'd', deviceId: null, latencyMs: 1000 },
      ])
    );
    expect(loadInputLanes()).toEqual([
      { id: PRIMARY_LANE_ID, deviceId: 'usb' },
      { id: 'a', deviceId: null },
      { id: 'b', deviceId: null },
      { id: 'c', deviceId: null },
      { id: 'd', deviceId: null, latencyMs: 1000 },
    ]);
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

  it('prefers a free "Monitor of" device over other microphones (e.g. a Bluetooth headset mic)', () => {
    const lanes = [{ id: PRIMARY_LANE_ID, deviceId: 'usb' }];
    const available = [
      { deviceId: 'usb', label: 'USB Composite Device Mono' },
      { deviceId: 'jbl-mic', label: 'JBL Tune 770NC' },
      { deviceId: 'analog-monitor', label: 'Monitor of Áudio interno Estéreo analógico' },
      { deviceId: 'jbl-monitor', label: 'Monitor of JBL Tune 770NC' },
    ];
    expect(nextFreeDeviceId(lanes, available)).toBe('analog-monitor');
    expect(nextFreeDeviceId([...lanes, { id: 'b', deviceId: 'analog-monitor' }], available)).toBe('jbl-monitor');
    expect(
      nextFreeDeviceId(
        [...lanes, { id: 'b', deviceId: 'analog-monitor' }, { id: 'c', deviceId: 'jbl-monitor' }],
        available
      )
    ).toBe('jbl-mic');
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

  it('skips devices in the same group as one already in use (Chrome reports the "default" alias)', () => {
    const lanes = [{ id: PRIMARY_LANE_ID, deviceId: null }];
    const available = [
      { deviceId: 'default', label: 'Padrão', groupId: 'g-usb' },
      { deviceId: 'usb', label: 'USB Mic', groupId: 'g-usb' },
      { deviceId: 'monitor', label: 'Monitor of JBL', groupId: 'g-jbl' },
    ];
    expect(nextFreeDeviceId(lanes, available, ['default'], ['g-usb'])).toBe('monitor');
  });

  it("skips devices in the same group as a lane's configured device", () => {
    const lanes = [{ id: PRIMARY_LANE_ID, deviceId: 'usb-alias' }];
    const available = [
      { deviceId: 'usb-alias', label: 'USB (alias)', groupId: 'g-usb' },
      { deviceId: 'usb', label: 'USB Mic', groupId: 'g-usb' },
      { deviceId: 'monitor', label: 'Monitor of JBL', groupId: 'g-jbl' },
    ];
    expect(nextFreeDeviceId(lanes, available)).toBe('monitor');
  });

  it('finds the real device behind an id or group in use', () => {
    const available = [
      { deviceId: 'default', label: 'Padrão', groupId: 'g-usb' },
      { deviceId: 'usb', label: 'USB Mic', groupId: 'g-usb' },
    ];
    expect(findRealInput(available, 'usb', null)?.label).toBe('USB Mic');
    expect(findRealInput(available, 'default', 'g-usb')?.label).toBe('USB Mic');
    expect(findRealInput(available, 'default', null)).toBeUndefined();
    expect(findRealInput(available, null, null)).toBeUndefined();
  });

  it('creates distinct lane ids', () => {
    expect(createLaneId()).not.toBe(createLaneId());
    expect(createLaneId()).not.toBe(PRIMARY_LANE_ID);
  });
});
