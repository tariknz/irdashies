import { useEffect, useState } from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { SpeakerHighIcon } from '@phosphor-icons/react';
import type { ChannelPayloads } from '@irdashies/types';
import { TelemetryDecorator } from '@irdashies/storybook';
import { useRadioActiveCarIdxs } from '@irdashies/domain';

const DEMO_CAR_IDX = 7;

const subscribers = new Set<
  (snapshot: ChannelPayloads['radio.snapshot']) => void
>();
let version = 0;
const setRadioTransmit = (carIdxs: number[]) => {
  version += 1;
  subscribers.forEach((subscriber) =>
    subscriber({ transmittingCarIdxs: carIdxs, version })
  );
};

const RadioChannelDecorator: Decorator = (Story) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const previousBridge = window.channelBridge;
    window.channelBridge = {
      subscribe: (channel, callback, requestedRateHz) => {
        if (channel !== 'radio.snapshot') {
          return previousBridge?.subscribe(channel, callback, requestedRateHz);
        }
        const subscriber = callback as (
          snapshot: ChannelPayloads['radio.snapshot']
        ) => void;
        subscribers.add(subscriber);
        subscriber({ transmittingCarIdxs: [], version });
        return () => subscribers.delete(subscriber);
      },
    };
    setReady(true);
    return () => {
      subscribers.clear();
      window.channelBridge = previousBridge;
    };
  }, []);
  return ready ? <Story /> : <></>;
};

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
    setRadioTransmit([]);

    const timers: ReturnType<typeof setTimeout>[] = [];
    const transmit = (on: boolean) => {
      setRawTransmitting(on);
      setRadioTransmit(on ? [DEMO_CAR_IDX] : []);
    };

    if (mode === 'flip-flap') {
      // Rapidly key the radio on/off — the bug that used to make the icon
      // strobe. Each completed burst starts a fresh persistence window.
      let on = false;
      const id = setInterval(() => {
        on = !on;
        transmit(on);
      }, 500);
      return () => {
        clearInterval(id);
        setRadioTransmit([]);
      };
    }

    // single-burst: transmit once, go silent, watch the icon linger then clear.
    timers.push(setTimeout(() => transmit(true), 800));
    timers.push(setTimeout(() => transmit(false), 1600));
    return () => {
      timers.forEach(clearTimeout);
      setRadioTransmit([]);
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
          ? `Raw signal flips every 500ms, but each completed burst starts a fresh ${persistenceSeconds}s persistence window.`
          : `A single burst lights the icon, then it lingers for ${persistenceSeconds}s after the last transmit frame before clearing.`}
      </p>
    </div>
  );
};

const meta: Meta<typeof RadioDebounceHarness> = {
  title: 'widgets/Standings/hooks/useRadioActiveCarIdxs',
  component: RadioDebounceHarness,
  decorators: [TelemetryDecorator(), RadioChannelDecorator],
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
