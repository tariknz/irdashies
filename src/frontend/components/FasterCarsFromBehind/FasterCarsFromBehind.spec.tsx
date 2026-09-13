import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import { useWeekendInfoNumCarClasses } from '@irdashies/context';
import { FasterCarsFromBehind } from './FasterCarsFromBehind';

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ isDemoMode: false }),
  useSessionVisibility: () => true,
  useWeekendInfoNumCarClasses: vi.fn(),
}));

vi.mock('./hooks/useFasterCarsSettings', () => ({
  useFasterCarsSettings: () => ({ showName: true }),
}));

const car = vi.hoisted(() => ({
  carIdx: 1,
  name: 'Following Driver',
  classColor: 0xffffff,
}));

vi.mock('./hooks/useCarBehind', () => ({
  useCarBehind: () => [car],
}));

describe('FasterCarsFromBehind colours', () => {
  it.each([
    [1, 0xffffff, 'bg-sky-500'],
    [1, 0xffda59, 'bg-sky-500'],
    [undefined, 0xffffff, 'bg-sky-500'],
    [2, 0xffda59, 'bg-yellow-500'],
    [2, 0x33ceff, 'bg-blue-500'],
    [2, 0xffffff, 'bg-stone-500'],
  ])(
    'uses %s classes and colour %s to render %s',
    (classes, color, expected) => {
      vi.mocked(useWeekendInfoNumCarClasses).mockReturnValue(classes);
      car.classColor = color;

      render(<FasterCarsFromBehind />);

      const box = screen.getByText('Following Driver').closest('.w-full');
      expect(box).toHaveClass(expected);
    }
  );
});
