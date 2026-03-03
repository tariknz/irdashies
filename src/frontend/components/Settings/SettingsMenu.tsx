import { Link, useLocation } from 'react-router-dom';

export const SettingsMenu = () => {
  const location = useLocation();

  const menuItemClass = (path: string) =>
    `block w-full p-2 rounded cursor-pointer ${
      location.pathname.startsWith(`/settings${path}`)
        ? 'bg-slate-700'
        : 'hover:bg-slate-700'
    }`;

  return (
    <div className="w-1/4 bg-slate-800 p-4 rounded-md flex flex-col overflow-y-auto">
      <ul className="flex flex-col gap-2 mb-2 border-b border-slate-700 pb-2">
        <li>
          <Link to="/settings/general" className={menuItemClass('/general')}>
            General
          </Link>
        </li>
        <li>
          <Link to="/settings/profiles" className={menuItemClass('/profiles')}>
            Profiles
          </Link>
        </li>
        <li>
          <Link
            to="/settings/car-setup"
            className={menuItemClass('/car-setup')}
          >
            Setup Comparison Tool
          </Link>
        </li>
      </ul>
      <ul className="flex flex-col gap-2 flex-1 mb-2">
        <li>
          <Link
            to="/settings/blindspotmonitor"
            className={menuItemClass('/blindspotmonitor')}
          >
            Blind Spot Monitor
          </Link>
        </li>
        <li>
          <Link
            to="/settings/fastercarsfrombehind"
            className={menuItemClass('/fastercarsfrombehind')}
          >
            Faster Cars From Behind
          </Link>
        </li>
        <li>
          <Link to="/settings/flag" className={menuItemClass('/flag')}>
            Flag
          </Link>
        </li>
        <li>
          <Link to="/settings/flatmap" className={menuItemClass('/flatmap')}>
            Flat Track Map
          </Link>
        </li>
        <li>
          <Link to="/settings/fuel" className={menuItemClass('/fuel')}>
            Fuel Calculator
          </Link>
        </li>
        <li>
          <Link
            to="/settings/garagecover"
            className={menuItemClass('/garagecover')}
          >
            Garage Cover
          </Link>
        </li>
        <li>
          <Link to="/settings/input" className={menuItemClass('/input')}>
            Input
          </Link>
        </li>
        <li>
          <Link
            to="/settings/pitlanehelper"
            className={menuItemClass('/pitlanehelper')}
          >
            Pitlane Helper
          </Link>
        </li>
        <li>
          <Link to="/settings/rejoin" className={menuItemClass('/rejoin')}>
            Rejoin Indicator
          </Link>
        </li>
        <li>
          <Link to="/settings/relative" className={menuItemClass('/relative')}>
            Relative
          </Link>
        </li>
        <li>
          <Link
            to="/settings/standings"
            className={menuItemClass('/standings')}
          >
            Standings
          </Link>
        </li>
        <li>
          <Link to="/settings/map" className={menuItemClass('/map')}>
            Track Map
          </Link>
        </li>
        <li>
          <Link
            to="/settings/twitchchat"
            className={menuItemClass('/twitchchat')}
          >
            Twitch Chat
          </Link>
        </li>
        <li>
          <Link to="/settings/weather" className={menuItemClass('/weather')}>
            Weather
          </Link>
        </li>
      </ul>
      {/* Advanced settings pushed to bottom */}
      <ul className="mt-auto pt-2 border-t border-slate-700 flex flex-col gap-2">
        <li>
          <Link to="/settings/advanced" className={menuItemClass('/advanced')}>
            Advanced
          </Link>
        </li>
        <li>
          <Link to="/settings/about" className={menuItemClass('/about')}>
            About
          </Link>
        </li>
      </ul>
    </div>
  );
};
