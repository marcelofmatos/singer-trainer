import { useEffect, useRef } from 'react';
import { SHORTCUT_HELP } from '../lib/keyboardShortcuts';

export interface KeyboardHelpProps {
  open: boolean;
  onClose: () => void;
}

/** Native modal <dialog> (focus trap and Esc come for free) listing the keyboard shortcuts. */
export function KeyboardHelp({ open, onClose }: KeyboardHelpProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="keyboard-help"
      aria-labelledby="keyboard-help-title"
      onClose={onClose}
    >
      <h2 id="keyboard-help-title" className="keyboard-help-title">
        Atalhos de teclado
      </h2>
      <table className="keyboard-help-table">
        <tbody>
          {SHORTCUT_HELP.map(({ keys, description }) => (
            <tr key={keys}>
              <th scope="row">
                <kbd>{keys}</kbd>
              </th>
              <td>{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="keyboard-help-close" onClick={onClose}>
        Fechar
      </button>
    </dialog>
  );
}
