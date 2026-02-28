import { useDashboard } from '@irdashies/context';
import type { TwitchChatWidgetSettings } from '../../Settings/types';

const DEFAULT_CONFIG: TwitchChatWidgetSettings = {
  enabled: false,
  config: {
    fontSize: 16,
    channel: '',
    background: {
      opacity: 30,
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
      },
    } as TwitchChatWidgetSettings;
  }

  return DEFAULT_CONFIG;
};
