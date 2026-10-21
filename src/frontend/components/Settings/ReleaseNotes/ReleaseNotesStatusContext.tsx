import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { ReleaseNotesStatus } from '@irdashies/types';
import logger from '@irdashies/utils/logger';

interface ReleaseNotesStatusContextValue {
  status: ReleaseNotesStatus | null;
  error: boolean;
  visibleSession: number;
  refresh: () => void;
  dismiss: (version: string) => Promise<void>;
  setAutoShow: (enabled: boolean) => Promise<void>;
}
const ReleaseNotesStatusContext =
  createContext<ReleaseNotesStatusContextValue | null>(null);

/** One low-frequency status source for this Settings window; no polling. */
export const ReleaseNotesStatusProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [status, setStatus] = useState<ReleaseNotesStatus | null>(null);
  const [error, setError] = useState(false);
  const [visibleSession, setVisibleSession] = useState(0);
  const generation = useRef(0);
  const active = useRef(true);
  const refresh = useCallback(() => {
    const request = ++generation.current;
    setError(false);
    if (!window.releaseNotesBridge) {
      setError(true);
      return;
    }
    window.releaseNotesBridge
      .getStatus()
      .then((value) => {
        if (active.current && request === generation.current) setStatus(value);
      })
      .catch((err) => {
        logger.warn('Failed to load release notes preferences', err);
        if (active.current && request === generation.current) setError(true);
      });
  }, []);
  useEffect(() => {
    active.current = true;
    refresh();
    const visible = () => {
      if (document.visibilityState === 'visible') {
        setVisibleSession((session) => session + 1);
        refresh();
      }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active.current = false;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  const dismiss = useCallback(async (version: string) => {
    if (!window.releaseNotesBridge) return;
    try {
      await window.releaseNotesBridge.dismiss(version);
      generation.current++;
      if (active.current)
        setStatus((old) =>
          old?.currentVersion === version
            ? { ...old, pendingVersion: null, unreadVersion: null }
            : old
        );
    } catch (err) {
      logger.warn('Failed to mark release notes as read', err);
      if (active.current) setError(true);
    }
  }, []);
  const setAutoShow = useCallback(async (enabled: boolean) => {
    if (!window.releaseNotesBridge) return;
    try {
      await window.releaseNotesBridge.setAutoShow(enabled);
      generation.current++;
      if (active.current)
        setStatus((old) =>
          old
            ? {
                ...old,
                autoShow: enabled,
                pendingVersion: enabled ? old.pendingVersion : null,
              }
            : old
        );
    } catch (err) {
      logger.warn('Failed to save release notes preference', err);
      if (active.current) setError(true);
    }
  }, []);
  return (
    <ReleaseNotesStatusContext.Provider
      value={{ status, error, visibleSession, refresh, dismiss, setAutoShow }}
    >
      {children}
    </ReleaseNotesStatusContext.Provider>
  );
};

export function useReleaseNotesStatus() {
  const value = useContext(ReleaseNotesStatusContext);
  if (!value)
    throw new Error('Release notes status requires the Settings provider');
  return value;
}
