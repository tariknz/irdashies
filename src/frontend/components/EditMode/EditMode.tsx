import { PropsWithChildren } from 'react';
import { useDashboard } from '@irdashies/context';
import { ResizeIcon } from '@phosphor-icons/react';
import { getWidgetName } from '../../constants/widgetNames';

/**
 * Extract widget ID from the current URL hash
 * e.g., "#/fuel" -> "fuel", "#/standings" -> "standings"
 */
function getWidgetIdFromUrl(): string | null {
  const hash = window.location.hash;
  // Remove leading # and /
  const path = hash.replace(/^#\/?/, '');
  // Remove any query parameters
  const widgetId = path.split('?')[0];
  // Return null if it's the settings route or empty
  if (!widgetId || widgetId.startsWith('settings')) {
    return null;
  }
  return widgetId;
}

export const EditMode = ({ children }: PropsWithChildren) => {
  const { editMode } = useDashboard();
  if (editMode) {
    const widgetId = getWidgetIdFromUrl();
    const widgetName = widgetId ? getWidgetName(widgetId) : null;

    return (
      <div className="relative w-full h-full">
        <div className="animate-pulse-border z-20 absolute w-full h-full border-solid border-2 border-sky-500 cursor-move">
          <div className="flex items-center gap-2 absolute top-0 right-0 py-1 px-2 bg-sky-500 text-white cursor-move">
            <ResizeIcon />
            <span>
              {widgetName ?? 'Edit Mode'}
            </span>
          </div>
        </div>
        {children}
      </div>
    );
  }
  return <>{children}</>;
};
