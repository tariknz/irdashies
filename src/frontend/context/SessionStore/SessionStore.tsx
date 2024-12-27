import type { Session } from '@irdashies/types';
import { create } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { driverListCompare } from './driverCompare';

interface SessionState {
  session: Session | null;
  setSession: (session: Session) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null as Session | null,
  setSession: (session: Session) => set({ session }),
}));

export const useSessionDrivers = () =>
  useStoreWithEqualityFn(
    useSessionStore,
    (state) => state.session?.DriverInfo?.Drivers,
    driverListCompare
  );
