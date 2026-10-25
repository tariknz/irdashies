import { Link, useLocation } from 'react-router-dom';

import { widgetItems } from '@irdashies/frontend/components/Settings/menuItems';
import type { WidgetId } from '@irdashies/types';
import { EXCLUDED_WIDGETS } from '../utils/previewWidgets';

const previewWidgetItems = widgetItems.filter(
  (item) =>
    !item.hideInMenu && !EXCLUDED_WIDGETS.has(item.widgetType as WidgetId)
);

interface PreviewSettingsMenuProps {
  activeWidgets: Set<string>;
  onToggleWidget: (id: string) => void;
}

export const PreviewSettingsMenu = ({
  activeWidgets,
  onToggleWidget,
}: PreviewSettingsMenuProps) => {
  const { pathname } = useLocation();

  return (
    <div className="w-1/4 bg-slate-800 p-3 rounded-md flex flex-col gap-0 overflow-y-auto">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 pb-1">
        App
      </p>
      <ul className="flex flex-col mb-3">
        <li
          className={[
            'flex items-center gap-2 w-full px-2 py-1 rounded border-l-2 transition-colors',
            pathname === '/settings/general'
              ? 'border-blue-400 bg-slate-700 text-white'
              : 'border-transparent text-slate-400 hover:bg-slate-700/50 hover:text-white',
          ].join(' ')}
        >
          <Link to="/settings/general" className="flex-1 cursor-pointer">
            General
          </Link>
        </li>
      </ul>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 pb-1">
        Widgets
      </p>
      <ul className="flex flex-col">
        {previewWidgetItems.map((item) => {
          const isActive = pathname === item.to;
          const isEnabled = item.groupTypes
            ? item.groupTypes.some((type) => activeWidgets.has(type))
            : activeWidgets.has(item.widgetType ?? '');
          return (
            <li
              key={item.path}
              className={[
                'flex items-center gap-2 w-full px-2 py-1 rounded border-l-2 transition-colors',
                isActive
                  ? 'border-blue-400 bg-slate-700 text-white'
                  : 'border-transparent text-slate-400 hover:bg-slate-700/50 hover:text-white',
              ].join(' ')}
            >
              <Link to={item.to} className="flex-1 cursor-pointer">
                {item.label}
              </Link>
              <button
                onClick={() => {
                  const types = item.groupTypes ?? [item.widgetType ?? ''];
                  for (const type of types) {
                    if (type && activeWidgets.has(type) === isEnabled) {
                      onToggleWidget(type);
                    }
                  }
                }}
                aria-label={`Toggle ${item.label}`}
                aria-pressed={isEnabled}
                className={[
                  'w-2 h-2 rounded-full shrink-0 transition-colors',
                  isEnabled
                    ? 'bg-emerald-400'
                    : 'bg-transparent border-slate-600 hover:border-slate-400',
                ].join(' ')}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
};
