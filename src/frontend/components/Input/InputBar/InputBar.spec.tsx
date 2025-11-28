import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InputBar } from './InputBar';
import { getColor } from '@irdashies/utils/colors';

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

  it('renders an SVG element', () => {
    const { container } = render(
      <InputBar brake={0.5} throttle={0.7} clutch={0.3} settings={settings} />
    );
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
  });

  it('renders the correct number of bars', () => {
    const { container } = render(
      <InputBar brake={0.5} throttle={0.7} clutch={0.3} settings={settings} />
    );
    const rectElements = container.querySelectorAll('rect');
    expect(rectElements.length).toBe(3);
  });
  it('renders text with correct values', () => {
    const { container } = render(
      <InputBar brake={0.5} throttle={0.7} clutch={0.3} settings={settings} />
    );
    const textElements = container.querySelectorAll('text');
    expect(textElements[0].textContent).toBe('30'); // clutch
    expect(textElements[1].textContent).toBe('50'); // brake
    expect(textElements[2].textContent).toBe('70'); // throttle
  });

  it('renders the correct colors', () => {
    const { container } = render(
      <InputBar brake={0.5} throttle={0.7} clutch={0.3} settings={settings} />
    );
    const rectElements = container.querySelectorAll('rect');
    expect(rectElements[0].getAttribute('fill')).toBe(getColor('blue'));
    expect(rectElements[1].getAttribute('fill')).toBe(getColor('red'));
    expect(rectElements[2].getAttribute('fill')).toBe(getColor('green'));
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
    const rectElements = container.querySelectorAll('rect');
    expect(rectElements.length).toBe(2);
  });
});
