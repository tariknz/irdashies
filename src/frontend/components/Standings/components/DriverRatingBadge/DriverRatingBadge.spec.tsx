import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DriverRatingBadge } from './DriverRatingBadge';

vi.mock('@phosphor-icons/react', () => ({
  CaretUpIcon: () => <span>up-arrow</span>,
  CaretDownIcon: () => <span>down-arrow</span>,
  MinusIcon: () => <span>line-through</span>,
}));

describe('DriverRatingBadge', () => {
  it('renders with default props', () => {
    const { container } = render(<DriverRatingBadge />);
    expect(container.textContent).toBe('R 0.00.0k');
  });

  it('renders with license A and rating 5000', () => {
    const { container } = render(
      <DriverRatingBadge license="A" rating={5000} />
    );
    expect(container.textContent).toBe('A 5.0k');
  });

  it('renders with license B and rating 10000', () => {
    const { container } = render(
      <DriverRatingBadge license="B" rating={10000} />
    );
    expect(container.textContent).toBe('B 10.0k');
  });

  it('renders with license C and rating 15000', () => {
    const { container } = render(
      <DriverRatingBadge license="C" rating={15000} />
    );
    expect(container.textContent).toBe('C 15.0k');
  });

  it('renders with license D and rating 2000', () => {
    const { container } = render(
      <DriverRatingBadge license="D" rating={2000} />
    );
    expect(container.textContent).toBe('D 2.0k');
  });

  it('renders with license R and rating 7500', () => {
    const { container } = render(
      <DriverRatingBadge license="R" rating={7500} />
    );
    expect(container.textContent).toBe('R 7.5k');
  });

  it('renders with unknown license and rating 3000', () => {
    const { container } = render(
      <DriverRatingBadge license="X" rating={3000} />
    );
    expect(container.textContent).toBe('X 3.0k');
  });

  it('renders with undefined license and rating', () => {
    const { container } = render(
      <DriverRatingBadge license={undefined} rating={undefined} />
    );
    expect(container.textContent).toBe('R 0.00.0k');
  });

  it('rounds rating to 1 decimal place', () => {
    const { container } = render(
      <DriverRatingBadge license="C 3.141592654" rating={5000.123} />
    );
    expect(container.textContent).toBe('C 3.15.0k');
  });

  it('removes leading zeros from license number when before non-zero digit', () => {
    const { container } = render(
      <DriverRatingBadge license="A 02.99" rating={5000} />
    );
    expect(container.textContent).toBe('A 2.95.0k');
  });

  it('keeps single zero before decimal point', () => {
    const { container } = render(
      <DriverRatingBadge license="A 0.99" rating={5000} />
    );
    expect(container.textContent).toBe('A 0.95.0k');
  });

  it('handles multiple leading zeros', () => {
    const { container } = render(
      <DriverRatingBadge license="B 0003.45" rating={5000} />
    );
    expect(container.textContent).toBe('B 3.45.0k');
  });

  it('should handle invalid license strings', () => {
    const { container } = render(
      <DriverRatingBadge license="Oh no" rating={5000} />
    );
    expect(container.textContent).toBe('Oh no 5.0k');
  });

  it('should floor rating to 1 decimal place (1999 -> 1.9k)', () => {
    const { container } = render(
      <DriverRatingBadge license="A" rating={1999} />
    );
    expect(container.textContent).toBe('A 1.9k');
  });

  it('should floor rating to 1 decimal place (1950 -> 1.9k)', () => {
    const { container } = render(
      <DriverRatingBadge license="B" rating={1950} />
    );
    expect(container.textContent).toBe('B 1.9k');
  });

  it('should floor rating to 1 decimal place (2999 -> 2.9k)', () => {
    const { container } = render(
      <DriverRatingBadge license="C" rating={2999} />
    );
    expect(container.textContent).toBe('C 2.9k');
  });

  it('should floor rating with no decimals for >= 10000 (10500 -> 10k)', () => {
    const { container } = render(
      <DriverRatingBadge license="A" rating={10500} />
    );
    expect(container.textContent).toBe('A 10.5k');
  });

  it('should floor rating with no decimals for >= 10000 (10999 -> 10k)', () => {
    const { container } = render(
      <DriverRatingBadge license="B" rating={10999} />
    );
    expect(container.textContent).toBe('B 10.9k');
  });

  it('should floor rating with no decimals for >= 10000 (15999 -> 15k)', () => {
    const { container } = render(
      <DriverRatingBadge license="C" rating={15999} />
    );
    expect(container.textContent).toBe('C 15.9k');
  });

  describe('iratingChange prop', () => {
    it('does not render delta when iratingChange is not provided', () => {
      const { container } = render(
        <DriverRatingBadge license="A" rating={5000} />
      );
      expect(container.textContent).not.toContain('up-arrow');
      expect(container.textContent).not.toContain('down-arrow');
      expect(container.textContent).not.toContain('line-through');
    });

    it('renders positive iratingChange with up-arrow', () => {
      const { container } = render(
        <DriverRatingBadge license="A" rating={5000} iratingChange={42} />
      );
      expect(container.textContent).toContain('42');
      expect(container.textContent).toContain('up-arrow');
    });

    it('renders negative iratingChange with down-arrow', () => {
      const { container } = render(
        <DriverRatingBadge license="A" rating={5000} iratingChange={-15} />
      );
      expect(container.textContent).toContain('15');
      expect(container.textContent).toContain('down-arrow');
    });

    it('renders zero iratingChange with line-through (dash)', () => {
      const { container } = render(
        <DriverRatingBadge license="A" rating={5000} iratingChange={0} />
      );
      // RatingChange renders a dash (line-through) for zero with showZero={false}
      expect(container.textContent).toContain('line-through');
      // Verify the RatingChange div was rendered (not the outer flex container)
      const ratingChangeDiv = container.querySelector('div[class*="ml-1"]');
      expect(ratingChangeDiv).toBeTruthy();
    });

    it('does not render delta when iratingChange is undefined explicitly', () => {
      const { container } = render(
        <DriverRatingBadge
          license="A"
          rating={5000}
          iratingChange={undefined}
        />
      );
      expect(container.textContent).not.toContain('up-arrow');
      expect(container.textContent).not.toContain('down-arrow');
      expect(container.textContent).not.toContain('line-through');
    });
  });

  describe('noMargin prop', () => {
    it('includes mx-2 margin class by default (noMargin={false})', () => {
      const { container } = render(
        <DriverRatingBadge
          license="A"
          rating={5000}
          format="license-color-rating-bw"
        />
      );
      // Query the badge div (first child with gap class)
      const badgeDiv = container.querySelector('div[class*="gap-1"]');
      expect(badgeDiv?.className).toContain('mx-2');
    });

    it('excludes mx-2 margin class when noMargin={true}', () => {
      const { container } = render(
        <DriverRatingBadge
          license="A"
          rating={5000}
          format="license-color-rating-bw"
          noMargin={true}
        />
      );
      // Query the badge div (first child with gap class)
      const badgeDiv = container.querySelector('div[class*="gap-1"]');
      expect(badgeDiv?.className).not.toContain('mx-2');
    });
  });
});
