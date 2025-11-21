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

  it('renders div text with correct values', () => {
    const { container } = render(
      <InputBar brake={0.5} throttle={0.7} clutch={0.3} settings={settings} />
    );
    const textDivs = container.querySelectorAll('.text-white');
    expect(textDivs[0].textContent).toBe('30'); // clutch
    expect(textDivs[1].textContent).toBe('50'); // brake
    expect(textDivs[2].textContent).toBe('70'); // throttle
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

  it('renders ABS text when brakeAbsActive is true', () => {
    const { container } = render(
      <InputBar brake={0.5} throttle={0.7} clutch={0.3} brakeAbsActive={true} settings={settings} />
    );
    const svgTextElements = container.querySelectorAll('svg text');
    expect(svgTextElements.length).toBe(1);
    expect(svgTextElements[0].textContent).toBe('ABS');
  });

  it('changes brake bar color to yellow when ABS is active', () => {
    const { container } = render(
      <InputBar brake={0.5} throttle={0.7} clutch={0.3} brakeAbsActive={true} settings={settings} />
    );
    const rectElements = container.querySelectorAll('rect');
    expect(rectElements[1].getAttribute('fill')).toBe(getColor('yellow', 500)); // brake bar should be yellow
  });
});
