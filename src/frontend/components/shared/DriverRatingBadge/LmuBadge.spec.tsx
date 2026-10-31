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
    const art = container.querySelector('[role="img"]');

    expect(art).toBeTruthy();
    expect(art?.getAttribute('aria-label')).toBe('sr-saint');
    expect(art?.getAttribute('title')).toBe('sr-saint');
  });

  it('labels a badge it has no art for rather than hiding it', () => {
    // A marker the service added after the art was last fetched. An empty
    // cell would say "this driver has no badge" while meaning "we have no
    // picture of it", and those two being indistinguishable is what made this
    // column so hard to diagnose.
    const { container } = render(<LmuBadge badge="sr-unheard-of" />);

    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.textContent).toBe('unheard-of');
    expect(container.querySelector('[title]')?.getAttribute('title')).toBe(
      'sr-unheard-of'
    );
  });

  it('renders nothing without a badge', () => {
    // Most of a grid: an AI entry, or any driver the service has no marker
    // for. Also every driver on every sim but LMU. Nothing at all here, since
    // there is no marker to report.
    const { container } = render(<LmuBadge />);
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('draws the art as a sprite cell, not an image', () => {
    // A background cannot be compressed by table layout, where an img carries
    // preflight's max-width: 100% and the table squashed it to fit the row.
    const { container } = render(<LmuBadge badge="sr-saint" />);
    const art = container.querySelector('[role="img"]');

    expect(container.querySelector('img')).toBeNull();
    expect(art?.getAttribute('style')).toContain('background-position');
    expect(art?.getAttribute('aria-label')).toBe('sr-saint');
  });
});
