// frontend/src/components/InputLane.tsx
import { useEffect, useRef, type Ref } from 'react';
import { usePitchTracker } from '../hooks/usePitchTracker';
import type { AudioInput } from '../hooks/useAudioInputs';
import { PRIMARY_LANE_ID, type InputLaneConfig } from '../lib/inputLanes';
import { isHit } from '../lib/scoring';
import type { NoteInfo } from '../lib/noteUtils';
import type { VisualizationMode } from '../lib/visualization';
import { KeyboardView } from './KeyboardView';
import { PianoRollView } from './PianoRollView';
import { PitchMeter, type NoteNavigatorHandle } from './PitchMeter';
import { TunerView } from './TunerView';
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
  onPlayNote: (midiNumber: number) => void;
  visualization: VisualizationMode;
  /** Lowest key (a C) of the keyboard view. */
  keyboardLowMidi: number;
  wheelRef?: Ref<NoteNavigatorHandle>;
}

const SCORE_TICK_MS = 100;
// The wheel is octave-agnostic, so a clicked bubble previews in this fixed octave (C4-B4).
const WHEEL_OCTAVE_BASE_MIDI = 60;

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
  onPlayNote,
  visualization,
  keyboardLowMidi,
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
  const micDisconnected = tracker.status === 'error';
  const selectedDeviceId = tracker.deviceId ?? lane.deviceId ?? '';
  // An unplugged device isn't listed; without a placeholder the select would show another device's name.
  const deviceMissing = selectedDeviceId !== '' && !audioInputs.some((input) => input.deviceId === selectedDeviceId);

  // One fixed-height slot always renders, so a message never shifts the visualization below it.
  let statusMessage: string | null = null;
  if (tracker.status === 'requesting') statusMessage = 'Pedindo acesso ao microfone…';
  else if (tracker.status === 'error') {
    statusMessage =
      tracker.errorMessage === 'Entrada desconectada'
        ? 'Entrada desconectada'
        : `Erro ao acessar o microfone: ${tracker.errorMessage}`;
  } else if (tracker.status === 'listening' && audioInputs.length === 0) {
    statusMessage = `🎙️ ${tracker.deviceName ?? 'Microfone ativo'}`;
  } else if (tracker.status === 'off' && !needsDevice) statusMessage = 'Mic desativado';
  else if (needsDevice && audioInputs.length === 0) statusMessage = 'Escolha um dispositivo';

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

      <p className="lane-status" role={micDisconnected ? 'alert' : undefined}>
        {statusMessage}
      </p>

      <div className={`view-stage view-${visualization}${visualization === 'wheel' ? ' wheel-stage' : ''}`}>
        {visualization === 'wheel' && (
          <PitchMeter
            ref={wheelRef}
            detectedNote={detected}
            targetMidiNumber={targetMidiNumber}
            micDisconnected={micDisconnected}
            onNoteClick={(pitchClass) => onPlayNote(WHEEL_OCTAVE_BASE_MIDI + pitchClass)}
          />
        )}
        {visualization === 'keyboard' && (
          <KeyboardView
            ref={wheelRef}
            lowMidi={keyboardLowMidi}
            detectedNote={detected}
            targetMidiNumber={targetMidiNumber}
            micDisconnected={micDisconnected}
            onPlayNote={onPlayNote}
          />
        )}
        {visualization === 'tuner' && (
          <TunerView detectedNote={detected} targetMidiNumber={targetMidiNumber} micDisconnected={micDisconnected} />
        )}
        {visualization === 'piano-roll' && (
          <PianoRollView detectedNote={detected} targetMidiNumber={targetMidiNumber} micDisconnected={micDisconnected} />
        )}
      </div>
      <div className="waveform-stage">
        <Waveform
          samples={tracker.waveform}
          detectedNote={detected}
          targetMidiNumber={targetMidiNumber}
          micDisconnected={micDisconnected}
        />
      </div>
    </div>
  );
}
