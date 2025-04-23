import { Gear } from '@phosphor-icons/react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { StandingsSettings } from './sections/StandingsSettings';
import { RelativeSettings } from './sections/RelativeSettings';
import { WeatherSettings } from './sections/WeatherSettings';
import { TrackMapSettings } from './sections/TrackMapSettings';
import { AdvancedSettings } from './sections/AdvancedSettings';

export const SettingsLayout = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === `/settings${path}`;
  };

  const menuItemClass = (path: string) =>
    `block w-full p-2 rounded cursor-pointer ${
      isActive(path) ? 'bg-slate-700' : 'hover:bg-slate-700'
    }`;

  return (
    <div className="flex flex-col gap-4 bg-slate-700 p-4 rounded-md w-full h-full">
      <div className="flex flex-row gap-4 items-center">
        <Gear size={32} weight="bold" />
        <h1 className="text-2xl font-bold">Overlay Setup</h1>
      </div>
      <div className="flex flex-row gap-4 flex-1">
        {/* Left Column - Widget Menu */}
        <div className="w-1/3 bg-slate-800 p-4 rounded-md flex flex-col">
          <ul className="flex flex-col gap-2 flex-1">
            <li>
              <Link to="/settings/standings" className={menuItemClass('/standings')}>
                Standings
              </Link>
            </li>
            <li>
              <Link to="/settings/relative" className={menuItemClass('/relative')}>
                Relative
              </Link>
            </li>
            <li>
              <Link to="/settings/weather" className={menuItemClass('/weather')}>
                Weather
              </Link>
            </li>
            <li>
              <Link to="/settings/track-map" className={menuItemClass('/track-map')}>
                <div className="flex flex-row gap-2 items-center">
                  Track Map
                  <span className="text-xs bg-yellow-600 text-yellow-100 px-2 py-0.5 rounded-full flex flex-row gap-1 items-center">
                    Experimental
                  </span>
                </div>
              </Link>
            </li>
          </ul>
          {/* Advanced settings pushed to bottom */}
          <div className="mt-auto pt-4 border-t border-slate-700">
            <Link to="/settings/advanced" className={menuItemClass('/advanced')}>
              Advanced
            </Link>
          </div>
        </div>

        {/* Right Column - Widget Settings */}
        <div className="w-2/3 bg-slate-800 p-4 rounded-md">
          <Routes>
            <Route path="standings" element={<StandingsSettings />} />
            <Route path="relative" element={<RelativeSettings />} />
            <Route path="weather" element={<WeatherSettings />} />
            <Route path="track-map" element={<TrackMapSettings />} />
            <Route path="advanced" element={<AdvancedSettings />} />
            <Route
              path="*"
              element={
                <div className="text-slate-400">
                  Select a widget from the left to customize its settings
                </div>
              }
            />
          </Routes>
        </div>
      </div>
    </div>
  );
};
