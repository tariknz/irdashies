import { useEffect } from 'react';
import { Meta, StoryObj } from '@storybook/react-vite';
import { BroadcastEvents } from './BroadcastEvents';
import { IncidentType, type Incident } from '@irdashies/types';
import {
  CaptureChannelDecorator,
  TelemetryDecorator,
} from '@irdashies/storybook';

export default {
  component: BroadcastEvents,
  title: 'widgets/BroadcastEvents',
} as Meta<typeof BroadcastEvents>;

type Story = StoryObj<typeof BroadcastEvents>;

type Listener = (incident: Incident) => void;

/** Fires a fake crash and black flag through a stub channel bridge. */
const FakeIncidents = () => {
  useEffect(() => {
    const listeners = new Set<Listener>();
    const original = window.channelBridge;
    window.channelBridge = {
      ...original,
      subscribe: ((channel: string, cb: Listener) => {
        if (channel !== 'raceControl.incidents') {
          return original?.subscribe(channel as never, cb as never);
        }
        listeners.add(cb);
        return () => listeners.delete(cb);
      }) as typeof window.channelBridge.subscribe,
    } as typeof window.channelBridge;
    const fire = (id: string, type: IncidentType, carIdx: number) =>
      listeners.forEach((cb) =>
        cb({ id, type, carIdx, carNumber: '', lapNum: 3 } as Incident)
      );
    const timers = [
      setTimeout(() => fire('crash', IncidentType.Crash, 1), 500),
      setTimeout(() => fire('black', IncidentType.BlackFlag, 2), 600),
    ];
    return () => {
      timers.forEach(clearTimeout);
      window.channelBridge = original;
    };
  }, []);
  return null;
};

export const Primary: Story = {
  render: () => (
    <div className="w-[480px]">
      <FakeIncidents />
      <BroadcastEvents />
    </div>
  ),
  decorators: [
    TelemetryDecorator('/test-data/1747384033336'),
    CaptureChannelDecorator('/test-data/1747384033336'),
  ],
};
