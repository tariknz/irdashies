import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LmuRatingBadge, lmuRankLabel } from './LmuRatingBadge';
import type { LmuBadgeFormat } from '@irdashies/types';

/**
 * What an LMU driver's ranks actually look like in a standings row.
 *
 * Two chips, driver rank then safety rank, each the rank's initial and its
 * tier. The ranks are free text from the rating service and the tier is a
 * number beside them, so the label is the one place that turns a pair like
 * ('Bronze', 3) into something that fits a table cell.
 */
describe('lmuRankLabel', () => {
  it('abbreviates a tiered rank to its initial and tier', () => {
    expect(lmuRankLabel('Bronze', 3)).toBe('B3');
    expect(lmuRankLabel('Silver', 2)).toBe('S2');
    expect(lmuRankLabel('Gold', 1)).toBe('G1');
    expect(lmuRankLabel('Platinum', 3)).toBe('P3');
  });

  it('spells Pro out, since it has no tier', () => {
    expect(lmuRankLabel('Pro')).toBe('PRO');
    // A tier alongside Pro is ignored rather than printed.
    expect(lmuRankLabel('Pro', 2)).toBe('PRO');
  });

  it('falls back to the bare initial when the tier is missing', () => {
    // Better than printing a zero, which would read as a real tier.
    expect(lmuRankLabel('Bronze')).toBe('B');
    expect(lmuRankLabel('Silver', 0)).toBe('S');
  });
});

describe('LmuRatingBadge', () => {
  it('shows the driver rank then the safety rank', () => {
    // The pair observed live: driverRank Bronze 3, safetyRank Silver 2.
    const { container } = render(
      <LmuRatingBadge
        rating={{
          driverRank: 'Bronze',
          driverTier: 3,
          safetyRank: 'Silver',
          safetyTier: 2,
        }}
        format="chip-both"
      />
    );

    expect(container.textContent).toBe('B3S2');
  });

  it('names which rank is which in the tooltips', () => {
    // Two chips can read the same -- a driver Silver 2 and a safety Silver 2
    // are both 'S2' -- so order and these titles are what tell them apart.
    const { container } = render(
      <LmuRatingBadge
        rating={{
          driverRank: 'Silver',
          driverTier: 2,
          safetyRank: 'Silver',
          safetyTier: 2,
        }}
        format="chip-both"
      />
    );

    const titles = [...container.querySelectorAll('[title]')].map((node) =>
      node.getAttribute('title')
    );
    expect(titles).toEqual([
      'Driver rating: Silver 2',
      'Safety rating: Silver 2',
    ]);
  });

  it('colours each chip by its own rank', () => {
    // The safety chip takes its colour from the safety rank, not the driver
    // rank, so a Bronze driver with a Platinum safety rating reads as both.
    const { container } = render(
      <LmuRatingBadge
        rating={{ driverRank: 'Bronze', safetyRank: 'Platinum' }}
        format="chip-both"
      />
    );

    const chips = [...container.querySelectorAll('[title]')];
    expect(chips[0]?.className).toContain('#C4834A');
    expect(chips[1]?.className).toContain('#7FD8D2');
  });

  it('shows only the driver rank when asked', () => {
    const { container } = render(
      <LmuRatingBadge
        rating={{ driverRank: 'Gold', driverTier: 3, safetyRank: 'Silver' }}
        showSafety={false}
        format="chip-both"
      />
    );

    expect(container.textContent).toBe('G3');
  });

  it('draws chips with chrome on both by default', () => {
    const { container } = render(
      <LmuRatingBadge
        rating={{
          driverRank: 'Bronze',
          driverTier: 3,
          safetyRank: 'Silver',
          safetyTier: 2,
        }}
      />
    );

    const chips = [...container.querySelectorAll('[title]')];
    expect(chips.map((chip) => chip.getAttribute('title'))).toEqual([
      'Driver rating: Bronze 3',
      'Safety rating: Silver 2',
    ]);
    for (const chip of chips) expect(chip.className).toContain('border-2');
    // HTML/CSS only: no artwork of any kind.
    expect(container.querySelector('img, [role="img"]')).toBeNull();
    expect(container.textContent).toBe('B3S2');
  });

  it('draws the retired plates format as chips with chrome on both', () => {
    // What a config saved by an earlier build of this feature may still hold.
    const { container } = render(
      <LmuRatingBadge
        rating={{ driverRank: 'Pro', safetyRank: 'Gold', safetyTier: 1 }}
        format={'plates' as LmuBadgeFormat}
      />
    );

    for (const chip of container.querySelectorAll('[title]')) {
      expect(chip.className).toContain('border-2');
    }
    expect(container.textContent).toBe('PROG1');
  });

  it('drops the chrome from the safety chip only', () => {
    // chip-dr: the driver rating is the one most people want to pick out, and
    // the safety rating reads as noise beside it for some.
    const { container } = render(
      <LmuRatingBadge
        rating={{
          driverRank: 'Gold',
          driverTier: 3,
          safetyRank: 'Silver',
          safetyTier: 2,
        }}
        format="chip-dr"
      />
    );

    const chips = [...container.querySelectorAll('[title]')];
    expect(chips[0]?.className).toContain('border-2');
    expect(chips[1]?.className).not.toContain('border-2');
    // Without a background the colour has to move to the text, or the rank is
    // unreadable at a glance.
    expect(chips[1]?.className).toContain('text-[#A7ACB2]');
    expect(container.textContent).toBe('G3S2');
  });

  it('drops the chrome from the driver chip only', () => {
    const { container } = render(
      <LmuRatingBadge
        rating={{ driverRank: 'Gold', safetyRank: 'Silver' }}
        format="chip-sr"
      />
    );

    const chips = [...container.querySelectorAll('[title]')];
    expect(chips[0]?.className).not.toContain('border-2');
    expect(chips[1]?.className).toContain('border-2');
  });

  it('drops the chrome from both', () => {
    const { container } = render(
      <LmuRatingBadge
        rating={{ driverRank: 'Gold', safetyRank: 'Silver' }}
        format="chip-none"
      />
    );

    for (const chip of container.querySelectorAll('[title]')) {
      expect(chip.className).not.toContain('border-2');
    }
  });

  it('keeps the chrome on both for chip-both', () => {
    const { container } = render(
      <LmuRatingBadge
        rating={{ driverRank: 'Gold', safetyRank: 'Silver' }}
        format="chip-both"
      />
    );

    for (const chip of container.querySelectorAll('[title]')) {
      expect(chip.className).toContain('border-2');
    }
    expect(container.querySelectorAll('[role="img"]')).toHaveLength(0);
  });

  it('renders nothing without a rank', () => {
    // The common case for an AI entry, and for any human the service does not
    // know. An empty cell is correct: a placeholder would imply a rating that
    // does not exist, and BadgeCell falls through to the iRacing badge.
    expect(render(<LmuRatingBadge />).container.textContent).toBe('');
    expect(
      render(<LmuRatingBadge rating={{ countryCode: 'US' }} />).container
        .textContent
    ).toBe('');
    expect(
      render(<LmuRatingBadge rating={{ badge: 'sr-saint' }} />).container
        .textContent
    ).toBe('');
  });
});
