import {
  GearIcon,
  LockIcon,
  LockOpenIcon,
  PresentationChartIcon,
} from '@phosphor-icons/react';
import { Link, Route, Routes, useLocation, Navigate, useParams } from 'react-router-dom';
import { Fragment } from 'react';
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
import { FlagSettings } from './sections/FlagSettings';
import { PitlaneHelperSettings } from './sections/PitlaneHelperSettings';
import { GeneralSettings } from './sections/GeneralSettings';
import { BlindSpotMonitorSettings } from './sections/BlindSpotMonitorSettings';
import { GarageCoverSettings } from './sections/GarageCoverSettings';
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
    `block w-full p-2 rounded cursor-pointer ${isActive(path) ? 'bg-slate-700' : 'hover:bg-slate-700'
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
          <h1 className="text-2xl font-bold">Overlay Settings</h1>
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
            {(() => {
              const standingsIndex = currentDashboard.widgets.findIndex(w => (w.type || w.id) === 'standings');
              const fuelLink = (
                 <li key="fuel-main-link">
                   <Link 
                      to="/settings/fuel" 
                      className={`block w-full p-2 rounded cursor-pointer ${location.pathname.includes('/settings/fuel') ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
                   >
                      Fuel Calculator
                   </Link>
                 </li>
              );

              const items = currentDashboard.widgets.map((widget, index) => {
                const type = widget.type || widget.id;
                let label = widget.id; // Default fallback

                // Friendly Labels Map
                const labels: Record<string, string> = {
                   'blindspotmonitor': 'Blind Spot Monitor',
                   'faster-cars': 'Faster Cars',
                   'fastercarsfrombehind': 'Faster Cars',
                   'flatmap': 'Flat Track Map',
                   'fuel': 'Fuel Calculator',
                   'garagecover': 'Garage Cover',
                   'input': 'Input Traces',
                   'pitlanehelper': 'Pitlane Helper',
                   'rejoin': 'Rejoin Indicator',
                   'relative': 'Relative',
                   'standings': 'Standings',
                   'map': 'Track Map',
                   'weather': 'Weather'
                };


                // Filter out Fuel widgets from distinct items - they are handled by the single 'Fuel Calculator' entry
                if (type === 'fuel' || widget.id === 'fuel' || widget.id.startsWith('fuel')) {
                    return null;
                }

                if (labels[type]) {
                    label = labels[type];
                    if (widget.id !== type) {
                        label += ` (${widget.id})`;
                    }
                }
                
                const item = (
                    <li key={widget.id}>
                       <Link to={`/settings/${widget.id}`} className={menuItemClass(`/${widget.id}`)}>
                          {label}
                       </Link>
                    </li>
                );

                if (index === standingsIndex) {
                    return <Fragment key={`group-${widget.id}`}>{item}{fuelLink}</Fragment>;
                }
                return item;
              });

              return (
                 <>
                    {items}
                    {standingsIndex === -1 && fuelLink}
                 </>
              );
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
             <Route path="/" element={<Navigate to="/settings/general" replace />} />
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
    if (widgetId === 'advanced') return <AdvancedSettings />;
    if (widgetId === 'about') return <AboutSettings />;
    
    // 2. Special Manager Pages
    // FuelSettings handles its own creation/selection logic, so we always render it 
    // if the route is /settings/fuel, even if no widget with id='fuel' exists.
    if (widgetId === 'fuel') {
         // If a widget explicitly named 'fuel' exists, we could pass it,
         // but FuelSettings defaults to selecting the first fuel widget anyway.
         // Passing widgetId="fuel" specifically might be safer if it exists.
         const hasFuelWidget = currentDashboard?.widgets.some(w => w.id === 'fuel');
         return <FuelSettings widgetId={hasFuelWidget ? 'fuel' : undefined} />;
    }
    
    // 3. Find specific widget instance
    const widget = currentDashboard?.widgets.find(w => w.id === widgetId);
    
    if (!widget) {
        return <div className="text-slate-400">Select a widget to edit</div>;
    }
    
    const type = widget.type || widget.id;
    
    switch (type) {
        case 'standings': return <StandingsSettings />;
        case 'relative': return <RelativeSettings />;
        case 'weather': return <WeatherSettings />;
        case 'fuel': return <FuelSettings widgetId={widget.id} />;
        case 'map': return <TrackMapSettings />;
        case 'flatmap': return <FlatTrackMapSettings />;
        case 'input': return <InputSettings />;
        case 'pitlanehelper': return <PitlaneHelperSettings />;
        case 'rejoin': return <RejoinIndicatorSettings />;
        case 'faster-cars': 
        case 'fastercarsfrombehind': return <FasterCarsFromBehindSettings />;
        case 'blindspotmonitor': return <BlindSpotMonitorSettings />;
        case 'garagecover': return <GarageCoverSettings />;
        default: return <div className="text-red-400">No settings available for {type}</div>;
    }
};
