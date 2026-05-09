import { useDashboard } from '@irdashies/context';
import type { TwitchChatWidgetSettings } from '@irdashies/types';

const DEFAULT_CONFIG: TwitchChatWidgetSettings = {
  enabled: false,
  config: {
    fontSize: 16,
    channel: '',
    background: {
      opacity: 30,
    },
    autoHide: {
      enabled: false,
      intervalSeconds: 20,
    },
  },
};

export const useTwitchChatSettings = () => {
  const { currentDashboard } = useDashboard();

  const saved = currentDashboard?.widgets.find((w) => w.id === 'twitchchat') as
    | TwitchChatWidgetSettings
    | undefined;

  if (saved && typeof saved === 'object') {
    return {
      enabled: saved.enabled ?? DEFAULT_CONFIG.enabled,
      config: {
        background: {
          opacity:
            saved.config.background?.opacity ??
            DEFAULT_CONFIG.config.background.opacity,
        },
        fontSize: saved.config?.fontSize ?? DEFAULT_CONFIG.config.fontSize,
        channel: saved.config?.channel ?? DEFAULT_CONFIG.config.channel,
        autoHide: {
          enabled:
            saved.config.autoHide?.enabled ??
            DEFAULT_CONFIG.config.autoHide.enabled,
          intervalSeconds:
            saved.config.autoHide?.intervalSeconds ??
            DEFAULT_CONFIG.config.autoHide.intervalSeconds,
        },
      },
    } as TwitchChatWidgetSettings;
  }

  return DEFAULT_CONFIG;
};
