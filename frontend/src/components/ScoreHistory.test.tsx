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

describe('ScoreHistory', () => {
  it('is not shown while closed', () => {
    render(<ScoreHistory open={false} onClose={() => {}} history={[]} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says there is nothing yet when the history is empty', () => {
    render(<ScoreHistory open onClose={() => {}} history={[]} />);
    expect(screen.getByRole('dialog', { name: 'Histórico de pontuação' }).textContent).toContain(
      'Nenhuma passada completa ainda.'
    );
  });

  it('lists the latest passes newest first, with time in tune and percentage', () => {
    render(
      <ScoreHistory
        open
        onClose={() => {}}
        history={[
          record({ exerciseName: 'Escala Maior', finishedAt: 1, hitSeconds: 5 }),
          record({ exerciseId: 'arpejo', exerciseName: 'Arpejo Maior', finishedAt: 2, hitSeconds: 9 }),
        ]}
      />
    );
    const rows = within(screen.getByRole('table', { name: 'Últimas passadas' })).getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('Arpejo Maior');
    expect(rows[0].textContent).toContain('9,0 s');
    expect(rows[0].textContent).toContain('90%');
    expect(rows[1].textContent).toContain('Escala Maior');
  });

  it('shows the best percentage per exercise', () => {
    render(
      <ScoreHistory
        open
        onClose={() => {}}
        history={[record({ hitSeconds: 5 }), record({ hitSeconds: 8 })]}
      />
    );
    const records = screen.getByRole('table', { name: 'Recordes' });
    expect(records.textContent).toContain('Escala Maior');
    expect(records.textContent).toContain('80%');
  });

  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(<ScoreHistory open onClose={onClose} history={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
