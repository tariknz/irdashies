import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingProp, SettingProps } from './SettingProp';

const renderWind = (config: Record<string, unknown>) => {
  const onChange = vi.fn();
  render(
    <SettingProps widget="wind" config={config} onChange={onChange}>
      <SettingProp path="background.opacity" />
      <SettingProp path="units" />
      <SettingProp path="showOnlyWhenOnTrack" />
      <SettingProp path="no.such.path" />
    </SettingProps>
  );
  return onChange;
};

describe('SettingProp', () => {
  it('picks the control and label from the manifest', () => {
    renderWind({ background: { opacity: 40 }, units: 'auto' });
    expect(screen.getByText('Background Opacity')).toBeInTheDocument();
    expect(screen.getByText('mph')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('sends the whole top-level branch with one leaf changed', () => {
    const onChange = renderWind({
      background: { opacity: 40, extra: 1 },
      units: 'auto',
    });
    fireEvent.change(screen.getByRole('slider'), { target: { value: '55' } });
    expect(onChange).toHaveBeenLastCalledWith({
      background: { opacity: 55, extra: 1 },
    });
    fireEvent.click(screen.getByText('mph'));
    expect(onChange).toHaveBeenLastCalledWith({ units: 'Imperial' });
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenLastCalledWith({ showOnlyWhenOnTrack: true });
  });
});

describe('SettingProp enum extensions', () => {
  const renderStandings = (
    config: Record<string, unknown>,
    compact = false
  ) => {
    const onChange = vi.fn();
    render(
      <SettingProps widget="standings" config={config} onChange={onChange}>
        <SettingProp
          path="lapTimeDeltas.numLaps"
          variant={compact ? 'compact' : 'row'}
        />
        <SettingProp
          path="iratingChange.estimateInPractice"
          variant={compact ? 'compact' : 'row'}
        />
      </SettingProps>
    );
    return onChange;
  };
  const config = {
    lapTimeDeltas: { enabled: true, numLaps: 3, decimalPlaces: 1 },
    iratingChange: { enabled: true, estimateInPractice: false },
  };

  it('select control keeps numeric option values numeric', () => {
    const onChange = vi.fn();
    render(
      <SettingProps
        widget="standings"
        config={{ driverStandings: { buffer: 3, numTopDrivers: 3 } }}
        onChange={onChange}
      >
        <SettingProp path="driverStandings.buffer" />
      </SettingProps>
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '4' } });
    expect(onChange).toHaveBeenLastCalledWith({
      driverStandings: { buffer: 4, numTopDrivers: 3 },
    });
  });

  it('compact variant renders the inline sub-setting markup', () => {
    const onChange = renderStandings(config, true);
    expect(
      screen.getByText('Number of Laps to Show').parentElement
    ).toHaveClass('pl-8', 'mt-2', 'indent-8');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } });
    expect(onChange).toHaveBeenLastCalledWith({
      lapTimeDeltas: { enabled: true, numLaps: 5, decimalPlaces: 1 },
    });
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenLastCalledWith({
      iratingChange: { enabled: true, estimateInPractice: true },
    });
  });
});

describe('SettingProp number input', () => {
  it('renders a number input with the declared limits', () => {
    const onChange = vi.fn();
    render(
      <SettingProps
        widget="rejoin"
        config={{ showAtSpeed: 30, careGap: 2 }}
        onChange={onChange}
      >
        <SettingProp path="showAtSpeed" />
      </SettingProps>
    );
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('min', '0');
    fireEvent.change(input, { target: { value: '12.5' } });
    expect(onChange).toHaveBeenLastCalledWith({ showAtSpeed: 12.5 });
  });
});
