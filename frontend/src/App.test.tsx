// frontend/src/App.test.tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('shows the speed control next to the exercise selector', () => {
    render(<App />);
    const toolbar = screen.getByRole('toolbar', { name: 'Opções do exercício' });
    expect(within(toolbar).getByLabelText('Exercício')).toBeDefined();
    expect(within(toolbar).getByRole('slider', { name: /velocidade/i })).toBeDefined();
    expect(within(toolbar).getByRole('combobox', { name: 'Visualização' })).toBeDefined();
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

  it('goes to the next exercise with PageDown and wraps from the last to the first', () => {
    render(<App />);
    fireEvent.keyDown(document.body, { key: 'PageDown' });
    expect(screen.getByRole('heading', { name: BUILTIN_EXERCISES[1].name })).toBeDefined();

    const last = BUILTIN_EXERCISES[BUILTIN_EXERCISES.length - 1];
    fireEvent.change(screen.getByLabelText('Exercício'), { target: { value: last.id } });
    fireEvent.keyDown(document.body, { key: ']' });
    expect(screen.getByRole('heading', { name: BUILTIN_EXERCISES[0].name })).toBeDefined();
  });

  it('goes to the previous exercise with PageUp and wraps from the first to the last', () => {
    render(<App />);
    fireEvent.keyDown(document.body, { key: 'PageUp' });
    const last = BUILTIN_EXERCISES[BUILTIN_EXERCISES.length - 1];
    expect(screen.getByRole('heading', { name: last.name })).toBeDefined();

    fireEvent.keyDown(document.body, { key: '[' });
    expect(screen.getByRole('heading', { name: BUILTIN_EXERCISES[BUILTIN_EXERCISES.length - 2].name })).toBeDefined();
  });
});
