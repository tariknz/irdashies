import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BadgeFormatPreview } from './BadgeFormatPreview';

vi.mock('@phosphor-icons/react', () => ({
  CaretUpIcon: () => <span>up-arrow</span>,
  CaretDownIcon: () => <span>down-arrow</span>,
  MinusIcon: () => <span>line-through</span>,
}));

describe('BadgeFormatPreview', () => {
  const noop = vi.fn();

  it('renders a button', () => {
    const { container } = render(
      <BadgeFormatPreview
        format="license-color-rating-bw"
        selected={false}
        onClick={noop}
      />
    );
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
  });

  it('applies highlight classes when selected=true', () => {
    const { container } = render(
      <BadgeFormatPreview
        format="license-color-rating-bw"
        selected={true}
        onClick={noop}
      />
    );
    const button = container.querySelector('button');
    expect(button?.className).toContain('border-blue-500');
    expect(button?.className).toContain('bg-blue-500/10');
  });

  it('does not apply highlight classes when selected=false', () => {
    const { container } = render(
      <BadgeFormatPreview
        format="license-color-rating-bw"
        selected={false}
        onClick={noop}
      />
    );
    const button = container.querySelector('button');
    expect(button?.className).not.toContain('border-blue-500');
    expect(button?.className).not.toContain('bg-blue-500/10');
  });

  it('calls onClick when button is clicked', () => {
    const onClick = vi.fn();
    const { container } = render(
      <BadgeFormatPreview
        format="license-color-rating-bw"
        selected={false}
        onClick={onClick}
      />
    );
    const button = container.querySelector('button');
    if (button) {
      fireEvent.click(button);
      expect(onClick).toHaveBeenCalledOnce();
    }
  });

  it('forwards positive iratingChange to DriverRatingBadge', () => {
    const { container } = render(
      <BadgeFormatPreview
        format="license-color-rating-bw"
        selected={false}
        onClick={noop}
        iratingChange={42}
      />
    );
    expect(container.textContent).toContain('42');
    expect(container.textContent).toContain('up-arrow');
  });

  it('does not render iRating delta when iratingChange is not provided', () => {
    const { container } = render(
      <BadgeFormatPreview
        format="license-color-rating-bw"
        selected={false}
        onClick={noop}
      />
    );
    expect(container.textContent).not.toContain('up-arrow');
    expect(container.textContent).not.toContain('down-arrow');
  });
});
