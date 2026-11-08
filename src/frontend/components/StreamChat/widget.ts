import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'streamchat',
  preview: lazyWidget(() =>
    import('./StreamChat').then((module) => ({
      default: module.StreamChatPreview,
    }))
  ),
  component: lazyWidget(() =>
    import('./StreamChat').then((module) => ({ default: module.StreamChat }))
  ),
} satisfies WidgetModule;
