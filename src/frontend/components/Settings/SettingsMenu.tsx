import { Link, useLocation } from 'react-router-dom';
import {
  SlidersHorizontalIcon,
  UsersIcon,
  TagIcon,
  ScalesIcon,
  KeyboardIcon,
  WrenchIcon,
  InfoIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useDashboard } from '@irdashies/context';

interface MenuItem {
  to: string;
  path: string;
  label: string;
  widgetType?: string;
  icon?: Icon;
}

const generalItems: MenuItem[] = [
  {
    to: '/settings/general',
    path: '/general',
    label: 'General',
    icon: SlidersHorizontalIcon,
  },
  {
    to: '/settings/profiles',
    path: '/profiles',
    label: 'Profiles',
    icon: UsersIcon,
  },
  {
    to: '/settings/driver-tags',
    path: '/driver-tags',
    label: 'Driver Tags',
    icon: TagIcon,
  },
  {
    to: '/settings/car-setup',
    path: '/car-setup',
    label: 'Setup Comparison',
    icon: ScalesIcon,
  },
  {
    to: '/settings/keybindings',
    path: '/keybindings',
    label: 'Key Bindings',
    icon: KeyboardIcon,
  },
];

const widgetItems: MenuItem[] = [
  {
    to: '/settings/blindspotmonitor',
    path: '/blindspotmonitor',
    label: 'Blind Spot Monitor',
    widgetType: 'blindspotmonitor',
  },
  {
    to: '/settings/fastercarsfrombehind',
    path: '/fastercarsfrombehind',
    label: 'Faster Cars Behind',
    widgetType: 'fastercarsfrombehind',
  },
  { to: '/settings/flag', path: '/flag', label: 'Flag', widgetType: 'flag' },
  {
    to: '/settings/flatmap',
    path: '/flatmap',
    label: 'Flat Track Map',
    widgetType: 'flatmap',
  },
  {
    to: '/settings/fuel',
    path: '/fuel',
    label: 'Fuel Calculator',
    widgetType: 'fuel',
  },
  {
    to: '/settings/garagecover',
    path: '/garagecover',
    label: 'Garage Cover',
    widgetType: 'garagecover',
  },
  {
    to: '/settings/input',
    path: '/input',
    label: 'Input',
    widgetType: 'input',
  },
  {
    to: '/settings/laptimelog',
    path: '/laptimelog',
    label: 'Lap Timer',
    widgetType: 'laptimelog',
  },
  {
    to: '/settings/pitlanehelper',
    path: '/pitlanehelper',
    label: 'Pitlane Helper',
    widgetType: 'pitlanehelper',
  },
  {
    to: '/settings/rejoin',
    path: '/rejoin',
    label: 'Rejoin Indicator',
    widgetType: 'rejoin',
  },
  {
    to: '/settings/relative',
    path: '/relative',
    label: 'Relative',
    widgetType: 'relative',
  },
  {
    to: '/settings/slowcarahead',
    path: '/slowcarahead',
    label: 'Slow Car Ahead',
    widgetType: 'slowcarahead',
  },
  {
    to: '/settings/standings',
    path: '/standings',
    label: 'Standings',
    widgetType: 'standings',
  },
  {
    to: '/settings/tachometer',
    path: '/tachometer',
    label: 'Tachometer',
    widgetType: 'tachometer',
  },
  { to: '/settings/map', path: '/map', label: 'Track Map', widgetType: 'map' },
  {
    to: '/settings/twitchchat',
    path: '/twitchchat',
    label: 'Twitch Chat',
    widgetType: 'twitchchat',
  },
  {
    to: '/settings/weather',
    path: '/weather',
    label: 'Weather',
    widgetType: 'weather',
  },
];

const bottomItems: MenuItem[] = [
  {
    to: '/settings/advanced',
    path: '/advanced',
    label: 'Advanced',
    icon: WrenchIcon,
  },
  { to: '/settings/about', path: '/about', label: 'About', icon: InfoIcon },
];

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
