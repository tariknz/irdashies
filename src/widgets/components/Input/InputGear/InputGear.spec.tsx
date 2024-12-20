import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InputGear } from './InputGear';

describe('InputGear', () => {
  it('renders without crashing', () => {
    const { container } = render(<InputGear gear={1} speedMs={10} />);
    expect(container).toBeInTheDocument();
  });

  it('displays the correct gear text', () => {
    const { getByText } = render(<InputGear gear={1} speedMs={10} />);
    expect(getByText('1')).toBeInTheDocument();
  });

  it('displays "R" for reverse gear', () => {
    const { getByText } = render(<InputGear gear={-1} speedMs={10} />);
    expect(getByText('R')).toBeInTheDocument();
  });

  it('displays "N" for neutral gear', () => {
    const { getByText } = render(<InputGear gear={0} speedMs={10} />);
    expect(getByText('N')).toBeInTheDocument();
  });

  it('displays the correct speed in km/h', () => {
    const { getByText } = render(<InputGear gear={1} speedMs={10} />);
    expect(getByText('36')).toBeInTheDocument(); // 10 m/s * 3.6 = 36 km/h
  });
});
