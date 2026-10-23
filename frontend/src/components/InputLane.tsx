// frontend/src/components/InputLane.tsx
import { useEffect, useRef, type Ref } from 'react';
import { usePitchTracker } from '../hooks/usePitchTracker';
import type { AudioInput } from '../hooks/useAudioInputs';
import { PRIMARY_LANE_ID, type InputLaneConfig } from '../lib/inputLanes';
import { isHit } from '../lib/scoring';
import type { NoteInfo } from '../lib/noteUtils';
import { PitchMeter, type PitchMeterHandle } from './PitchMeter';
import { Waveform } from './Waveform';

export interface InputLaneProps {
  lane: InputLaneConfig;
  position: number;
  sensitivity: number;
  micEnabled: boolean;
  onToggleMic: () => void;
  targetMidiNumber: number | null;
  scoringActive: boolean;
  audioInputs: AudioInput[];
  onRefreshInputs: () => void;
  onSelectDevice: (deviceId: string) => void;
  /** Reports the device (and its group) this lane's tracker actually opened; null while none is open. */
  onDeviceInUse: (laneId: string, deviceId: string | null, groupId: string | null) => void;
  onRemove?: () => void;
  onSample: (laneId: string, hit: boolean) => void;
  onNoteClick: (pitchClass: number) => void;
  wheelRef?: Ref<PitchMeterHandle>;
}

const SCORE_TICK_MS = 100;

/** One audio input: its own pitch tracker, wheel, waveform and device controls. */
export function InputLane({
  lane,
  position,
  sensitivity,
  micEnabled,
  onToggleMic,
  targetMidiNumber,
  scoringActive,
  audioInputs,
  onRefreshInputs,
  onSelectDevice,
  onDeviceInUse,
  onRemove,
  onSample,
  onNoteClick,
  wheelRef,
}: InputLaneProps) {
  const isPrimary = lane.id === PRIMARY_LANE_ID;
  // An extra lane with no device yet waits for a choice instead of opening the system default.
  const needsDevice = !isPrimary && lane.deviceId === null;
  const tracker = usePitchTracker(sensitivity, micEnabled && !needsDevice, lane.deviceId, {
    fallbackToDefault: isPrimary,
  });
  const name = isPrimary ? 'Microfone' : `Entrada ${position}`;
  const detected = tracker.status === 'listening' ? tracker.currentNote : null;
  const selectedDeviceId = tracker.deviceId ?? lane.deviceId ?? '';
  // An unplugged device isn't listed; without a placeholder the select would show another device's name.
  const deviceMissing = selectedDeviceId !== '' && !audioInputs.some((input) => input.deviceId === selectedDeviceId);

  // Device labels only appear once permission is granted, so re-read them when this lane opens a device.
  useEffect(() => {
    if (tracker.deviceId) onRefreshInputs();
  }, [tracker.deviceId, onRefreshInputs]);

  // Read through a ref so an inline callback from the parent doesn't re-run the effect.
  const onDeviceInUseRef = useRef(onDeviceInUse);
  useEffect(() => {
    onDeviceInUseRef.current = onDeviceInUse;
  });
  useEffect(() => {
    onDeviceInUseRef.current(lane.id, tracker.deviceId, tracker.groupId);
  }, [lane.id, tracker.deviceId, tracker.groupId]);

  // Sampled on its own tick from a ref so the interval isn't re-armed on every detection update.
  const scoringRef = useRef<{ active: boolean; target: number | null; detected: NoteInfo | null }>({
    active: false,
    target: null,
    detected: null,
  });
  const onSampleRef = useRef(onSample);
  useEffect(() => {
    scoringRef.current = {
      active: scoringActive && tracker.status === 'listening',
      target: targetMidiNumber,
      detected: tracker.currentNote,
    };
    onSampleRef.current = onSample;
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      const { active, target, detected: note } = scoringRef.current;
      if (!active || target === null) return;
      onSampleRef.current(lane.id, isHit(note, target));
    }, SCORE_TICK_MS);
    return () => clearInterval(intervalId);
  }, [lane.id]);

  return (
    <div className="input-lane">
      <div className="lane-header">
        <span aria-hidden="true">🎙️</span>
        {audioInputs.length > 0 && (
          <select
            className="mic-select"
            aria-label={name}
            value={selectedDeviceId}
            onChange={(event) => onSelectDevice(event.target.value)}
          >
            {needsDevice && (
              <option value="" disabled>
                Escolha um dispositivo
              </option>
            )}
            {deviceMissing && (
              <option value={selectedDeviceId} disabled>
                Entrada desconectada
              </option>
            )}
            {audioInputs.map((input) => (
              <option key={input.deviceId} value={input.deviceId}>
                {input.label}
              </option>
            ))}
          </select>
        )}
        {isPrimary && (
          <button type="button" className="icon-button" onClick={onRefreshInputs} aria-label="Atualizar lista de microfones">
            🔄
          </button>
        )}
        <button
          type="button"
          className={micEnabled ? 'icon-button' : 'icon-button is-off'}
          onClick={onToggleMic}
          aria-pressed={!micEnabled}
          aria-label={`${micEnabled ? 'Desligar' : 'Ligar'} ${name.toLowerCase()}`}
        >
          🎙️
        </button>
        {onRemove && (
          <button type="button" className="icon-button" onClick={onRemove} aria-label={`Remover entrada ${position}`}>
            ✕
          </button>
        )}
      </div>

      {tracker.status === 'requesting' && <p className="status-message">Pedindo acesso ao microfone…</p>}
      {tracker.status === 'error' && (
        <p className="status-message" role="alert">
          {tracker.errorMessage === 'Entrada desconectada'
            ? 'Entrada desconectada'
            : `Erro ao acessar o microfone: ${tracker.errorMessage}`}
        </p>
      )}
      {tracker.status === 'listening' && audioInputs.length === 0 && (
        <p className="status-message">🎙️ {tracker.deviceName ?? 'Microfone ativo'}</p>
      )}
      {tracker.status === 'off' && !needsDevice && <p className="status-message">Mic desativado</p>}
      {needsDevice && audioInputs.length === 0 && <p className="status-message">Escolha um dispositivo</p>}

      <div className="wheel-stage">
        <PitchMeter
          ref={wheelRef}
          detectedNote={detected}
          targetMidiNumber={targetMidiNumber}
          micDisconnected={tracker.status === 'error'}
          onNoteClick={onNoteClick}
        />
      </div>
      <div className="waveform-stage">
        <Waveform
          samples={tracker.waveform}
          detectedNote={detected}
          targetMidiNumber={targetMidiNumber}
          micDisconnected={tracker.status === 'error'}
        />
      </div>
    </div>
  );
}
