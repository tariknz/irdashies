import { describe, expect, it, beforeEach } from 'vitest';
import { useSessionBestLapStore } from './SessionBestLapStore';

describe('SessionBestLapStore', () => {
  beforeEach(() => {
    useSessionBestLapStore.setState({ sessionBestLap: undefined });
  });

  it('has an undefined default before telemetry arrives', () => {
    expect(useSessionBestLapStore.getState().sessionBestLap).toBeUndefined();
  });

  it('update() sets the session best lap time', () => {
    useSessionBestLapStore.getState().update(92.345);

    expect(useSessionBestLapStore.getState().sessionBestLap).toBe(92.345);
  });
});
