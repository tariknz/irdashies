import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InputBar } from './InputBar';

const settings = {
  includeBrake: true,
  includeThrottle: true,
  includeClutch: true,
  includeAbs: true,
};

describe('InputBar', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <InputBar brake={0.5} throttle={0.7} clutch={0.3} settings={settings} />
    );
    expect(container).toBeInTheDocument();
  });

  it('renders a container div', () => {
    const { container } = render(
      <InputBar brake={0.5} throttle={0.7} clutch={0.3} settings={settings} />
    );
    const containerDiv = container.firstChild as HTMLElement;
    expect(containerDiv).toBeInTheDocument();
    expect(containerDiv.style.display).toBe('flex');
  });

  it('renders the correct number of bars', () => {
    const { container } = render(
      <InputBar brake={0.5} throttle={0.7} clutch={0.3} settings={settings} />
    );
    const barContainers = Array.from(container.querySelectorAll('[data-testid^="input-bar-"]')).filter(
      (el) => !(el as HTMLElement).getAttribute('data-testid')?.includes('fill')
    );
    expect(barContainers.length).toBe(3);
  });

  it('renders text with correct values', () => {
    const { container } = render(
      <InputBar brake={0.5} throttle={0.7} clutch={0.3} settings={settings} />
    );
    const textElements = Array.from(container.querySelectorAll('div')).filter(
      (el) => el.textContent && /^\d+$/.test(el.textContent.trim())
    );
    expect(textElements.length).toBeGreaterThanOrEqual(3);
    const values = textElements.map((el) => el.textContent?.trim()).filter(Boolean);
    expect(values).toContain('30');
    expect(values).toContain('50');
    expect(values).toContain('70');
  });


  it('renders the throttle and brake bars when includeThrottle and includeBrake are true', () => {
    const { container } = render(
      <InputBar brake={0.5} throttle={0.7} clutch={0.3} settings={{
        includeBrake: true,
        includeThrottle: true,
        includeClutch: false,
        includeAbs: false,
      }} />
    );
    const barContainers = Array.from(container.querySelectorAll('[data-testid^="input-bar-"]')).filter(
      (el) => !(el as HTMLElement).getAttribute('data-testid')?.includes('fill')
    );
    expect(barContainers.length).toBe(2);
  });
});
