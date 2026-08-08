import { useEffect } from 'react';
import type { ChannelBridge } from '@irdashies/types';
import { useReferenceLapStore } from './ReferenceLapStore';

/** Mirrors main-process reference-lap snapshots into the compatibility store. */
export const useReferenceLapStoreUpdater = (
  bridge: ChannelBridge | undefined = window.channelBridge
) => {
  useEffect(() => {
    if (!bridge) return;
    const unsubscribe = bridge.subscribe(
      'reference-laps.snapshot',
      (snapshot) => {
        useReferenceLapStore.setState({
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
