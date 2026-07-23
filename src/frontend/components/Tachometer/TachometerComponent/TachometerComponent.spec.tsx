import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EngineWarnings } from '@irdashies/types';
import { Tachometer } from './TachometerComponent';

describe('Tachometer', () => {
  it('renders rounded RPM and keeps the circular shift lights', () => {
    render(
      <Tachometer
        rpm={4321.6}
        maxRpm={8000}
        showOilTemp={false}
        showWaterTemp={false}
      />
    );
    expect(screen.getByText('4,322')).toBeInTheDocument();
    expect(screen.queryByText('SHIFT')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/LED/)).toHaveLength(10);
  });

  it('retains temperature displays when RPM text is hidden', () => {
    const { container } = render(
      <Tachometer
        rpm={4000}
        maxRpm={8000}
        showRpmText={false}
        oilTemp={110}
        waterTemp={95}
      />
    );
    expect(screen.getByText('110°C')).toBeInTheDocument();
    expect(screen.getByText('95°C')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('relative');
  });

  it('shows warning colors from engine warning bits', () => {
    render(
      <Tachometer
        rpm={4000}
        maxRpm={8000}
        oilTemp={120}
        waterTemp={100}
        engineWarnings={EngineWarnings.OilTempWarning}
      />
    );
    expect(screen.getByText('120°C').parentElement).toHaveClass('text-red-500');
    expect(screen.getByText('100°C').parentElement).toHaveClass('text-white');
  });
});
