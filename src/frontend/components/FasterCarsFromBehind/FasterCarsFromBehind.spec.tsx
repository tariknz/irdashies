import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import {
  useActiveSimulator,
  useDrivingState,
  useGeneralSettings,
  useWeekendInfoNumCarClasses,
} from '@irdashies/context';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { FasterCarsFromBehind } from './FasterCarsFromBehind';
import { useCarBehind } from './hooks/useCarBehind';
import { useFasterCarsSettings } from './hooks/useFasterCarsSettings';

const dashboard = vi.hoisted(() => ({ isDemoMode: false }));

vi.mock('@irdashies/context', () => ({
  useDashboard: () => dashboard,
  useSessionVisibility: () => true,
  useWeekendInfoNumCarClasses: vi.fn(),
  useGeneralSettings: vi.fn(),
  useDrivingState: vi.fn(),
  useActiveSimulator: vi.fn(),
}));

vi.mock('./hooks/useFasterCarsSettings');
vi.mock('./hooks/useCarBehind');

const car = {
  carIdx: 1,
  name: 'Following Driver2',
  classColor: 0xffffff,
  className: 'GTP',
  classPosition: 3,
  distance: -0.714,
  percent: 52.4,
  license: 'A 4.2',
  rating: 2400,
  lmuRating: undefined,
  isAI: false,
};

beforeEach(() => {
  dashboard.isDemoMode = false;
  vi.mocked(useDrivingState).mockReturnValue({ isDriving: true });
  vi.mocked(useActiveSimulator).mockReturnValue('iracing');
  vi.mocked(useGeneralSettings).mockReturnValue({ compactMode: 'off' });
  vi.mocked(useWeekendInfoNumCarClasses).mockReturnValue(2);
  vi.mocked(useFasterCarsSettings).mockReturnValue(
    getWidgetDefaultConfig('fastercarsfrombehind')
  );
  vi.mocked(useCarBehind).mockReturnValue([{ ...car }]);
});

