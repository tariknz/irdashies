import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ChannelBridge,
  DashboardLayout,
  PitLaneCalibration,
  Session,
} from '@irdashies/types';
import { usePitLaneStore, useSessionStore } from '@irdashies/context';
import { RendererDataProviders } from './RendererDataProviders';

let dashboard: DashboardLayout;
const callbacks = new Set<(calibration: PitLaneCalibration) => void>();
const telemetry = [[false], [3], [0.9]];
vi.mock('../../context/ChannelStore', () => ({
  useTrackStateSelector: () => telemetry,
}));
vi.mock('@irdashies/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@irdashies/context')>()),
  useDashboard: () => ({ currentDashboard: dashboard }),
  useWidgetsForThisDisplay: () =>
    dashboard.widgets.filter((widget) => widget.enabled),
  SessionProvider: () => null,
  ReferenceStoreProvider: () => null,
  TelemetryInspectorProvider: () => null,
}));

const layout = { x: 0, y: 0, width: 100, height: 100 };
const PitExitConsumer = () => {
  const exit = usePitLaneStore((state) => state.pitExitPct);
  return <div>{exit ?? 'unknown exit'}</div>;
};

beforeEach(() => {
  callbacks.clear();
  usePitLaneStore.getState().reset();
  useSessionStore.setState({
    session: { WeekendInfo: { TrackID: 47 } } as Session,
  });
  window.channelBridge = {
    subscribe: (
      _channel: unknown,
      callback: (calibration: PitLaneCalibration) => void
    ) => {
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    },
  } as unknown as ChannelBridge;
  window.pitLaneBridge = {
    getPitLaneData: async (trackId) => ({
      trackId,
      sourceId: 'test-source',
      revision: 0,
      data: { pitEntryPct: 0.9, pitExitPct: 0.05 },
    }),
    updatePitLaneData: async () => true,
    getCurrentTrackPitLaneInfo: async () => null,
    resetPitLaneData: async () => undefined,
  };
});

describe('pit calibration consumers after disabling Pitlane Helper', () => {
  it.each(['standings', 'relative'])(
    'keeps the real provider subscribed for %s and applies a reset',
    async (consumer) => {
      dashboard = {
        widgets: [
          { id: 'pitlanehelper', enabled: true, layout },
          { id: consumer, enabled: true, layout },
        ],
      };
      const view = render(
        <>
          <RendererDataProviders />
          <PitExitConsumer />
        </>
      );
      await screen.findByText('0.05');
      expect(callbacks.size).toBe(1);
      dashboard = {
        widgets: dashboard.widgets.map((widget) =>
          widget.id === 'pitlanehelper' ? { ...widget, enabled: false } : widget
        ),
      };
      view.rerender(
        <>
          <RendererDataProviders />
          <PitExitConsumer />
        </>
      );
      expect(callbacks.size).toBe(1);
      act(() =>
        callbacks.forEach((callback) =>
          callback({
            trackId: '47',
            sourceId: 'test-source',
            revision: 1,
            data: null,
          })
        )
      );
      expect(screen.getByText('unknown exit')).toBeInTheDocument();
    }
  );
});
