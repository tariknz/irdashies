import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  Session,
  Telemetry,
  TelemetryInspectorBridge,
} from '@irdashies/types';
import { useSessionStore } from '../SessionStore/SessionStore';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { TelemetryInspectorProvider } from './TelemetryInspectorProvider';

describe('TelemetryInspectorProvider', () => {
  it('subscribes to both diagnostic streams and releases them on unmount', () => {
    let telemetryCallback: ((value: Telemetry) => void) | undefined;
    let sessionCallback: ((value: Session) => void) | undefined;
    const unsubscribeTelemetry = vi.fn();
    const unsubscribeSession = vi.fn();
    const bridge: TelemetryInspectorBridge = {
      onTelemetry: (callback) => {
        telemetryCallback = callback;
        return unsubscribeTelemetry;
      },
      onSessionData: (callback) => {
        sessionCallback = callback;
        return unsubscribeSession;
      },
    };

    const { unmount } = render(<TelemetryInspectorProvider bridge={bridge} />);
    const telemetry = { Speed: { value: [42] } } as Telemetry;
    const session = { WeekendInfo: { TrackName: 'Test Track' } } as Session;
    telemetryCallback?.(telemetry);
    sessionCallback?.(session);

    expect(useTelemetryStore.getState().telemetry).toBe(telemetry);
    expect(useSessionStore.getState().session).toBe(session);

    unmount();
    expect(unsubscribeTelemetry).toHaveBeenCalledOnce();
    expect(unsubscribeSession).toHaveBeenCalledOnce();
  });
});
