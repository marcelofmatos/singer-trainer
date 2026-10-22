import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScoreBoard } from './ScoreBoard';

const ROWS = [
  {
    laneId: 'primary',
    label: 'USB Composite Device Mono',
    session: { targetSeconds: 60, hitSeconds: 48.2 },
    overall: { targetSeconds: 1000, hitSeconds: 725 },
  },
  {
    laneId: 'lane-2',
    label: 'Monitor of JBL',
    session: { targetSeconds: 10, hitSeconds: 1 },
    overall: { targetSeconds: 10, hitSeconds: 1 },
  },
];

describe('ScoreBoard', () => {
  it('shows one row per input with session and overall time in tune and percentage', () => {
    render(<ScoreBoard rows={ROWS} onOpenHistory={() => {}} />);
    const board = screen.getByRole('button', { name: 'Pontuação — abrir histórico' });
    expect(board.textContent).toContain('Sessão');
    expect(board.textContent).toContain('Geral');
    expect(board.textContent).toContain('USB Composite Device Mono');
    expect(screen.getByTestId('score-session-time-primary').textContent).toBe('48,2 s');
    expect(screen.getByTestId('score-session-percent-primary').textContent).toBe('80%');
    expect(screen.getByTestId('score-overall-time-primary').textContent).toBe('12 min 05 s');
    expect(screen.getByTestId('score-overall-percent-primary').textContent).toBe('73%');
    expect(screen.getByTestId('score-session-percent-lane-2').textContent).toBe('10%');
  });

  it('opens the history when clicked', () => {
    const onOpenHistory = vi.fn();
    render(<ScoreBoard rows={ROWS} onOpenHistory={onOpenHistory} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pontuação — abrir histórico' }));
    expect(onOpenHistory).toHaveBeenCalled();
  });
});
