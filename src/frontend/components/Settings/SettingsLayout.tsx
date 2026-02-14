import {
  GearIcon,
  LockIcon,
  LockOpenIcon,
  PresentationChartIcon,
} from '@phosphor-icons/react';
import {
  Link,
  Route,
  Routes,
  useLocation,
  Navigate,
  useParams,
} from 'react-router-dom';
import { getWidgetName } from '../../constants/widgetNames';
import { StandingsSettings } from './sections/StandingsSettings';
import { RelativeSettings } from './sections/RelativeSettings';
import { WeatherSettings } from './sections/WeatherSettings';
import { TrackMapSettings } from './sections/TrackMapSettings';
import { FlatTrackMapSettings } from './sections/FlatTrackMapSettings';
import { AdvancedSettings } from './sections/AdvancedSettings';
import { InputSettings } from './sections/InputSettings';
import { AboutSettings } from './sections/AboutSettings';
import { FasterCarsFromBehindSettings } from './sections/FasterCarsFromBehindSettings';
import { FuelSettings } from './sections/FuelSettings';
import { RejoinIndicatorSettings } from './sections/RejoinIndicatorSettings';
import { PitlaneHelperSettings } from './sections/PitlaneHelperSettings';
import { GeneralSettings } from './sections/GeneralSettings';
import { BlindSpotMonitorSettings } from './sections/BlindSpotMonitorSettings';
import { GarageCoverSettings } from './sections/GarageCoverSettings';
import { ProfileSettings } from './sections/ProfileSettings';
import { FlagSettings } from './sections/FlagSettings';
import { CarSetupSettings } from './sections/CarSetupSettings';
import { useDashboard } from '@irdashies/context';
import { useState } from 'react';

export const SettingsLayout = () => {
  const location = useLocation();
  const {
    bridge,
    editMode,
    isDemoMode,
    toggleDemoMode,
    currentDashboard,
    currentProfile,
  } = useDashboard();
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
          <div>
            <h1 className="text-2xl font-bold">Overlay Settings</h1>
            {currentProfile && (
              <p className="text-sm text-gray-400">
                {currentProfile.name} Active
              </p>
            )}
          </div>
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
            <li>
              <Link
                to="/settings/profiles"
                className={menuItemClass('/profiles')}
              >
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
            {(() => {
              // Widgets handled elsewhere (e.g. in Advanced settings)
              const hiddenWidgets = new Set(['telemetryinspector']);

              // Deduplicate fuel widgets and filter hidden widgets
              const seenTypes = new Set<string>();
              const filteredWidgets = currentDashboard.widgets.filter(
                (widget) => {
                  const type = widget.type || widget.id;
                  if (hiddenWidgets.has(type)) return false;
                  if (type === 'fuel') {
                    if (seenTypes.has('fuel')) return false;
                    seenTypes.add('fuel');
                  }
                  return true;
                }
              );

              // Pin certain widgets at the top in a specific order
              const pinnedOrder: Record<string, number> = {
                standings: 0,
                relative: 1,
                fuel: 2,
                input: 3,
              };

              const sortedWidgets = [...filteredWidgets].sort((a, b) => {
                const typeA = a.type || a.id;
                const typeB = b.type || b.id;
                const pinA = pinnedOrder[typeA];
                const pinB = pinnedOrder[typeB];

                // Both pinned: sort by pin order
                if (pinA !== undefined && pinB !== undefined)
                  return pinA - pinB;
                // Only one pinned: pinned comes first
                if (pinA !== undefined) return -1;
                if (pinB !== undefined) return 1;
                // Neither pinned: alphabetical by display name
                const nameA = getWidgetName(typeA);
                const nameB = getWidgetName(typeB);
                return nameA.localeCompare(nameB);
              });

              return sortedWidgets.map((widget) => {
                const type = widget.type || widget.id;
                let label = widget.id; // Default fallback

                const name = getWidgetName(type);
                label = name;

                // Need to handle the case where the widget id is not the same as the type
                // This is the case for fuel widgets, where the id is "fuel-1", "fuel-2", etc.
                // and the type is "fuel"
                if (widget.id !== type && type !== 'fuel') {
                  label += ` (${widget.id})`;
                }

                // Fuel Calculator gets special path handling
                const linkPath =
                  type === 'fuel' ? '/settings/fuel' : `/settings/${widget.id}`;

                const isActive =
                  type === 'fuel'
                    ? location.pathname.includes('/settings/fuel')
                    : location.pathname === `/settings/${widget.id}`;

                return (
                  <li key={widget.id}>
                    <Link
                      to={linkPath}
                      className={`block w-full p-2 rounded cursor-pointer ${isActive ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
                    >
                      {label}
                    </Link>
                  </li>
                );
              });
            })()}
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
            <Route path="/:widgetId" element={<SettingsLoader />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

const SettingsLoader = () => {
  const { widgetId } = useParams<{ widgetId: string }>();
  const { currentDashboard } = useDashboard();

  // 1. Handle non-widget pages
  if (widgetId === 'general') return <GeneralSettings />;
  if (widgetId === 'profiles') return <ProfileSettings />;
  if (widgetId === 'advanced') return <AdvancedSettings />;
  if (widgetId === 'car-setup') return <CarSetupSettings />;
  if (widgetId === 'about') return <AboutSettings />;

  // 2. Special Manager Pages
  // FuelSettings handles its own creation/selection logic, so we always render it
  // if the route is /settings/fuel, even if no widget with id='fuel' exists.
  if (widgetId === 'fuel') {
    // If a widget explicitly named 'fuel' exists, we could pass it,
    // but FuelSettings defaults to selecting the first fuel widget anyway.
    // Passing widgetId="fuel" specifically might be safer if it exists.
    const hasFuelWidget = currentDashboard?.widgets.some(
      (w) => w.id === 'fuel'
    );
    return <FuelSettings widgetId={hasFuelWidget ? 'fuel' : undefined} />;
  }

  // 3. Find specific widget instance
  const widget = currentDashboard?.widgets.find((w) => w.id === widgetId);

  if (!widget) {
    return <div className="text-slate-400">Select a widget to edit</div>;
  }

  const type = widget.type || widget.id;

  switch (type) {
    case 'standings':
      return <StandingsSettings />;
    case 'relative':
      return <RelativeSettings />;
    case 'weather':
      return <WeatherSettings />;
    case 'fuel':
      return <FuelSettings widgetId={widget.id} />;
    case 'map':
      return <TrackMapSettings />;
    case 'flatmap':
      return <FlatTrackMapSettings />;
    case 'input':
      return <InputSettings />;
    case 'pitlanehelper':
      return <PitlaneHelperSettings />;
    case 'rejoin':
      return <RejoinIndicatorSettings />;
    case 'faster-cars':
    case 'fastercarsfrombehind':
      return <FasterCarsFromBehindSettings />;
    case 'blindspotmonitor':
      return <BlindSpotMonitorSettings />;
    case 'garagecover':
      return <GarageCoverSettings />;
    case 'flag':
      return <FlagSettings />;
    default:
      return (
        <div className="text-red-400">No settings available for {type}</div>
      );
  }
};
