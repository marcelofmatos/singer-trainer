// frontend/src/components/ScoreBoard.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScoreBoard } from './ScoreBoard';

describe('ScoreBoard', () => {
  it('shows the session and overall time in tune and hit percentage', () => {
    render(
      <ScoreBoard
        session={{ targetSeconds: 60, hitSeconds: 48.2 }}
        overall={{ targetSeconds: 1000, hitSeconds: 725 }}
        onOpenHistory={() => {}}
      />
    );
    const board = screen.getByRole('button', { name: 'Pontuação — abrir histórico' });
    expect(board.textContent).toContain('Sessão');
    expect(board.textContent).toContain('Geral');
    expect(screen.getByTestId('score-session-time').textContent).toBe('48,2 s');
    expect(screen.getByTestId('score-session-percent').textContent).toBe('80%');
    expect(screen.getByTestId('score-overall-time').textContent).toBe('12 min 05 s');
    expect(screen.getByTestId('score-overall-percent').textContent).toBe('73%');
  });

  it('opens the history when clicked', () => {
    const onOpenHistory = vi.fn();
    render(
      <ScoreBoard
        session={{ targetSeconds: 0, hitSeconds: 0 }}
        overall={{ targetSeconds: 0, hitSeconds: 0 }}
        onOpenHistory={onOpenHistory}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pontuação — abrir histórico' }));
    expect(onOpenHistory).toHaveBeenCalled();
  });
});
