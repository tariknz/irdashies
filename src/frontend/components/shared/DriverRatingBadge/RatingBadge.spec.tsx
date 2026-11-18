import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RatingBadge, type RatingBadgeProps } from './RatingBadge';

const badge = (props: RatingBadgeProps) =>
  render(<RatingBadge {...props} />).container;

describe('RatingBadge', () => {
  it('shows the iRacing badge for a driver with a licence and rating', () => {
    const shown = badge({
      license: 'A 4.00',
      rating: 3500,
      badgeFormat: 'rating-bw-no-license',
    });
    expect(shown.textContent).toBe('3.5k');
  });

  it('shows the LMU badge for a driver with a rank', () => {
    const shown = badge({
      lmuRating: { driverRank: 'Gold', driverTier: 3, safetyRank: 'Silver' },
      lmuFormat: 'chip-both',
      hasDriverRatings: false,
    });
    expect(screen.getByTitle('Driver rating: Gold 3')).toBeInTheDocument();
    expect(screen.getByTitle('Safety rating: Silver')).toBeInTheDocument();
    expect(shown.textContent).toBe('G3S');
  });

  it('shows nothing for an LMU human whose rank has not arrived', () => {
    const shown = badge({
      lmuRating: { countryCode: 'FR' },
      hasDriverRatings: false,
      isAI: false,
    });
    expect(shown).toBeEmptyDOMElement();
  });

  it('names an LMU AI entry as one', () => {
    const shown = badge({
      lmuRating: { countryCode: 'FR' },
      hasDriverRatings: false,
      isAI: true,
    });
    expect(shown.textContent).toBe('AI');
  });
});
