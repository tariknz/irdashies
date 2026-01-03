import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RatingChange } from './RatingChange';

vi.mock('@phosphor-icons/react', () => ({
  CaretUpIcon: () => <span>up-arrow</span>,
  CaretDownIcon: () => <span>down-arrow</span>,
  MinusIcon: () => <span>line-through</span>,
}));

describe('RatingChange', () => {
  it('renders positive change with green color and up arrow', () => {
    render(<RatingChange value={42} />);
    const element = screen.getByText('42');
    expect(element).toHaveClass('text-green-400');
    expect(element.parentElement).toContainHTML('up-arrow');
  });

  it('renders negative change with red color and down arrow', () => {
    render(<RatingChange value={-15} />);
    const element = screen.getByText('15');
    expect(element).toHaveClass('text-red-400');
    expect(element.parentElement).toContainHTML('down-arrow');
  });

  it('renders zero change with gray color and minus icon', () => {
    render(<RatingChange value={0} />);
    const element = screen.getByText('0');
    expect(element).toHaveClass('text-gray-400');
    expect(element.parentElement).toContainHTML('line-through');
  });

  it('renders dash for undefined change', () => {
    render(<RatingChange value={undefined} />);
    const element = screen.getByText('line-through');
    expect(element).toBeInTheDocument();
  });

  it('renders dash for NaN change', () => {
    render(<RatingChange value={Number.NaN} />);
    const element = screen.getByText('line-through');
    expect(element).toBeInTheDocument();
  });
}); 