describe('FasterCarsFromBehind', () => {
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
      vi.mocked(useCarBehind).mockReturnValue([{ ...car, classColor: color }]);

      render(<FasterCarsFromBehind />);

      const card = screen.getByRole('listitem');
      expect(card.querySelector('span[aria-hidden]')).toHaveClass(expected);
      expect(card).not.toHaveClass(expected);
      expect(card).not.toHaveClass('animate-pulse');
    }
  );

  it('shows the class and its class position in the block', () => {
    render(<FasterCarsFromBehind />);
    const block = screen.getByRole('group', { name: 'GTP, class position 3' });
    expect(within(block).getByText('GTP')).toBeInTheDocument();
    expect(within(block).getByText('P3')).toBeInTheDocument();
  });

  it.each([
    ['Supercars - 2019', 'SUPR'],
    ['Hosted All Cars', 'HAC'],
    ['Ligier JS P320', 'P320'],
    ['Hypercar', 'HYPR'],
    ['Unknown future class with a much longer name', 'UFWA'],
  ])(
    'bounds class label %s and preserves its full accessible name',
    (className, shortLabel) => {
      vi.mocked(useCarBehind).mockReturnValue([{ ...car, className }]);
      render(<FasterCarsFromBehind />);
      const block = screen.getByRole('group', {
        name: `${className}, class position 3`,
      });
      expect(block).toHaveClass('w-[38px]', 'shrink-0', 'overflow-hidden');
      expect(block).toHaveAttribute('title', `${className}, class position 3`);
      expect(within(block).getByText(shortLabel)).toBeInTheDocument();
      expect(screen.getByLabelText('0.7 seconds behind')).toBeInTheDocument();
    }
  );

  it.each([undefined, 0, -1, NaN, 1.5])(
    'uses a placeholder for missing class data and invalid position %s',
    (classPosition) => {
      vi.mocked(useCarBehind).mockReturnValue([
        { ...car, className: ' ', classPosition },
      ]);
      render(<FasterCarsFromBehind />);
      const block = screen.getByRole('group', {
        name: 'Class unavailable, class position unavailable',
      });
      expect(within(block).getAllByText('—')).toHaveLength(2);
      expect(within(block).queryByText(/^P/)).not.toBeInTheDocument();
    }
  );

  it.each([
    ['off', 'h-[33px]', 'gap-1'],
    ['compact', 'h-7', 'gap-[3px]'],
    ['ultra', 'h-6', 'gap-0.5'],
    [undefined, 'h-[33px]', 'gap-1'],
  ] as const)(
    'uses General Settings density %s',
    (compactMode, rowHeight, spacing) => {
      vi.mocked(useGeneralSettings).mockReturnValue({ compactMode });
      render(<FasterCarsFromBehind />);
      expect(screen.getByRole('list')).toHaveClass(spacing);
      expect(screen.getByRole('listitem').firstElementChild).toHaveClass(
        rowHeight
      );
    }
  );

  it('keeps sub-percent bar movement while the displayed tenth stays the same', () => {
    const { rerender } = render(<FasterCarsFromBehind />);
    const bar =
      screen.getByRole('listitem').lastElementChild?.firstElementChild;
    expect(bar).toHaveStyle({ transform: 'scaleX(0.524)' });
    expect(screen.getByLabelText('0.7 seconds behind')).toHaveTextContent(
      '−0.7'
    );

    vi.mocked(useCarBehind).mockReturnValue([
      { ...car, distance: -0.711, percent: 52.6 },
    ]);
    rerender(<FasterCarsFromBehind />);
    expect(bar).toHaveStyle({ transform: 'scaleX(0.526)' });
    expect(bar).toHaveClass('duration-200', 'motion-reduce:transition-none');
    expect(screen.getByLabelText('0.7 seconds behind')).toHaveTextContent(
      '−0.7'
    );
  });

  it.each([
    [-10, 'scaleX(0)'],
    [110, 'scaleX(1)'],
    [NaN, 'scaleX(0)'],
  ])('bounds an invalid proximity value %s', (percent, transform) => {
    vi.mocked(useCarBehind).mockReturnValue([{ ...car, percent }]);
    render(<FasterCarsFromBehind />);
    expect(
      screen.getByRole('listitem').lastElementChild?.firstElementChild
    ).toHaveStyle({ transform });
  });

  it('uses a steady warning for a very close car', () => {
    vi.mocked(useCarBehind).mockReturnValue([{ ...car, distance: -0.3 }]);
    render(<FasterCarsFromBehind />);
    expect(screen.getByLabelText('0.3 seconds behind')).toHaveClass(
      'text-red-300'
    );
    expect(screen.getByRole('listitem')).not.toHaveClass('animate-pulse');
  });

  it('retains bottom alignment and highlights the nearest car when reversed', () => {
    vi.mocked(useFasterCarsSettings).mockReturnValue({
      ...getWidgetDefaultConfig('fastercarsfrombehind'),
      closestDriverBox: 'Reverse',
      alignDriverBoxes: 'Bottom',
    });
    vi.mocked(useCarBehind).mockReturnValue([
      car,
      { ...car, carIdx: 2, name: 'Further Driver', distance: -1.2 },
    ]);
    render(<FasterCarsFromBehind />);
    expect(screen.getByRole('list')).toHaveClass('justify-end');
    const cards = screen.getAllByRole('listitem');
    expect(within(cards[0]).getByText('Further Driver')).toBeInTheDocument();
    expect(within(cards[1]).getByText(car.name)).toBeInTheDocument();
    expect(cards[1]).toHaveClass('bg-settings-control');
  });

  it('respects name cleanup and optional badge and gap visibility', () => {
    vi.mocked(useFasterCarsSettings).mockReturnValue({
      ...getWidgetDefaultConfig('fastercarsfrombehind'),
      removeNumbersFromName: true,
      showBadge: true,
      badgeFormat: 'rating-bw-no-license',
      showDistance: false,
    });
    const { unmount } = render(<FasterCarsFromBehind />);
    expect(screen.getByText('Following Driver')).toBeInTheDocument();
    expect(screen.getByText('2.4k')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('0.7 seconds behind')
    ).not.toBeInTheDocument();
    unmount();

    vi.mocked(useFasterCarsSettings).mockReturnValue({
      ...getWidgetDefaultConfig('fastercarsfrombehind'),
      showName: false,
      showBadge: false,
    });
    render(<FasterCarsFromBehind />);
    expect(screen.queryByText(/Following Driver/)).not.toBeInTheDocument();
    expect(screen.queryByText('2.4k')).not.toBeInTheDocument();
    expect(screen.getByLabelText('0.7 seconds behind')).toBeInTheDocument();
  });

  it('hides when no faster cars are nearby', () => {
    vi.mocked(useCarBehind).mockReturnValue([]);
    const { container } = render(<FasterCarsFromBehind />);
    expect(container).toBeEmptyDOMElement();
  });

  describe('display order', () => {
    const withOrder = (displayOrder: string[], showName = true) =>
      vi.mocked(useFasterCarsSettings).mockReturnValue({
        ...getWidgetDefaultConfig('fastercarsfrombehind'),
        showName,
        showBadge: true,
        badgeFormat: 'rating-bw-no-license',
        displayOrder,
      });

    it('shows name, badge and gap in the default order', () => {
      withOrder(['driverName', 'badge', 'distance']);
      render(<FasterCarsFromBehind />);
      expect(screen.getByRole('listitem').textContent).toMatch(
        /Following Driver2.*2\.4k.*−0\.7s$/
      );
    });

    it('follows a saved order', () => {
      withOrder(['distance', 'badge', 'driverName']);
      render(<FasterCarsFromBehind />);
      const row = screen.getByRole('listitem').firstElementChild;
      expect(row?.textContent).toMatch(/P3−0\.7s2\.4kFollowing Driver2$/);
      expect(screen.getByText('Following Driver2').parentElement).toHaveClass(
        'flex-1'
      );
      expect(screen.getByLabelText('0.7 seconds behind')).toBe(
        row?.children[1]
      );
    });

    it('keeps the gap on the right when the name is hidden', () => {
      withOrder(['badge', 'driverName', 'distance'], false);
      render(<FasterCarsFromBehind />);
      const row = screen.getByRole('listitem').firstElementChild;
      const gap = screen.getByLabelText('0.7 seconds behind');
      expect(row?.lastElementChild).toBe(gap);
      expect(gap.previousElementSibling).toHaveClass('flex-1');
      expect(gap.previousElementSibling).toHaveTextContent('2.4k');
    });
  });

  describe('rating badge', () => {
    const lmuCar = {
      ...car,
      license: '',
      rating: 0,
    };

    beforeEach(() => {
      vi.mocked(useFasterCarsSettings).mockReturnValue({
        ...getWidgetDefaultConfig('fastercarsfrombehind'),
        showBadge: true,
        badgeFormat: 'rating-bw-no-license',
      });
    });

    it('shows the LMU rank under LMU', () => {
      vi.mocked(useActiveSimulator).mockReturnValue('lmu');
      vi.mocked(useCarBehind).mockReturnValue([
        { ...lmuCar, lmuRating: { driverRank: 'Gold', driverTier: 3 } },
      ]);
      render(<FasterCarsFromBehind />);
      expect(screen.getByTitle('Driver rating: Gold 3')).toBeInTheDocument();
      expect(screen.queryByText('AI')).not.toBeInTheDocument();
    });

    it('shows no badge for an LMU driver whose rank has not arrived', () => {
      vi.mocked(useActiveSimulator).mockReturnValue('lmu');
      vi.mocked(useCarBehind).mockReturnValue([
        { ...lmuCar, lmuRating: { countryCode: 'FR' } },
      ]);
      render(<FasterCarsFromBehind />);
      expect(screen.getByText(car.name)).toBeInTheDocument();
      expect(screen.queryByText('AI')).not.toBeInTheDocument();
      expect(screen.queryByTitle(/rating/)).not.toBeInTheDocument();
    });

    it('names an LMU AI entry as one', () => {
      vi.mocked(useActiveSimulator).mockReturnValue('lmu');
      vi.mocked(useCarBehind).mockReturnValue([{ ...lmuCar, isAI: true }]);
      render(<FasterCarsFromBehind />);
      expect(screen.getByText('AI')).toBeInTheDocument();
    });

    it('keeps the iRacing badge and AI placeholder under iRacing', () => {
      vi.mocked(useCarBehind).mockReturnValue([
        car,
        { ...car, carIdx: 2, name: 'iRacing AI', license: '', rating: 0 },
      ]);
      render(<FasterCarsFromBehind />);
      const [human, ai] = screen.getAllByRole('listitem');
      expect(within(human).getByText('2.4k')).toBeInTheDocument();
      expect(within(ai).getByText('AI')).toBeInTheDocument();
    });

    it('shows iRacing-style sample badges in demo mode under LMU', () => {
      dashboard.isDemoMode = true;
      vi.mocked(useActiveSimulator).mockReturnValue('lmu');
      render(<FasterCarsFromBehind />);
      const [first] = screen.getAllByRole('listitem');
      expect(within(first).getByText('Tarik Alani')).toBeInTheDocument();
      expect(within(first).getByText('1.2k')).toBeInTheDocument();
    });
  });

  describe('show only when on track', () => {
    const withSetting = (showOnlyWhenOnTrack: boolean) =>
      vi.mocked(useFasterCarsSettings).mockReturnValue({
        ...getWidgetDefaultConfig('fastercarsfrombehind'),
        showOnlyWhenOnTrack,
      });

    it('hides while not driving', () => {
      withSetting(true);
      vi.mocked(useDrivingState).mockReturnValue({ isDriving: false });
      const { container } = render(<FasterCarsFromBehind />);
      expect(container).toBeEmptyDOMElement();
    });

    it('shows while driving', () => {
      withSetting(true);
      render(<FasterCarsFromBehind />);
      expect(screen.getByRole('listitem')).toBeInTheDocument();
    });

    it('shows while not driving when the setting is off', () => {
      withSetting(false);
      vi.mocked(useDrivingState).mockReturnValue({ isDriving: false });
      render(<FasterCarsFromBehind />);
      expect(screen.getByRole('listitem')).toBeInTheDocument();
    });

    it('keeps showing sample cars in demo mode', () => {
      withSetting(true);
      dashboard.isDemoMode = true;
      vi.mocked(useDrivingState).mockReturnValue({ isDriving: false });
      render(<FasterCarsFromBehind />);
      expect(screen.getByText('Tarik Alani')).toBeInTheDocument();
    });
  });
});
