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

  return (
    <div
      className="flex flex-col overflow-hidden bg-transparent"
      style={{
        width: `${layout.width}px`,
        height: `${layout.height}px`,
      }}
    >
      {children}
    </div>
  );
};
