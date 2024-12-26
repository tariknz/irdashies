import { Session } from '@irdashies/types';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

interface SessionState {
  session: Session | null;
  setSession: (session: Session) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null as Session | null,
  setSession: (session: Session) => set({ session }),
}));

export const useSession = () =>
  useSessionStore(useShallow((state) => state.session));

export const useDrivers = () =>
  useSessionStore(useShallow((state) => state.session?.DriverInfo?.Drivers));
