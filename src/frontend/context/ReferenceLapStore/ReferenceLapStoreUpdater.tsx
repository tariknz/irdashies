import { useEffect } from 'react';
import type { ChannelBridge } from '@irdashies/types';
import { useReferenceLapStore } from './ReferenceLapStore';

/** Mirrors main-process reference-lap snapshots into the compatibility store. */
export const useReferenceLapStoreUpdater = (
  bridge: ChannelBridge = window.channelBridge
) => {
  useEffect(() => {
    const unsubscribe = bridge.subscribe(
      'reference-laps.snapshot',
      (snapshot) => {
        useReferenceLapStore.setState({
          activeLaps: new Map(),
          bestLaps: new Map(snapshot.bestLaps),
          persistedLaps: new Map(snapshot.persistedLaps),
        });
      }
    );
    return () => {
      unsubscribe();
      useReferenceLapStore.getState().completeSession();
    };
  }, [bridge]);
};
