import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSessionStore } from '@irdashies/context';

interface GantrySessionHold {
  /** The sim has closed and the Gantry is showing the last session's data. */
  holding: boolean;
  /** Moves on every release, so values kept for an earlier hold are dropped. */
  epoch: number;
}

const GantrySessionHoldContext = createContext<GantrySessionHold>({
  holding: false,
  epoch: 0,
});

interface GantrySessionHoldProviderProps {
  running: boolean;
  children: ReactNode;
}

/**
 * Keeps the Gantry showing the last session after the sim closes, until the
 * next session loads. Without a provider nothing is ever held.
 */
export const GantrySessionHoldProvider = ({
  running,
  children,
}: GantrySessionHoldProviderProps) => {
  const hasDrivers = useSessionStore(
    (state) => (state.session?.DriverInfo?.Drivers?.length ?? 0) > 0
  );
  const [hadSession, setHadSession] = useState(false);
  const [awaitingSession, setAwaitingSession] = useState(false);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (running && hasDrivers) setHadSession(true);
  }, [running, hasDrivers]);

  useEffect(() => {
    if (!running && hadSession) {
      setAwaitingSession(true);
    } else if (running && hasDrivers && awaitingSession) {
      setAwaitingSession(false);
      setEpoch((value) => value + 1);
    }
  }, [running, hasDrivers, hadSession, awaitingSession]);

  // Derived here rather than in the effect, so the first render after the
  // disconnect already holds instead of flashing an empty view.
  const holding =
    (!running && hadSession) || (running && awaitingSession && !hasDrivers);

  return (
    <GantrySessionHoldContext.Provider value={{ holding, epoch }}>
      {children}
    </GantrySessionHoldContext.Provider>
  );
};

export const useGantrySessionHold = (): GantrySessionHold =>
  useContext(GantrySessionHoldContext);

interface Kept<T> {
  epoch: number;
  key: string | number | null | undefined;
  value: T;
}

/**
 * Returns `live`, or while the session is held, the last non-empty value seen
 * before the sim closed. Empty values are never kept: the processors publish
 * empty snapshots on disconnect, which can arrive before the running state.
 *
 * `key` identifies the session the value belongs to. When it changes to a new
 * non-null value, the kept value is dropped so a session that ends before
 * producing anything does not show the previous one.
 */
export const useHeld = <T,>(
  live: T,
  isEmpty: (value: T) => boolean,
  key?: string | number | null
): T => {
  const { holding, epoch } = useGantrySessionHold();
  const kept = useRef<Kept<T> | null>(null);

  useEffect(() => {
    if (holding) return;
    const current = kept.current;
    if (
      current &&
      (current.epoch !== epoch ||
        (key != null && current.key != null && current.key !== key))
    ) {
      kept.current = null;
    }
    if (!isEmpty(live)) kept.current = { epoch, key, value: live };
  }, [holding, epoch, key, live, isEmpty]);

  if (holding && kept.current?.epoch === epoch) return kept.current.value;
  return live;
};
