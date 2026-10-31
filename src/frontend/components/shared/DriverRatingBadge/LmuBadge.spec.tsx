import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LmuBadge } from './LmuBadge';

/**
 * The achievement badge column.
 *
 * A known marker is drawn as a chip with an icon, in HTML/CSS rather than
 * with the sim's artwork. The badge string is a key, not a label, so the chip
 * is named by what the marker means rather than by `sr-saint`.
 */
describe('LmuBadge', () => {
  it('draws a known badge as an icon chip named for what it means', () => {
    const { container } = render(<LmuBadge badge="sr-saint" />);
    const chip = container.querySelector('[role="img"]');

    expect(chip?.getAttribute('aria-label')).toBe('Saint');
    expect(chip?.getAttribute('title')).toBe('Saint');
    expect(chip?.querySelector('svg')).not.toBeNull();
    expect(container.textContent).toBe('');
  });

  it('draws every known marker', () => {
    for (const badge of [
      'sr-noob',
      'sr-saint',
      'sr-clean',
      'sr-warning',
      'sr-danger',
      'sr-probation',
    ]) {
      const { container } = render(<LmuBadge badge={badge} />);
      expect(container.querySelector('[role="img"] svg')).not.toBeNull();
    }
  });

  it('draws danger the same as warning', () => {
    // The service reports the two separately; they mean the same to a driver.
    const warning = render(<LmuBadge badge="sr-warning" />).container;
    const danger = render(<LmuBadge badge="sr-danger" />).container;
    expect(danger.innerHTML).toBe(warning.innerHTML);
  });

  it('labels a badge it does not know rather than hiding it', () => {
    // A marker the service added later. An empty cell would say "this driver
    // has no badge" while meaning "we cannot draw it", and those two being
    // indistinguishable is what made this column so hard to diagnose.
    const { container } = render(<LmuBadge badge="sr-unheard-of" />);

    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.textContent).toBe('unheard-of');
    expect(container.querySelector('[title]')?.getAttribute('title')).toBe(
      'sr-unheard-of'
    );
  });

  it('renders nothing without a badge', () => {
    // Most of a grid: an AI entry, or any driver the service has no marker
    // for. Also every driver on every sim but LMU.
    const { container } = render(<LmuBadge />);
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.textContent).toBe('');
  });
});
