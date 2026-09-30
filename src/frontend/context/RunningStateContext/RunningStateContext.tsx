import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { IrSdkBridge } from '@irdashies/types';
import logger from '@irdashies/utils/logger';

interface RunningStateContextProps {
  running: boolean;
}

interface RunningStateProviderProps {
  bridge: IrSdkBridge | Promise<IrSdkBridge>;
  children: ReactNode;
}

const RunningStateContext = createContext<RunningStateContextProps | undefined>(
  undefined
);

/**
 * Provides the running state of the iRacing SDK. This context is used to
 * conditionally render components based on whether iRacing is running.
 * This gets updates of the sim running state from the iRacing SDK bridge.
 *
 * @param bridge The iRacing SDK bridge
 * @param children The children to render
 * @returns The running state context provider
 */
export const RunningStateProvider = ({
  bridge,
  children,
}: RunningStateProviderProps) => {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    const attach = (resolved: IrSdkBridge) => {
      // True once a change has arrived. The snapshot below is of the moment it
      // was asked for, so anything newer must win -- a state change landing
      // while the request is in flight would otherwise be overwritten by the
      // older answer.
      let sawChange = false;

      // Subscribed before the snapshot is requested, so a change that lands
      // while it is in flight is seen rather than missed.
      unsub = resolved.onRunningState((isRunning) => {
        sawChange = true;
        setRunning(isRunning);
      });

      // Only changes are published, so a window opened mid-session would sit on
      // the initial `false` until the sim next started or stopped. A push from
      // the main process cannot fix this: the page's load event still precedes
      // this subscription, and nothing buffers a message sent before it.
      resolved
        .getRunningState?.()
        .then((isRunning) => {
          if (cancelled || sawChange || typeof isRunning !== 'boolean') return;
          setRunning(isRunning);
        })
        .catch((error) =>
          logger.warn('Failed to read the initial running state', error)
        );
    };

    if (bridge instanceof Promise) {
      bridge.then((resolved) => {
        if (cancelled) {
          resolved.stop();
          return;
        }
        attach(resolved);
      });
      return () => {
        cancelled = true;
        if (unsub) unsub();
        bridge.then((resolved) => resolved.stop());
      };
    }

    attach(bridge);
    return () => {
      cancelled = true;
      if (unsub) unsub();
      bridge.stop();
    };
  }, [bridge]);

  return (
    <RunningStateContext.Provider value={{ running }}>
      {children}
    </RunningStateContext.Provider>
  );
};

export const useRunningState = (): RunningStateContextProps => {
  const context = useContext(RunningStateContext);
  if (!context) {
    throw new Error(
      'useRunningState must be used within a RunningStateProvider'
    );
  }
  return context;
};
