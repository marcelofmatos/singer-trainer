// frontend/src/App.test.tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { BUILTIN_EXERCISES } from './lib/exercises';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists every built-in exercise as an option in the dropdown', () => {
    render(<App />);
    const select = screen.getByLabelText('Exercício');
    expect(select.tagName).toBe('SELECT');
    BUILTIN_EXERCISES.forEach((exercise) => {
      expect(screen.getByRole('option', { name: exercise.name })).toBeDefined();
    });
  });

  it('shows the first exercise selected and displayed by default', () => {
    render(<App />);
    const select = screen.getByLabelText('Exercício') as HTMLSelectElement;
    expect(select.value).toBe(BUILTIN_EXERCISES[0].id);
    expect(screen.getByRole('heading', { name: BUILTIN_EXERCISES[0].name })).toBeDefined();
  });

  it('switches the displayed exercise when a different option is selected', () => {
    render(<App />);
    const secondExercise = BUILTIN_EXERCISES[1];
    fireEvent.change(screen.getByLabelText('Exercício'), { target: { value: secondExercise.id } });
    expect(screen.getByRole('heading', { name: secondExercise.name })).toBeDefined();
  });

  it('renders the chromatic wheel with all 12 note bubbles for the active exercise', () => {
    render(<App />);
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((name) => {
      expect(screen.getByTestId(`note-bubble-${name}`)).toBeDefined();
    });
  });

  it('persists the selected exercise to localStorage and restores it on remount', () => {
    const first = render(<App />);
    const thirdExercise = BUILTIN_EXERCISES[2];
    fireEvent.change(screen.getByLabelText('Exercício'), { target: { value: thirdExercise.id } });
    expect(localStorage.getItem('singer-trainer:last-exercise-id')).toBe(thirdExercise.id);

    first.unmount();
    render(<App />);
    const restoredSelect = screen.getByLabelText('Exercício') as HTMLSelectElement;
    expect(restoredSelect.value).toBe(thirdExercise.id);
  });
});
