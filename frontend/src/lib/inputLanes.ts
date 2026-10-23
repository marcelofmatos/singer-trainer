import type { AudioInput } from '../hooks/useAudioInputs';
import { MAX_LATENCY_MS } from './latency';
import { loadMicDeviceId, saveMicDeviceId } from './micPreference';

const STORAGE_KEY = 'singer-trainer:input-lanes';
export const PRIMARY_LANE_ID = 'primary';

/** One audio input shown as its own wheel; deviceId null means the system default. */
export interface InputLaneConfig {
  id: string;
  deviceId: string | null;
  /** Input delay in ms (0-1000); absent means 0. */
  latencyMs?: number;
}

function isLane(value: unknown): value is InputLaneConfig {
  if (typeof value !== 'object' || value === null) return false;
  const lane = value as Record<string, unknown>;
  return typeof lane.id === 'string' && (typeof lane.deviceId === 'string' || lane.deviceId === null);
}

/** Lenient: an invalid latencyMs is dropped (treated as 0) instead of rejecting the lane. */
function withValidLatency(lane: InputLaneConfig): InputLaneConfig {
  const { latencyMs, ...rest } = lane;
  const valid = typeof latencyMs === 'number' && Number.isFinite(latencyMs) && latencyMs >= 0 && latencyMs <= MAX_LATENCY_MS;
  return valid ? lane : rest;
}

/** Stored lanes, always starting with the primary one; migrates from the single saved mic. */
export function loadInputLanes(): InputLaneConfig[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(parsed) && parsed.every(isLane) && parsed[0]?.id === PRIMARY_LANE_ID) {
      return parsed.map(withValidLatency);
    }
  } catch {
    // Fall through to the default below.
  }
  return [{ id: PRIMARY_LANE_ID, deviceId: loadMicDeviceId() }];
}

export function saveInputLanes(lanes: InputLaneConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lanes));
  } catch {
    // Private browsing / quota exceeded — the layout just won't be remembered.
  }
  const primaryDeviceId = lanes[0]?.deviceId;
  if (primaryDeviceId) saveMicDeviceId(primaryDeviceId);
}

// Chrome's aliases for a real device that is also listed under its own id.
const PSEUDO_DEVICE_IDS = new Set(['default', 'communications']);

function isRealInput(input: AudioInput): boolean {
  return !PSEUDO_DEVICE_IDS.has(input.deviceId);
}

/**
 * First real device that no lane is configured with or has actually opened (`inUseDeviceIds`),
 * nor shares a physical device (groupId) with one, or null when all are taken.
 */
export function nextFreeDeviceId(
  lanes: InputLaneConfig[],
  available: AudioInput[],
  inUseDeviceIds: string[] = [],
  inUseGroupIds: string[] = []
): string | null {
  const usedIds = new Set<string | null>([...lanes.map((lane) => lane.deviceId), ...inUseDeviceIds]);
  const usedGroups = new Set(inUseGroupIds);
  for (const input of available) {
    if (input.groupId && usedIds.has(input.deviceId)) usedGroups.add(input.groupId);
  }
  const candidates = available.filter(
    (input) =>
      isRealInput(input) && !usedIds.has(input.deviceId) && !(input.groupId && usedGroups.has(input.groupId))
  );
  // System monitors first: they're what extra lanes are for, and auto-picking a Bluetooth headset's mic
  // switches the headset to call mode, which on Linux can stall its audio output until it's reconnected.
  const free = candidates.find((input) => input.label.startsWith('Monitor of')) ?? candidates[0];
  return free?.deviceId ?? null;
}

/** The real (non-alias) listed input behind a device in use, matched by id and then by group. */
export function findRealInput(
  available: AudioInput[],
  deviceId: string | null,
  groupId: string | null
): AudioInput | undefined {
  const real = available.filter(isRealInput);
  return (
    real.find((input) => input.deviceId === deviceId) ??
    (groupId ? real.find((input) => input.groupId === groupId) : undefined)
  );
}

export function createLaneId(): string {
  return `lane-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
