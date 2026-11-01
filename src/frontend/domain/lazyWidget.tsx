import { lazy, Suspense, type ComponentType } from 'react';

/** Keep widget registration cheap; load an implementation only when it renders. */
export function lazyWidget<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>
): ComponentType<Props> {
  const Component = lazy(load);
  const LazyWidget = (props: Props) => (
    <Suspense fallback={null}>
      <Component {...props} />
    </Suspense>
  );
  LazyWidget.displayName = 'LazyWidget';
  return LazyWidget;
}
