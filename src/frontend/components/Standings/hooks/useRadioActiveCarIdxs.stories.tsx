import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SpeakerHighIcon } from '@phosphor-icons/react';
import { useTelemetryStore } from '@irdashies/context';
import type { Telemetry } from '@irdashies/types';
import { useRadioActiveCarIdxs } from './useRadioActiveCarIdxs';

const DEMO_CAR_IDX = 7;

// Push only the key the hook reads straight into the telemetry store.
//
// These stories intentionally do NOT use TelemetryDecorator: the mock bridge
// streams a full telemetry frame at 60Hz and would clobber anything we inject
// within ~16ms. Driving the store directly lets us flip-flap
// RadioTransmitCarIdx deterministically and watch the *real* hook debounce it.
const setRadioTransmit = (carIdxs: number[]) =>
  useTelemetryStore.getState().setTelemetry({
    RadioTransmitCarIdx: { value: carIdxs },
  } as Telemetry);

type DemoMode = 'flip-flap' | 'single-burst';

const RadioDebounceHarness = ({
  mode,
  persistenceSeconds,
}: {
  mode: DemoMode;
  persistenceSeconds: number;
}) => {
  const [rawTransmitting, setRawTransmitting] = useState(false);

  useEffect(() => {
    setRadioTransmit([-1]);

    const timers: ReturnType<typeof setTimeout>[] = [];
    const transmit = (on: boolean) => {
      setRawTransmitting(on);
      setRadioTransmit(on ? [DEMO_CAR_IDX] : [-1]);
    };

    if (mode === 'flip-flap') {
      // Rapidly key the radio on/off — the bug that used to make the icon
      // strobe. Each "on" frame re-arms the debounce, so it stays solidly lit.
      let on = false;
      const id = setInterval(() => {
        on = !on;
        transmit(on);
      }, 500);
      return () => {
        clearInterval(id);
        useTelemetryStore.getState().resetTelemetry();
      };
    }

    // single-burst: transmit once, go silent, watch the icon linger then clear.
    timers.push(setTimeout(() => transmit(true), 800));
    timers.push(setTimeout(() => transmit(false), 1600));
    return () => {
      timers.forEach(clearTimeout);
      useTelemetryStore.getState().resetTelemetry();
    };
  }, [mode]);

  const active = useRadioActiveCarIdxs(persistenceSeconds * 1000);
  const iconLit = active.includes(DEMO_CAR_IDX);

  return (
    <div className="flex w-96 flex-col gap-3 p-4 font-sans text-white">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">Raw RadioTransmitCarIdx</span>
        <span
          className={`font-mono text-sm ${
            rawTransmitting ? 'text-amber-300' : 'text-slate-500'
          }`}
        >
          {rawTransmitting ? `[${DEMO_CAR_IDX}]` : '[-1]'}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">Debounced icon</span>
        <span className="flex items-center gap-1.5">
          <SpeakerHighIcon
            size={16}
            className={
              iconLit ? 'animate-pulse text-amber-300' : 'text-slate-700'
            }
          />
          <span
            className={`text-sm ${iconLit ? 'text-amber-300' : 'text-slate-500'}`}
          >
            {iconLit ? 'lit' : 'off'}
          </span>
        </span>
      </div>

      <p className="text-xs text-slate-400">
        {mode === 'flip-flap'
          ? `Raw signal flips every 500ms, but the icon stays lit — each transmit frame re-arms the ${persistenceSeconds}s window.`
          : `A single burst lights the icon, then it lingers for ${persistenceSeconds}s after the last transmit frame before clearing.`}
      </p>
    </div>
  );
};

const meta: Meta<typeof RadioDebounceHarness> = {
  title: 'widgets/Standings/hooks/useRadioActiveCarIdxs',
  component: RadioDebounceHarness,
};

export default meta;

type Story = StoryObj<typeof RadioDebounceHarness>;

// The core regression: rapid on/off keying must not strobe the icon.
export const FlipFlap: Story = {
  name: 'Debounce - flip-flap',
  args: { mode: 'flip-flap', persistenceSeconds: 3 },
};

// The other half of the window: lingers after a single burst, then clears.
export const LingerThenClear: Story = {
  name: 'Debounce - linger then clear',
  args: { mode: 'single-burst', persistenceSeconds: 3 },
};
