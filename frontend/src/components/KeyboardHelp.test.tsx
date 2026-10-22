import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { KeyboardHelp } from './KeyboardHelp';
import { SHORTCUT_HELP } from '../lib/keyboardShortcuts';

describe('KeyboardHelp', () => {
  it('is not shown while closed', () => {
    render(<KeyboardHelp open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lists every shortcut when open', () => {
    render(<KeyboardHelp open onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Atalhos de teclado' });
    SHORTCUT_HELP.forEach(({ keys, description }) => {
      expect(dialog.textContent).toContain(keys);
      expect(dialog.textContent).toContain(description);
    });
  });

  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(<KeyboardHelp open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the dialog closes on its own (Esc)', () => {
    const onClose = vi.fn();
    render(<KeyboardHelp open onClose={onClose} />);
    (screen.getByRole('dialog') as HTMLDialogElement).close();
    expect(onClose).toHaveBeenCalled();
  });
});
