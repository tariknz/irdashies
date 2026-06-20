import { Link, useLocation } from 'react-router-dom';
import { useDashboard } from '@irdashies/context';
import {
  generalItems,
  widgetItems,
  bottomItems,
  type MenuItem,
} from './menuItems';

const MenuLink = ({
  item,
  pathname,
  showIcon = false,
  isEnabled,
}: {
  item: MenuItem;
  pathname: string;
  showIcon?: boolean;
  isEnabled?: boolean;
}) => {
  const isActive = pathname.startsWith(`/settings${item.path}`);
  return (
    <li>
      <Link
        to={item.to}
        className={[
          'flex items-center gap-2 w-full px-2 py-1 rounded cursor-pointer border-l-2 transition-colors',
          isActive
            ? 'border-blue-400 bg-slate-700 text-white'
            : 'border-transparent text-slate-400 hover:bg-slate-700/50 hover:text-white',
        ].join(' ')}
      >
        {showIcon && item.icon && (
          <item.icon
            size={14}
            weight={isActive ? 'bold' : 'regular'}
            className="shrink-0"
          />
        )}
        <span className="flex-1">{item.label}</span>
        {isEnabled && (
          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-400" />
        )}
      </Link>
    </li>
  );
};

export const SettingsMenu = () => {
  const { pathname } = useLocation();
  const { currentDashboard } = useDashboard();

  const isWidgetEnabled = (widgetType: string) => {
    const widget = currentDashboard?.widgets.find(
      (w) => (w.type ?? w.id) === widgetType
    );
    return widget?.enabled ?? false;
  };

  return (
    <div className="w-1/4 bg-slate-800 p-3 rounded-md flex flex-col gap-0 overflow-y-auto">
      <ul className="flex flex-col pb-2 border-b border-slate-700">
        {generalItems.map((item) => (
          <MenuLink key={item.path} item={item} pathname={pathname} showIcon />
        ))}
      </ul>

      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 pt-2 pb-1">
        Widgets
      </p>
      <ul className="flex flex-col">
        {widgetItems.map((item) => (
          <MenuLink
            key={item.path}
            item={item}
            pathname={pathname}
            isEnabled={
              item.widgetType ? isWidgetEnabled(item.widgetType) : undefined
            }
          />
        ))}
      </ul>

      <ul className="mt-auto pt-2 border-t border-slate-700 flex flex-col">
        {bottomItems.map((item) => (
          <MenuLink key={item.path} item={item} pathname={pathname} showIcon />
        ))}
      </ul>
    </div>
  );
};
