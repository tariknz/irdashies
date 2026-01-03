import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InputGear } from './InputGear';

describe('InputGear', () => {
  it('renders without crashing', () => {
    const { container } = render(<InputGear gear={1} speedMs={10} settings={{ unit: 'auto' }} />);
    expect(container).toBeInTheDocument();
  });

  it('displays the correct gear text', () => {
    const { getByText } = render(<InputGear gear={1} speedMs={10} settings={{ unit: 'auto' }} />);
    expect(getByText('1')).toBeInTheDocument();
  });

  it('displays "R" for reverse gear', () => {
    const { getByText } = render(<InputGear gear={-1} speedMs={10} settings={{ unit: 'auto' }} />);
    expect(getByText('R')).toBeInTheDocument();
  });

  it('displays "N" for neutral gear', () => {
    const { getByText } = render(<InputGear gear={0} speedMs={10} settings={{ unit: 'auto' }} />);
    expect(getByText('N')).toBeInTheDocument();
  });

  it('displays the correct speed in km/h', () => {
    const { getByText } = render(<InputGear gear={1} speedMs={10} unit={1} settings={{ unit: 'auto' }} />);
    expect(getByText('36')).toBeInTheDocument(); // 10 m/s * 3.6 = 36 km/h
  });

  it('displays the correct speed in mph', () => {
    const { getByText } = render(<InputGear gear={1} speedMs={10} settings={{ unit: 'auto' }} />);
    expect(getByText('22')).toBeInTheDocument(); // 10 m/s * 2.23694 = 22.3694 mph
  });

  it('displays "N" when no gear is provided', () => {
    const { getByText } = render(<InputGear speedMs={10} settings={{ unit: 'auto' }} />);
    expect(getByText('N')).toBeInTheDocument();
  });

  it('displays "N" when gear is null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { getByText } = render(<InputGear gear={null as any} speedMs={10} settings={{ unit: 'auto' }} />);
    expect(getByText('N')).toBeInTheDocument();
  });

  it('displays the correct speed in km/h when unit is km/h', () => {
    const { getByText } = render(<InputGear gear={1} speedMs={10} settings={{ unit: 'km/h' }} />);
    expect(getByText('36')).toBeInTheDocument(); // 10 m/s * 3.6 = 36 km/h
  });

  it('displays the correct speed in mph when unit is mph', () => {
    const { getByText } = render(<InputGear gear={1} speedMs={10} settings={{ unit: 'mph' }} />);
    expect(getByText('22')).toBeInTheDocument(); // 10 m/s * 2.23694 = 22.3694 mph
  });
});
