import { describe, expect, it, vi } from 'vitest';
import { defaultDashboard } from '@irdashies/types';
import { createPreviewDashboardBridge } from './dashboardBridge';

describe('preview dashboard bridge', () => {
  const changed = { ...defaultDashboard, widgets: [] };

  it('ignores widget writes in the read-only frame but accepts host updates', () => {
    const { bridge, update } = createPreviewDashboardBridge(defaultDashboard);
    const receive = vi.fn();
    const stop = bridge.dashboardUpdated(receive);
    bridge.saveDashboard(changed);
    expect(bridge.getCurrentDashboard()).toBe(defaultDashboard);
    expect(receive).toHaveBeenCalledOnce();
    update(changed);
    expect(receive).toHaveBeenLastCalledWith(changed);
    stop?.();
    update(defaultDashboard);
    expect(receive).toHaveBeenCalledTimes(2);
  });

  it('keeps website edits in memory and notifies both widgets and the host', () => {
    const onSave = vi.fn();
    const website = createPreviewDashboardBridge(defaultDashboard, { onSave });
    const frame = createPreviewDashboardBridge(defaultDashboard);
    const receive = vi.fn();
    website.bridge.dashboardUpdated(receive);
    website.bridge.saveDashboard(changed);
    expect(website.bridge.getCurrentDashboard()).toBe(changed);
    expect(receive).toHaveBeenLastCalledWith(changed);
    expect(onSave).toHaveBeenCalledExactlyOnceWith(changed);
    expect(frame.bridge.getCurrentDashboard()).toBe(defaultDashboard);
    website.update(defaultDashboard);
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('reads assets only through the owning host callback', async () => {
    const readAsset = vi.fn(async () => 'data:image/png;base64,sample');
    const { bridge } = createPreviewDashboardBridge(defaultDashboard, {
      readAsset,
    });
    await bridge.getGarageCoverImageAsDataUrl('garage.png');
    await bridge.getPlayerIconImageAsDataUrl('driver.png');
    expect(readAsset.mock.calls).toEqual([
      ['garageCover', 'garage.png'],
      ['playerIcon', 'driver.png'],
    ]);
  });
});
