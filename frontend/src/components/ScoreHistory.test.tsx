// frontend/src/components/ScoreHistory.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ScoreHistory } from './ScoreHistory';
import type { ScoreRecord } from '../lib/scoreHistory';

function record(overrides: Partial<ScoreRecord>): ScoreRecord {
  return {
    exerciseId: 'escala-maior',
    exerciseName: 'Escala Maior',
    finishedAt: Date.UTC(2026, 9, 22, 15, 0),
    playbackRate: 1,
    targetSeconds: 10,
    hitSeconds: 5,
    ...overrides,
  };
}

function handlers() {
  return { onResetSession: vi.fn(), onClearHistory: vi.fn() };
}

describe('ScoreHistory', () => {
  it('is not shown while closed', () => {
    render(<ScoreHistory open={false} onClose={() => {}} {...handlers()} history={[]} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says there is nothing yet when the history is empty', () => {
    render(<ScoreHistory open onClose={() => {}} {...handlers()} history={[]} />);
    expect(screen.getByRole('dialog', { name: 'Histórico de pontuação' }).textContent).toContain(
      'Nenhuma passada completa ainda.'
    );
  });

  it('lists the latest passes newest first, with time in tune and percentage', () => {
    render(
      <ScoreHistory
        open
        onClose={() => {}}
        {...handlers()}
        history={[
          record({ exerciseName: 'Escala Maior', finishedAt: 1, hitSeconds: 5 }),
          record({ exerciseId: 'arpejo', exerciseName: 'Arpejo Maior', finishedAt: 2, hitSeconds: 9, inputLabel: 'Monitor', inputId: 'lane-2' }),
        ]}
      />
    );
    const rows = within(screen.getByRole('table', { name: 'Últimas passadas' })).getAllByRole('row').slice(1);
    expect(screen.getByRole('table', { name: 'Últimas passadas' }).textContent).toContain('Entrada');
    expect(rows[0].textContent).toContain('Arpejo Maior');
    expect(rows[0].textContent).toContain('Monitor');
    expect(rows[0].textContent).toContain('9,0 s');
    expect(rows[0].textContent).toContain('90%');
    expect(rows[1].textContent).toContain('Escala Maior');
  });

  it('shows the best percentage per exercise', () => {
    render(
      <ScoreHistory
        open
        onClose={() => {}}
        {...handlers()}
        history={[record({ hitSeconds: 5 }), record({ hitSeconds: 8 })]}
      />
    );
    const records = screen.getByRole('table', { name: 'Recordes' });
    expect(records.textContent).toContain('Escala Maior');
    expect(records.textContent).toContain('80%');
  });

  it('lists records per input', () => {
    render(
      <ScoreHistory
        open
        onClose={() => {}}
        {...handlers()}
        history={[record({ hitSeconds: 8 }), record({ inputId: 'lane-2', inputLabel: 'Monitor', hitSeconds: 2 })]}
      />
    );
    const records = screen.getByRole('table', { name: 'Recordes' });
    expect(records.textContent).toContain('Escala Maior · Monitor');
    expect(records.textContent).toContain('20%');
  });

  it('shows the free exercise hit rate per note and input', () => {
    const tallies = (pitchClass: number, target: number, hit: number) =>
      Array.from({ length: 12 }, (_, index) =>
        index === pitchClass ? { targetSeconds: target, hitSeconds: hit } : { targetSeconds: 0, hitSeconds: 0 }
      );
    render(
      <ScoreHistory
        open
        onClose={() => {}}
        {...handlers()}
        history={[
          record({ exerciseId: 'livre', exerciseName: 'Exercício livre', noteTallies: tallies(9, 10, 8) }),
          record({
            exerciseId: 'livre',
            exerciseName: 'Exercício livre',
            inputId: 'lane-2',
            inputLabel: 'Headset',
            noteTallies: tallies(0, 4, 1),
          }),
        ]}
      />
    );
    const table = screen.getByRole('table', { name: 'Exercício livre — acerto por nota' });
    const [header, ...rows] = within(table).getAllByRole('row');
    expect(within(header).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Entrada', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
    ]);
    expect(rows).toHaveLength(2);
    const micCells = within(rows[0]).getAllByRole('cell').map((cell) => cell.textContent);
    expect(within(rows[0]).getByRole('rowheader').textContent).toBe('Microfone');
    expect(micCells[9]).toBe('80%');
    expect(micCells[0]).toBe('—');
    expect(within(rows[1]).getByRole('rowheader').textContent).toBe('Headset');
    expect(within(rows[1]).getAllByRole('cell')[0].textContent).toBe('25%');
  });

  it('has no per-note table without free exercise records', () => {
    render(<ScoreHistory open onClose={() => {}} {...handlers()} history={[record({})]} />);
    expect(screen.queryByRole('table', { name: 'Exercício livre — acerto por nota' })).toBeNull();
  });

  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(<ScoreHistory open onClose={onClose} {...handlers()} history={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    ['Zerar sessão', 'Confirmar: zerar sessão?', 'onResetSession'],
    ['Apagar histórico', 'Confirmar: apagar histórico?', 'onClearHistory'],
  ] as const)('"%s" asks for a second click before acting', (label, confirmLabel, callback) => {
    const props = handlers();
    render(<ScoreHistory open onClose={() => {}} {...props} history={[record({})]} />);
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(props[callback]).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: confirmLabel }));
    expect(props[callback]).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: label })).toBeDefined();
  });

  it('disarms a pending confirmation when the dialog closes', () => {
    const props = handlers();
    const { rerender } = render(<ScoreHistory open onClose={() => {}} {...props} history={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apagar histórico' }));
    rerender(<ScoreHistory open={false} onClose={() => {}} {...props} history={[]} />);
    rerender(<ScoreHistory open onClose={() => {}} {...props} history={[]} />);
    expect(screen.getByRole('button', { name: 'Apagar histórico' })).toBeDefined();
  });

  it('closes when the backdrop outside the dialog is clicked, but not from inside it', () => {
    const onClose = vi.fn();
    render(<ScoreHistory open onClose={onClose} {...handlers()} history={[]} />);
    const dialog = screen.getByRole('dialog', { name: 'Histórico de pontuação' });
    fireEvent.click(within(dialog).getByText('Nenhuma passada completa ainda.'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalled();
  });
});
