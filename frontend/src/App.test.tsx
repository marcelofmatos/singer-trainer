// frontend/src/App.test.tsx
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { BUILTIN_EXERCISES } from './lib/exercises';

describe('App', () => {
  it('lists every built-in exercise as a tab', () => {
    render(<App />);
    BUILTIN_EXERCISES.forEach((exercise) => {
      expect(screen.getByRole('tab', { name: exercise.name })).toBeDefined();
    });
  });

  it('shows the first exercise selected and displayed by default', () => {
    render(<App />);
    const firstTab = screen.getByRole('tab', { name: BUILTIN_EXERCISES[0].name });
    expect(firstTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('heading', { name: BUILTIN_EXERCISES[0].name })).toBeDefined();
  });

  it('switches the displayed exercise when a different tab is clicked', () => {
    render(<App />);
    const secondExercise = BUILTIN_EXERCISES[1];
    fireEvent.click(screen.getByRole('tab', { name: secondExercise.name }));
    expect(
      screen.getByRole('tab', { name: secondExercise.name }).getAttribute('aria-selected')
    ).toBe('true');
    expect(screen.getByRole('heading', { name: secondExercise.name })).toBeDefined();
  });

  it('renders the chromatic wheel with all 12 note bubbles for the active exercise', () => {
    render(<App />);
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((name) => {
      expect(screen.getByTestId(`note-bubble-${name}`)).toBeDefined();
    });
  });
});
