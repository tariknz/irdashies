import { useCallback, useEffect, useState } from 'react';
import logger from '@irdashies/utils/logger';
import type { ReleaseNotesPanelState } from './ReleaseNotesPanel';

export function useReleaseNotes(version: string | null) {
  const [state, setState] = useState<ReleaseNotesPanelState>({
    status: 'loading',
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!version) return;
    let active = true;
    setState({ status: 'loading' });
    const bridge = window.releaseNotesBridge;
    if (!bridge) {
      setState({ status: 'unavailable', reason: 'offline' });
      return;
    }
    bridge
      .getRelease(version)
      .then((result) => {
        if (active) setState(result);
      })
      .catch((error) => {
        logger.warn('Failed to load release notes', error);
        if (active) setState({ status: 'unavailable', reason: 'offline' });
      });
    return () => {
      active = false;
    };
  }, [version, attempt]);
  return { state, retry };
}
