import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '@irdashies/context';
import type { Session } from '@irdashies/types';
import { useTrackRubberedState } from './useTrackRubberedState';

const withSessions = (states: string[]) =>
  useSessionStore.setState({
    session: {
      SessionInfo: {
        Sessions: states.map((state, index) => ({
          SessionNum: index,
          SessionTrackRubberState: state,
        })),
      },
    } as unknown as Session,
  });

const rubber = () => renderHook(() => useTrackRubberedState()).result.current;

describe('useTrackRubberedState', () => {
  afterEach(() => {
    useSessionStore.setState({ session: null });
  });

  it('reads the latest session state', () => {
    withSessions(['clean', 'moderate usage']);
    expect(rubber()).toBe('moderate usage');
  });

  it('looks past a carry-over session to the state it carries', () => {
    // A session that carries the rubber over states nothing of its own.
    withSessions(['high usage', 'carry over']);
    expect(rubber()).toBe('high usage');
  });

  it('reads an empty state as unknown', () => {
    // LMU has no rubber model and sends '' -- a blank, not a state.
    withSessions(['']);
    expect(rubber()).toBeUndefined();
  });

  it('is unknown with no session at all', () => {
    expect(rubber()).toBeUndefined();
  });
});
