import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DriverNameView } from './DriverNameView';

describe('DriverNameView', () => {
  it('renders name-surname format', () => {
    const { container } = render(
      <DriverNameView
        fullName="Charles Marc Hervé Perceval Leclerc"
        format="name-surname"
      />
    );

    expect(container.textContent).toBe('Charles Leclerc');
  });

  it('renders name-middlename-surname format', () => {
    const { container } = render(
      <DriverNameView
        fullName="Charles Marc Hervé Perceval Leclerc"
        format="name-middlename-surname"
      />
    );

    expect(container.textContent).toBe(
      'Charles Marc Hervé Perceval Leclerc'
    );
  });

  it('renders name-m.-surname format', () => {
    const { container } = render(
      <DriverNameView
        fullName="Charles Marc Hervé Perceval Leclerc"
        format="name-m.-surname"
      />
    );

    expect(container.textContent).toBe('Charles M. Leclerc');
  });

  it('renders n.-surname format', () => {
    const { container } = render(
      <DriverNameView
        fullName="Charles Marc Hervé Perceval Leclerc"
        format="n.-surname"
      />
    );

    expect(container.textContent).toBe('C. Leclerc');
  });

  it('renders surname only', () => {
    const { container } = render(
      <DriverNameView
        fullName="Charles Marc Hervé Perceval Leclerc"
        format="surname"
      />
    );

    expect(container.textContent).toBe('Leclerc');
  });

  it('handles empty fullName', () => {
    const { container } = render(
      <DriverNameView
        fullName=""
        format="name-surname"
      />
    );

    expect(container.textContent).toBe('');
  });
});
