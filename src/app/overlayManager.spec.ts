import { describe, expect, it, vi } from 'vitest';
import {
  refreshSessionDataForVisibleWindow,
  type RendererDataSubscriptions,
} from './rendererDataVisibility';

describe('overlay renderer data visibility recovery', () => {
  it('replays the latest session snapshot when a subscribed window is shown', () => {
    const send = vi.fn();
    let visible = false;
    const win = {
      isDestroyed: () => false,
      isVisible: () => visible,
      webContents: { id: 42, send },
    };
    const subscriptions: RendererDataSubscriptions = {
      has: (rendererId, stream) =>
        rendererId === 42 && stream === 'sessionData',
      hasAny: () => true,
    };
    const snapshot = { WeekendInfo: { TrackName: 'Test Track' } };

    expect(
      refreshSessionDataForVisibleWindow(win, subscriptions, snapshot)
    ).toBe(false);
    expect(send).not.toHaveBeenCalled();

    visible = true;
    expect(
      refreshSessionDataForVisibleWindow(win, subscriptions, snapshot)
    ).toBe(true);
    expect(send).toHaveBeenCalledWith('sessionData', snapshot);
  });

  it('does not replay session data without an active subscription', () => {
    const send = vi.fn();
    const win = {
      isDestroyed: () => false,
      isVisible: () => true,
      webContents: { id: 42, send },
    };
    const subscriptions: RendererDataSubscriptions = {
      has: () => false,
      hasAny: () => false,
    };

    expect(
      refreshSessionDataForVisibleWindow(win, subscriptions, { value: 1 })
    ).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
