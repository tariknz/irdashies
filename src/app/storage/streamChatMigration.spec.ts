import { describe, it, expect } from 'vitest';
import type { DashboardLayout, DashboardWidget } from '@irdashies/types';
import { migrateLegacyStreamChat } from './streamChatMigration';

const layout = { x: 10, y: 20, width: 300, height: 400 };

const dashboardWith = (...widgets: DashboardWidget[]): DashboardLayout =>
  ({ widgets, generalSettings: {} }) as unknown as DashboardLayout;

const legacy = (config: unknown, enabled = true): DashboardWidget => ({
  id: 'twitchchat',
  enabled,
  layout,
  config: config as Record<string, unknown>,
});

describe('migrateLegacyStreamChat', () => {
  it('leaves a dashboard without the legacy widget untouched', () => {
    const dashboard = dashboardWith({ id: 'standings', enabled: true, layout });
    expect(migrateLegacyStreamChat(dashboard)).toBe(dashboard);
  });

  it('renames the widget and keeps position and enabled state', () => {
    const result = migrateLegacyStreamChat(
      dashboardWith(legacy({ channel: 'abc' }, false))
    );
    expect(result.widgets).toHaveLength(1);
    expect(result.widgets[0]).toMatchObject({
      id: 'streamchat',
      enabled: false,
      layout,
    });
  });

  it('moves the saved settings into display and twitch', () => {
    const result = migrateLegacyStreamChat(
      dashboardWith(
        legacy({
          fontSize: 22,
          channel: 'somestreamer',
          background: { opacity: 55 },
          autoHide: { enabled: true, intervalSeconds: 40 },
        })
      )
    );
    expect(result.widgets[0].config).toEqual({
      display: {
        fontSize: 22,
        background: { opacity: 55 },
        autoHide: { enabled: true, intervalSeconds: 40 },
      },
      twitch: { channel: 'somestreamer' },
    });
  });

  it('drops values of the wrong type instead of carrying them over', () => {
    const result = migrateLegacyStreamChat(
      dashboardWith(
        legacy({
          fontSize: 'big',
          channel: 42,
          background: 'dark',
          autoHide: { enabled: 'yes', intervalSeconds: Infinity },
        })
      )
    );
    expect(result.widgets[0].config).toEqual({
      display: { background: {}, autoHide: {} },
      twitch: {},
    });
  });

  it('copes with a missing or non-object config', () => {
    for (const config of [undefined, null, 'x', [1]]) {
      const result = migrateLegacyStreamChat(dashboardWith(legacy(config)));
      expect(result.widgets[0]).toMatchObject({ id: 'streamchat', config: {} });
    }
  });

  it('migrates a typed widget instance', () => {
    const result = migrateLegacyStreamChat(
      dashboardWith({ ...legacy({}), type: 'twitchchat' })
    );
    expect(result.widgets[0]).toMatchObject({
      id: 'streamchat',
      type: 'streamchat',
    });
  });

  it('prefers an existing Stream Chat widget over the legacy one', () => {
    const existing: DashboardWidget = {
      id: 'streamchat',
      enabled: true,
      layout,
      config: { twitch: { channel: 'new' } },
    };
    const result = migrateLegacyStreamChat(
      dashboardWith(legacy({ channel: 'old' }), existing)
    );
    expect(result.widgets).toEqual([existing]);
  });

  it('does not mutate its input', () => {
    const dashboard = dashboardWith(legacy({ channel: 'abc' }));
    migrateLegacyStreamChat(dashboard);
    expect(dashboard.widgets[0].id).toBe('twitchchat');
  });
});
