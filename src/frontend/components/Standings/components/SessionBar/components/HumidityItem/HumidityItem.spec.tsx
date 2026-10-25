import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSessionBarSnapshot } from '@irdashies/context';
import type { SessionBarSnapshot } from '@irdashies/types';
import { HumidityItem } from './HumidityItem';

vi.mock('@irdashies/context', () => ({
  useSessionBarSnapshot: vi.fn(),
}));

describe('HumidityItem', () => {
  it.each([
    [0, '0%'],
    [0.45, '45%'],
    [0.614, '61%'],
    [0.616, '62%'],
    [1, '100%'],
    [undefined, '- %'],
    [null, '- %'],
    [NaN, '- %'],
    [Infinity, '- %'],
    [-0.1, '- %'],
    [1.1, '- %'],
  ])('displays humidity %s as %s', (relativeHumidity, expected) => {
    vi.mocked(useSessionBarSnapshot).mockReturnValue({
      relativeHumidity,
    } as SessionBarSnapshot);
    const view = render(
      <HumidityItem settings={undefined} standalone={false} />
    );
    expect(view.container.textContent).toBe(expected);
    expect(view.getByTitle('Humidity')).toBeTruthy();
  });

  it('shows an unavailable value before receiving telemetry', () => {
    vi.mocked(useSessionBarSnapshot).mockReturnValue(undefined);
    const view = render(<HumidityItem settings={undefined} standalone />);
    expect(view.container.textContent).toBe('- %');
  });
});
