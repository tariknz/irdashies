import {
  GearIcon,
  LockIcon,
  LockOpenIcon,
  PresentationChartIcon,
} from '@phosphor-icons/react';
import { Link, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { StandingsSettings } from './sections/StandingsSettings';
import { RelativeSettings } from './sections/RelativeSettings';
import { WeatherSettings } from './sections/WeatherSettings';
import { TrackMapSettings } from './sections/TrackMapSettings';
import { AdvancedSettings } from './sections/AdvancedSettings';
import { InputSettings } from './sections/InputSettings';
import { AboutSettings } from './sections/AboutSettings';
import { FasterCarsFromBehindSettings } from './sections/FasterCarsFromBehindSettings';
import { FuelSettings } from './sections/FuelSettings';
import { GeneralSettings } from './sections/GeneralSettings';
import { BlindSpotMonitorSettings } from './sections/BlindSpotMonitorSettings';
import { useDashboard } from '@irdashies/context';
import { useState } from 'react';

export const SettingsLayout = () => {
  const location = useLocation();
  const { bridge, editMode, isDemoMode, toggleDemoMode, currentDashboard } =
    useDashboard();
  const [isLocked, setIsLocked] = useState(!editMode);

  const isActive = (path: string) => {
    return location.pathname === `/settings${path}`;
  };

  const menuItemClass = (path: string) =>
    `block w-full p-2 rounded cursor-pointer ${
      isActive(path) ? 'bg-slate-700' : 'hover:bg-slate-700'
    }`;

  const handleToggleLock = async () => {
    const locked = await bridge.toggleLockOverlays();
    setIsLocked(locked);
  };

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <div className="flex flex-col gap-4 bg-slate-700 p-4 rounded-md w-full h-full">
      <div className="flex flex-row gap-4 items-center justify-between">
        <div className="flex flex-row gap-4 items-center">
          <GearIcon size={32} weight="bold" />
          <h1 className="text-2xl font-bold">Overlay Setup</h1>
        </div>
        <div className="flex flex-row gap-2">
          <button
            onClick={toggleDemoMode}
            className="flex flex-row gap-2 items-center px-3 py-2 rounded bg-slate-800 hover:bg-slate-600 transition-colors"
          >
            {isDemoMode ? (
              <>
                <PresentationChartIcon size={20} weight="bold" />
                <span>Exit Demo</span>
              </>
            ) : (
              <>
                <PresentationChartIcon size={20} weight="bold" />
                <span>Demo Mode</span>
              </>
            )}
          </button>
          <button
            onClick={handleToggleLock}
            className="flex flex-row gap-2 items-center px-3 py-2 rounded bg-slate-800 hover:bg-slate-600 transition-colors"
          >
            {isLocked ? (
              <>
                <LockIcon size={20} weight="bold" />
                <span>Edit Layout (F6)</span>
              </>
            ) : (
              <>
                <LockOpenIcon size={20} weight="bold" />
                <span>Editing Layout (F6)</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="flex flex-row gap-4 flex-1 min-h-0 text-sm">
        {/* Left Column - Widget Menu */}
        <div className="w-1/4 bg-slate-800 p-4 rounded-md flex flex-col overflow-y-auto">
          <ul className="flex flex-col gap-2 mb-2 border-b border-slate-700 pb-2">
            <li>
              <Link
                to="/settings/general"
                className={menuItemClass('/general')}
              >
                General
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
                to="/settings/faster-cars"
                className={menuItemClass('/faster-cars')}
              >
                Faster Cars
              </Link>
            </li>
            <li>
              <Link to="/settings/fuel" className={menuItemClass('/fuel')}>
                Fuel Calculator
              </Link>
            </li>
            <li>
              <Link to="/settings/input" className={menuItemClass('/input')}>
                Input Traces
              </Link>
            </li>
            <li>
              <Link
                to="/settings/relative"
                className={menuItemClass('/relative')}
              >
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
                <div className="flex flex-row gap-2 items-center">
                  Track Map
                </div>
              </Link>
            </li>
            <li>
              <Link
                to="/settings/weather"
                className={menuItemClass('/weather')}
              >
                Weather
              </Link>
            </li>
          </ul>
          {/* Advanced settings pushed to bottom */}
          <ul className="mt-auto pt-2 border-t border-slate-700 flex flex-col gap-2">
            <li>
              <Link
                to="/settings/advanced"
                className={menuItemClass('/advanced')}
              >
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

        {/* Right Column - Widget Settings */}
        <div className="w-3/4 bg-slate-800 p-4 rounded-md flex flex-col overflow-hidden">
          <Routes>
            <Route
              path="/"
              element={<Navigate to="/settings/general" replace />}
            />
            <Route path="general" element={<GeneralSettings />} />
            <Route path="standings" element={<StandingsSettings />} />
            <Route path="relative" element={<RelativeSettings />} />
            <Route path="weather" element={<WeatherSettings />} />
            <Route path="fuel" element={<FuelSettings />} />
            <Route path="map" element={<TrackMapSettings />} />
            <Route path="input" element={<InputSettings />} />
            <Route
              path="faster-cars"
              element={<FasterCarsFromBehindSettings />}
            />
            <Route
              path="blindspotmonitor"
              element={<BlindSpotMonitorSettings />}
            />
            <Route path="advanced" element={<AdvancedSettings />} />
            <Route path="about" element={<AboutSettings />} />
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
