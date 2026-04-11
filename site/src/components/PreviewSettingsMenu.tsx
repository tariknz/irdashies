import { Link, useLocation } from 'react-router-dom';

interface MenuItem {
  to: string;
  id: string;
  label: string;
}

const widgetItems: MenuItem[] = [
  {
    to: '/settings/blindspotmonitor',
    id: 'blindspotmonitor',
    label: 'Blind Spot Monitor',
  },
  {
    to: '/settings/fastercarsfrombehind',
    id: 'fastercarsfrombehind',
    label: 'Faster Cars Behind',
  },
  { to: '/settings/flag', id: 'flag', label: 'Flag' },
  { to: '/settings/flatmap', id: 'flatmap', label: 'Flat Track Map' },
  { to: '/settings/fuel', id: 'fuel', label: 'Fuel Calculator' },
  { to: '/settings/garagecover', id: 'garagecover', label: 'Garage Cover' },
  { to: '/settings/infobar', id: 'infobar', label: 'Information Bar' },
  { to: '/settings/input', id: 'input', label: 'Input' },
  { to: '/settings/laptimelog', id: 'laptimelog', label: 'Lap Timer' },
  {
    to: '/settings/pitlanehelper',
    id: 'pitlanehelper',
    label: 'Pitlane Helper',
  },
  { to: '/settings/rejoin', id: 'rejoin', label: 'Rejoin Indicator' },
  { to: '/settings/relative', id: 'relative', label: 'Relative' },
  { to: '/settings/slowcarahead', id: 'slowcarahead', label: 'Slow Car Ahead' },
  { to: '/settings/standings', id: 'standings', label: 'Standings' },
  { to: '/settings/tachometer', id: 'tachometer', label: 'Tachometer' },
  { to: '/settings/map', id: 'map', label: 'Track Map' },
  { to: '/settings/twitchchat', id: 'twitchchat', label: 'Twitch Chat' },
  { to: '/settings/weather', id: 'weather', label: 'Weather' },
];

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
        {widgetItems.map((item) => {
          const isActive = pathname.startsWith(`/settings/${item.id}`);
          const isEnabled = activeWidgets.has(item.id);
          return (
            <li
              key={item.id}
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
                onClick={() => onToggleWidget(item.id)}
                className={[
                  'w-4 h-4 rounded-full shrink-0 border-2 transition-colors cursor-pointer',
                  isEnabled
                    ? 'bg-emerald-400 border-emerald-400'
                    : 'bg-transparent border-slate-600 hover:border-slate-400',
                ].join(' ')}
                title={
                  isEnabled ? `Disable ${item.label}` : `Enable ${item.label}`
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
};
