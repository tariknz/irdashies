import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import logger from '@irdashies/utils/logger';
import { SettingNumberRow } from './SettingNumberRow';
import { SettingProps, settingPropFor } from './SettingProp';

vi.mock('@irdashies/utils/logger', () => ({
  default: { warn: vi.fn() },
}));

const WindProp = settingPropFor('wind');
const StandingsProp = settingPropFor('standings');
const RejoinProp = settingPropFor('rejoin');
const LapTraceProp = settingPropFor('laptrace');

const renderWind = (config: Record<string, unknown>) => {
  const onChange = vi.fn();
  render(
    <SettingProps widget="wind" config={config} onChange={onChange}>
      <WindProp path="background.opacity" />
      <WindProp path="units" />
      <WindProp path="showOnlyWhenOnTrack" />
      {/* @ts-expect-error not a Wind config path */}
      <WindProp path="no.such.path" />
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
  it('lets standings users choose the interval display while preserving other interval settings', () => {
    const onChange = vi.fn();
    render(
      <SettingProps
        widget="standings"
        config={{
          interval: { enabled: true, displayMode: 'time', decimalPlaces: 2 },
        }}
        onChange={onChange}
      >
        <StandingsProp path="interval.displayMode" variant="compact" />
      </SettingProps>
    );
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('time');
    fireEvent.change(select, { target: { value: 'laps' } });
    expect(onChange).toHaveBeenLastCalledWith({
      interval: { enabled: true, displayMode: 'laps', decimalPlaces: 2 },
    });
  });

  const renderStandings = (
    config: Record<string, unknown>,
    compact = false
  ) => {
    const onChange = vi.fn();
    render(
      <SettingProps widget="standings" config={config} onChange={onChange}>
        <StandingsProp
          path="lapTimeDeltas.numLaps"
          variant={compact ? 'compact' : 'row'}
        />
        <StandingsProp
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
        <StandingsProp path="driverStandings.buffer" />
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
        <RejoinProp path="showAtSpeed" />
      </SettingProps>
    );
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('min', '0');
    fireEvent.change(input, { target: { value: '12.5' } });
    expect(onChange).toHaveBeenLastCalledWith({ showAtSpeed: 12.5 });
  });
});

describe('SettingProp regression cases', () => {
  it.each([undefined, null])(
    'uses manifest defaults for absent or null values: %s',
    (opacity) => {
      render(
        <SettingProps
          widget="wind"
          config={{ background: { opacity } }}
          onChange={vi.fn()}
        >
          <WindProp path="background.opacity" />
        </SettingProps>
      );
      expect(screen.getByRole('slider')).toHaveValue('80');
    }
  );

  it('preserves explicit zero and false instead of substituting defaults', () => {
    const onChange = vi.fn();
    render(
      <SettingProps
        widget="wind"
        config={{
          background: { opacity: 0 },
          sessionVisibility: { race: false },
        }}
        onChange={onChange}
      >
        <WindProp path="background.opacity" />
        <WindProp path="sessionVisibility.race" />
      </SettingProps>
    );
    expect(screen.getByRole('slider')).toHaveValue('0');
    expect(screen.getByRole('switch')).not.toBeChecked();
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      sessionVisibility: { race: true },
    });
  });

  it('creates a missing nested branch without changing the supplied config', () => {
    const config = Object.freeze({ units: 'Metric' });
    const onChange = vi.fn();
    render(
      <SettingProps widget="wind" config={config} onChange={onChange}>
        <WindProp path="background.opacity" />
      </SettingProps>
    );
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      background: { opacity: 0 },
    });
    expect(config).toEqual({ units: 'Metric' });
  });

  it('preserves numeric values in enum buttons and leaves sibling settings intact', () => {
    const config = Object.freeze({
      lapTimeDeltas: Object.freeze({
        numLaps: 3,
        enabled: true,
        decimalPlaces: 2,
      }),
    });
    const onChange = vi.fn();
    render(
      <SettingProps widget="standings" config={config} onChange={onChange}>
        <StandingsProp path="lapTimeDeltas.numLaps" />
      </SettingProps>
    );
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      lapTimeDeltas: { numLaps: 5, enabled: true, decimalPlaces: 2 },
    });
    expect(config.lapTimeDeltas.numLaps).toBe(3);
  });

  it('preserves string values in compact enum controls', () => {
    const onChange = vi.fn();
    render(
      <SettingProps
        widget="wind"
        config={{ units: 'auto' }}
        onChange={onChange}
      >
        <WindProp path="units" variant="compact" />
      </SettingProps>
    );
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Metric' },
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ units: 'Metric' });
  });

  it('uses a slider for compact numbers with manifest limits, steps and units', () => {
    const onChange = vi.fn();
    render(
      <SettingProps
        widget="laptrace"
        config={{ metersAhead: 100 }}
        onChange={onChange}
      >
        <LapTraceProp path="metersAhead" variant="compact" />
      </SettingProps>
    );
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '50');
    expect(slider).toHaveAttribute('max', '600');
    expect(slider).toHaveAttribute('step', '50');
    expect(screen.getByText(': 100 m')).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '600' } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ metersAhead: 600 });
  });

  it('ignores a cleared numeric input and emits zero as a number', () => {
    const onChange = vi.fn();
    render(
      <SettingProps
        widget="rejoin"
        config={{ showAtSpeed: 30 }}
        onChange={onChange}
      >
        <RejoinProp path="showAtSpeed" />
      </SettingProps>
    );
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('step', '0.1');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '0' } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ showAtSpeed: 0 });
  });

  it('renders nothing when the provider is missing', () => {
    const { container } = render(<WindProp path="units" />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(['unknown-widget', '__proto__'])(
    'renders nothing for unknown widget %s',
    (widget) => {
      const onChange = vi.fn();
      const { container } = render(
        <SettingProps widget={widget} config={{}} onChange={onChange}>
          <WindProp path="units" />
        </SettingProps>
      );
      expect(container).toBeEmptyDOMElement();
      expect(onChange).not.toHaveBeenCalled();
    }
  );

  it("renders nothing inside another widget's provider", () => {
    const { container } = render(
      <SettingProps widget="standings" config={{}} onChange={vi.fn()}>
        <WindProp path="units" />
      </SettingProps>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a property absent from a known manifest', () => {
    const { container } = render(
      <SettingProps widget="wind" config={{}} onChange={vi.fn()}>
        {/* @ts-expect-error not a Wind config path */}
        <WindProp path="missing.path" />
      </SettingProps>
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SettingProp missing-spec warning', () => {
  it('warns once for each widget, even when they share a path', () => {
    const warn = vi.mocked(logger.warn);
    warn.mockClear();
    // Outside a provider, so neither row finds its spec.
    const { rerender } = render(<WindProp path="background.opacity" />);
    rerender(<WindProp path="background.opacity" />);
    render(<StandingsProp path="background.opacity" />);
    expect(warn.mock.calls.map((call) => call.slice(1))).toEqual([
      ['wind', 'background.opacity'],
      ['standings', 'background.opacity'],
    ]);
  });
});

describe('SettingNumberRow', () => {
  it('shows the units after the input', () => {
    render(
      <SettingNumberRow title="Width" value={4} units="px" onChange={vi.fn()} />
    );
    expect(screen.getByText('px')).toBeInTheDocument();
  });
});
