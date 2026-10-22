import type { AudioInput } from '../hooks/useAudioInputs';
import { loadMicDeviceId, saveMicDeviceId } from './micPreference';

const STORAGE_KEY = 'singer-trainer:input-lanes';
export const PRIMARY_LANE_ID = 'primary';

/** One audio input shown as its own wheel; deviceId null means the system default. */
export interface InputLaneConfig {
  id: string;
  deviceId: string | null;
}

function isLane(value: unknown): value is InputLaneConfig {
  if (typeof value !== 'object' || value === null) return false;
  const lane = value as Record<string, unknown>;
  return typeof lane.id === 'string' && (typeof lane.deviceId === 'string' || lane.deviceId === null);
}

/** Stored lanes, always starting with the primary one; migrates from the single saved mic. */
export function loadInputLanes(): InputLaneConfig[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(parsed) && parsed.every(isLane) && parsed[0]?.id === PRIMARY_LANE_ID) {
      return parsed;
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

/** First available device not already used by a lane, or null when all are taken. */
export function nextFreeDeviceId(lanes: InputLaneConfig[], available: AudioInput[]): string | null {
  const used = new Set(lanes.map((lane) => lane.deviceId));
  return available.find((input) => !used.has(input.deviceId))?.deviceId ?? null;
}

export function createLaneId(): string {
  return `lane-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
