import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'infobar',
  component: lazyWidget(() =>
    import('./InformationBar').then((module) => ({
      default: module.InformationBar,
    }))
  ),
} satisfies WidgetModule;
