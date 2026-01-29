import { PropsWithChildren } from 'react';

export interface OverlaySizeWrapperProps extends PropsWithChildren {
  layout?: { width: number; height: number };
}

/**
 * Wraps overlay components to enforce size constraints from the dashboard layout.
 * This is used when rendering components via HTTP URLs (localhost:3000/component/fuel)
 * to ensure they respect the size set in "Edit Layout (F6)" mode.
 */
export const OverlaySizeWrapper = ({ layout, children }: OverlaySizeWrapperProps) => {
  // If no layout is provided, render children without constraints
  if (!layout) {
    return <>{children}</>;
  }

  const width = Number(layout.width);
  const height = Number(layout.height);

  const style: { width?: string; height?: string } = {};
  if (Number.isFinite(width) && width > 0) {
    style.width = `${width}px`;
  }
  if (Number.isFinite(height) && height > 0) {
    style.height = `${height}px`;
  }

  return (
    <div
      className="flex flex-col overflow-hidden bg-transparent"
      style={style}
    >
      {children}
    </div>
  );
};
