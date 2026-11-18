import type { Decorator } from '@storybook/react-vite';
import { useEffect, useRef } from 'react';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
  RacePlanProgressSnapshot,
  RacePlanState,
  Session,
} from '@irdashies/types';
import {
  DashboardProvider,
  useRacePlanStore,
  useSessionStore,
} from '@irdashies/context';
import { mockDashboardBridge } from './mockDashboardBridge';

interface RacePlanStoryData {
  /** Undefined leaves the channel silent, as before the first publish. */
  snapshot?: RacePlanProgressSnapshot;
  state?: RacePlanState | null;
  /** iRacing id of the user running the client. */
  userId?: number;
}

/**
 * Supplies the race plan progress channel, the race plan store and the
 * logged-in user's id, so a race plan widget renders without a backend.
 */
export const RacePlanDecorator = ({
  snapshot,
  state = null,
  userId,
}: RacePlanStoryData): Decorator => {
  const bridge: ChannelBridge = {
    subscribe: <K extends ChannelName>(
      channel: K,
      callback: (payload: ChannelPayloads[K]) => void
    ) => {
      if (channel === 'race-plan.progress' && snapshot) {
        callback(snapshot as ChannelPayloads[K]);
      }
      return () => undefined;
    },
  };

  const DecoratorComponent: Decorator = (Story) => {
    const previousBridge = useRef(window.channelBridge);
    window.channelBridge = bridge;
    useRacePlanStore.setState({ state });
    useSessionStore.setState({
      session:
        userId === undefined
          ? null
          : ({ DriverInfo: { DriverUserID: userId } } as unknown as Session),
    });
    useEffect(
      () => () => {
        if (previousBridge.current === undefined) {
          Reflect.deleteProperty(window, 'channelBridge');
        } else {
          window.channelBridge = previousBridge.current;
        }
        useRacePlanStore.setState({ state: null });
        useSessionStore.setState({ session: null });
      },
      []
    );
    return (
      <DashboardProvider bridge={mockDashboardBridge}>
        <Story />
      </DashboardProvider>
    );
  };
  return DecoratorComponent;
};
