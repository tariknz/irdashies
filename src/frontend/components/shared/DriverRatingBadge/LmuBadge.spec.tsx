import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LmuBadge } from './LmuBadge';

/**
 * The achievement badge column.
 *
 * Art only, deliberately: the badge string is a key into the service's
 * artwork, not a label, so `sr-saint` is not something to print in a standings
 * row. A marker with no bundled art renders nothing at all.
 */
describe('LmuBadge', () => {
  it('draws the badge art', () => {
    const { container } = render(<LmuBadge badge="sr-saint" />);
    const art = container.querySelector('img');

    expect(art).toBeTruthy();
    expect(art?.getAttribute('alt')).toBe('sr-saint');
    expect(art?.getAttribute('title')).toBe('sr-saint');
  });

  it('renders nothing for a badge it has no art for', () => {
    // A marker the service adds after the art was last fetched. Printing the
    // raw key instead would put "sr-unheard-of" in a standings row.
    expect(
      render(<LmuBadge badge="sr-unheard-of" />).container.textContent
    ).toBe('');
    expect(
      render(<LmuBadge badge="sr-unheard-of" />).container.querySelector('img')
    ).toBeNull();
  });

  it('renders nothing without a badge', () => {
    // Most of a grid: an AI entry, or any driver the service has no marker
    // for. Also every driver on every sim but LMU.
    expect(render(<LmuBadge />).container.querySelector('img')).toBeNull();
  });
});
