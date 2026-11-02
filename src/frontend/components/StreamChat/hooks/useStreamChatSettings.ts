import { useDashboard } from '@irdashies/context';
import {
  deepMergeConfig,
  getWidgetDefaultConfig,
  type StreamChatConfig,
  type StreamChatWidgetSettings,
} from '@irdashies/types';

const DEFAULT_CONFIG = getWidgetDefaultConfig('streamchat');

export const useStreamChatSettings = (): StreamChatWidgetSettings => {
  const { currentDashboard } = useDashboard();

  const saved = currentDashboard?.widgets.find((w) => w.id === 'streamchat');

  if (saved && typeof saved === 'object') {
    return {
      enabled: saved.enabled ?? false,
      config: deepMergeConfig(
        DEFAULT_CONFIG as unknown as Record<string, unknown>,
        saved.config
      ) as unknown as StreamChatConfig,
    };
  }

  return { enabled: false, config: DEFAULT_CONFIG };
};
