import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Waveform } from './Waveform';

describe('Waveform', () => {
  it('renders a polyline point for every sample', () => {
    render(
      <Waveform
        samples={[0, 0.5, -0.5, 1, -1]}
        detectedNote={null}
        targetMidiNumber={null}
        micDisconnected={false}
      />
    );
    const trace = screen.getByTestId('waveform-trace');
    const points = trace.getAttribute('points')!.trim().split(' ');
    expect(points.length).toBe(5);
  });

  it('maps sample amplitude to y-coordinates with positive values up, negative down', () => {
    render(
      <Waveform
        samples={[1, -1, 0]}
        detectedNote={null}
        targetMidiNumber={null}
        micDisconnected={false}
      />
    );
    // HEIGHT=80: value=1 -> y=0 (top), value=-1 -> y=80 (bottom), value=0 -> y=40 (middle)
    expect(screen.getByTestId('waveform-trace').getAttribute('points')).toBe('0,0.00 1,80.00 2,40.00');
  });

  it('renders no trace when there are no samples yet', () => {
    render(
      <Waveform samples={[]} detectedNote={null} targetMidiNumber={null} micDisconnected={false} />
    );
    expect(screen.getByTestId('waveform-trace').getAttribute('points')).toBe('');
  });

  it('renders no trace when the mic is disconnected, even with samples buffered', () => {
    render(
      <Waveform
        samples={[0, 0.5, -0.5]}
        detectedNote={null}
        targetMidiNumber={null}
        micDisconnected={true}
      />
    );
    expect(screen.getByTestId('waveform-trace').getAttribute('points')).toBe('');
  });

  it('colors the trace in-tune green when the detected note is close to the target', () => {
    render(
      <Waveform
        samples={[0, 0.1]}
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 3 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    expect(screen.getByTestId('waveform-trace').getAttribute('stroke')).toBe('#2ecc71');
  });

  it('colors the trace off-tune red when the detected note is far from the target', () => {
    render(
      <Waveform
        samples={[0, 0.1]}
        detectedNote={{ noteName: 'A', octave: 4, midiNumber: 69, cents: 40 }}
        targetMidiNumber={69}
        micDisconnected={false}
      />
    );
    expect(screen.getByTestId('waveform-trace').getAttribute('stroke')).toBe('#e74c3c');
  });

  it('uses a neutral color when no note is detected', () => {
    render(
      <Waveform samples={[0, 0.1]} detectedNote={null} targetMidiNumber={null} micDisconnected={false} />
    );
    expect(screen.getByTestId('waveform-trace').getAttribute('stroke')).toBe('#a89e93');
  });
});
