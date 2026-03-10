import { Link, useLocation } from 'react-router-dom';
import {
  SlidersHorizontalIcon,
  UsersIcon,
  ScalesIcon,
  WrenchIcon,
  InfoIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

interface MenuItem {
  to: string;
  path: string;
  label: string;
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
];

const toolItems: MenuItem[] = [
  {
    to: '/settings/car-setup',
    path: '/car-setup',
    label: 'Setup Comparison',
    icon: ScalesIcon,
  },
];

const widgetItems: MenuItem[] = [
  {
    to: '/settings/blindspotmonitor',
    path: '/blindspotmonitor',
    label: 'Blind Spot Monitor',
  },
  {
    to: '/settings/fastercarsfrombehind',
    path: '/fastercarsfrombehind',
    label: 'Faster Cars Behind',
  },
  { to: '/settings/flag', path: '/flag', label: 'Flag' },
  { to: '/settings/flatmap', path: '/flatmap', label: 'Flat Track Map' },
  { to: '/settings/fuel', path: '/fuel', label: 'Fuel Calculator' },
  { to: '/settings/garagecover', path: '/garagecover', label: 'Garage Cover' },
  { to: '/settings/input', path: '/input', label: 'Input' },
  {
    to: '/settings/pitlanehelper',
    path: '/pitlanehelper',
    label: 'Pitlane Helper',
  },
  { to: '/settings/rejoin', path: '/rejoin', label: 'Rejoin Indicator' },
  { to: '/settings/relative', path: '/relative', label: 'Relative' },
  { to: '/settings/standings', path: '/standings', label: 'Standings' },
  { to: '/settings/map', path: '/map', label: 'Track Map' },
  { to: '/settings/twitchchat', path: '/twitchchat', label: 'Twitch Chat' },
  { to: '/settings/weather', path: '/weather', label: 'Weather' },
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
}: {
  item: MenuItem;
  pathname: string;
  showIcon?: boolean;
}) => {
  const isActive = pathname.startsWith(`/settings${item.path}`);
  return (
    <li>
      <Link
        to={item.to}
        className={[
          'flex items-center gap-2 w-full px-2 py-1.5 rounded cursor-pointer border-l-2 transition-colors',
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
        <span>{item.label}</span>
      </Link>
    </li>
  );
};

export const SettingsMenu = () => {
  const { pathname } = useLocation();

  return (
    <div className="w-1/4 bg-slate-800 p-3 rounded-md flex flex-col gap-1 overflow-y-auto">
      <ul className="flex flex-col gap-0.5 pb-2 border-b border-slate-700">
        {generalItems.map((item) => (
          <MenuLink key={item.path} item={item} pathname={pathname} showIcon />
        ))}
      </ul>

      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 pt-2 pb-1">
        Widgets
      </p>
      <ul className="flex flex-col gap-0.5">
        {widgetItems.map((item) => (
          <MenuLink key={item.path} item={item} pathname={pathname} />
        ))}
      </ul>

      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 pt-2 pb-1">
        Tools
      </p>
      <ul className="flex flex-col gap-0.5">
        {toolItems.map((item) => (
          <MenuLink key={item.path} item={item} pathname={pathname} />
        ))}
      </ul>

      <ul className="mt-auto pt-2 border-t border-slate-700 flex flex-col gap-0.5">
        {bottomItems.map((item) => (
          <MenuLink key={item.path} item={item} pathname={pathname} showIcon />
        ))}
      </ul>
    </div>
  );
};
