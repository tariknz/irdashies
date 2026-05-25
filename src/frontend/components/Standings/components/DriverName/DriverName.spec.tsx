import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DriverNameView } from './DriverNameView';
import { extractDriverName } from './DriverName';

describe('extractDriverName', () => {
  it('handles non-string fullName (numeric YAML scalar)', () => {
    // iRacing session YAML can parse an all-digit handle as a number
    expect(() => extractDriverName(12345 as unknown as string)).not.toThrow();
    expect(extractDriverName(12345 as unknown as string)).toEqual({
      firstName: '12345',
      middleName: null,
      surname: '',
    });
  });

  it('handles null fullName', () => {
    expect(extractDriverName(null as unknown as string)).toEqual({
      firstName: '',
      middleName: null,
      surname: '',
    });
  });

  it('handles non-Latin names with a digit suffix', () => {
    expect(extractDriverName('畅 谭2')).toEqual({
      firstName: '畅',
      middleName: null,
      surname: '谭2',
    });
  });
});

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

    expect(container.textContent).toBe('Charles Marc Hervé Perceval Leclerc');
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

  // every driver should have a name but you never know. Delete it if you think it's useless

  it('handles empty fullName', () => {
    const { container } = render(
      <DriverNameView fullName="" format="name-surname" />
    );

    expect(container.textContent).toBe('');
  });

  // tests for drivers with single name

  it('renders single name, name-surname format', () => {
    const { container } = render(
      <DriverNameView fullName="Max" format="name-surname" />
    );

    expect(container.textContent).toBe('Max');
  });

  it('renders single name, name-middlename-surname format', () => {
    const { container } = render(
      <DriverNameView fullName="Max" format="name-middlename-surname" />
    );

    expect(container.textContent).toBe('Max');
  });

  it('renders single name, name-m.-surname format', () => {
    const { container } = render(
      <DriverNameView fullName="Max" format="name-m.-surname" />
    );

    expect(container.textContent).toBe('Max');
  });

  it('renders single name, n.-surname format', () => {
    const { container } = render(
      <DriverNameView fullName="Max" format="n.-surname" />
    );

    expect(container.textContent).toBe('Max');
  });

  it('renders single name, surname-n. format', () => {
    const { container } = render(
      <DriverNameView fullName="Max" format="surname-n." />
    );

    expect(container.textContent).toBe('Max');
  });

  it('renders single name, surname format', () => {
    const { container } = render(
      <DriverNameView fullName="Max" format="surname" />
    );

    expect(container.textContent).toBe('Max');
  });
});
