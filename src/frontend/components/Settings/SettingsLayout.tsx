import { useEffect, useRef, useState } from 'react';
import {
  GearIcon,
  LockIcon,
  PresentationChartIcon,
} from '@phosphor-icons/react';
import {
  Route,
  Routes,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAvailableSimulators, useDashboard } from '@irdashies/context';
import {
  isProfileAssignedToGame,
  SIMULATOR_IDS,
  SIMULATOR_LABELS,
  type ActiveSimulator,
  type DashboardProfile,
  type GameDetectionStatus,
  type GameProfileAssignments,
  type SimulatorPreference,
} from '@irdashies/types';
import logger from '@irdashies/utils/logger';
import { SettingsLoader } from './SettingsLoader';
import { SettingsMenu } from './SettingsMenu';
import { useSimulatorPreference } from './useSimulatorPreference';

const HEADER_SELECT =
  'shrink-0 bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed';

const assignedProfiles = (
  profiles: DashboardProfile[],
  game: ActiveSimulator,
  assignments: GameProfileAssignments
): DashboardProfile[] =>
  profiles.filter((profile) =>
    isProfileAssignedToGame(profile.id, game, assignments)
  );

const headerGameFor = (
  preference: SimulatorPreference,
  detection: GameDetectionStatus
): ActiveSimulator | null => {
  if (preference === 'iracing' || preference === 'lmu') return preference;
  return detection.running ? detection.game : null;
};

const HeadlineProfileSelect = ({
  profiles,
  currentProfileId,
  ready,
  onSwitch,
}: {
  profiles: DashboardProfile[];
  currentProfileId: string;
  ready: boolean;
  onSwitch: (profileId: string) => void;
}) => {
  const options = ready ? profiles : [];
  const inSet = options.some((profile) => profile.id === currentProfileId);
  const value = inSet ? currentProfileId : '';
  return (
    <label
      htmlFor="headline-profile"
      className="flex items-center gap-2 text-sm font-medium"
    >
      Profile
      <select
        id="headline-profile"
        value={value}
        disabled={!ready || options.length === 0}
        onChange={(event) => onSwitch(event.target.value)}
        className={HEADER_SELECT}
      >
        {value === '' && (
          <option value="" disabled>
            Select profile
          </option>
        )}
        {options.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
    </label>
  );
};

export const SettingsLayout = () => {
  const {
    bridge,
    isDemoMode,
    toggleDemoMode,
    currentDashboard,
    currentProfile,
    profiles,
    switchProfile,
  } = useDashboard();
  const [preference, setSimulatorPreference] = useSimulatorPreference();
  const availableSimulators = useAvailableSimulators();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [editModeAccelerator, setEditModeAccelerator] = useState('F6');
  const [detection, setDetection] = useState<GameDetectionStatus>({
    game: null,
    running: false,
  });
  const [assignments, setAssignments] = useState<GameProfileAssignments>({});
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);
  const assignmentsRef = useRef<GameProfileAssignments>({});

  const headerGame = headerGameFor(preference, detection);
  const profilesReady = assignmentsLoaded;

  useEffect(() => {
    window.keybindingsBridge?.getKeybindings().then((bindings) => {
      setEditModeAccelerator(bindings['toggle-edit-mode'].accelerator);
    });
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    void bridge.getGameDetectionStatus?.().then((value) => {
      if (!cancelled && value) setDetection(value);
    });
    const unsubscribe = bridge.onGameDetectionStatus?.(setDetection);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [bridge]);

  useEffect(() => {
    let cancelled = false;
    let sawAssignments = false;

    const unsubscribeAssignments = bridge.onGameProfileAssignments?.(
      (value) => {
        sawAssignments = true;
        const next = value ?? {};
        assignmentsRef.current = next;
        setAssignments(next);
        setAssignmentsLoaded(true);
      }
    );

    const assignmentsPromise = bridge.getGameProfileAssignments?.();
    if (assignmentsPromise) {
      void assignmentsPromise
        .then((value) => {
          if (cancelled || sawAssignments) return;
          const next = value ?? {};
          assignmentsRef.current = next;
          setAssignments(next);
          setAssignmentsLoaded(true);
        })
        .catch(() => {
          if (!cancelled) setAssignmentsLoaded(true);
        });
    } else {
      setAssignmentsLoaded(true);
    }

    return () => {
      cancelled = true;
      unsubscribeAssignments?.();
    };
  }, [bridge]);

  useEffect(() => {
    const unsub = window.dashboardBridge?.onNavigateToSettings?.(
      (widgetType) => {
        navigate(`/settings/${widgetType}`);
      }
    );
    return () => unsub?.();
  }, [navigate]);

  const handleToggleLock = async () => {
    await bridge.toggleLockOverlays();
  };

  const handleProfileSwitch = (profileId: string) => {
    if (!profileId) return;
    if (
      preference !== 'auto' &&
      !isProfileAssignedToGame(
        profileId,
        preference,
        assignmentsRef.current
      )
    ) {
      return;
    }
    void switchProfile(profileId).catch((err) => {
      logger.error('Failed to switch profile', err);
    });
  };

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  const headerClass = [
    'flex flex-row gap-4 items-center justify-between -mx-4 -mt-4 px-4 py-4 rounded-t-md',
    headerGame === 'iracing' && 'bg-blue-600 text-white',
    headerGame === 'lmu' && 'bg-orange-600 text-white',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-4 bg-slate-700 p-4 rounded-md w-full h-full">
      <div className={headerClass}>
        <div className="flex flex-row gap-4 items-center min-w-0">
          <GearIcon size={32} weight="bold" />
          <div className="min-w-0">
            <div className="flex flex-row gap-x-4 gap-y-2 items-center flex-wrap">
              <h1 className="text-2xl font-bold">Overlay Settings</h1>
              <label
                htmlFor="headline-simulator"
                className="flex items-center gap-2 text-sm font-medium"
              >
                Simulator
                <select
                  id="headline-simulator"
                  value={preference}
                  onChange={(event) =>
                    setSimulatorPreference(
                      event.target.value as SimulatorPreference
                    )
                  }
                  className={HEADER_SELECT}
                >
                  <option value="auto">Auto</option>
                  {SIMULATOR_IDS.map((id) => {
                    const unavailable = !availableSimulators.includes(id);
                    return (
                      <option key={id} value={id} disabled={unavailable}>
                        {SIMULATOR_LABELS[id]}
                        {unavailable ? ' (not available in this build)' : ''}
                      </option>
                    );
                  })}
                </select>
              </label>
              <HeadlineProfileSelect
                profiles={
                  preference === 'auto'
                    ? profiles
                    : profilesReady
                      ? assignedProfiles(profiles, preference, assignments)
                      : []
                }
                currentProfileId={currentProfile?.id ?? ''}
                ready={
                  preference === 'auto' ? profiles.length > 0 : profilesReady
                }
                onSwitch={handleProfileSwitch}
              />
            </div>
            {currentProfile && (
              <p
                className={`text-sm ${headerGame ? 'text-white/80' : 'text-slate-300'}`}
              >
                {currentProfile.name} Profile
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-row gap-2 shrink-0">
          <button
            onClick={toggleDemoMode}
            className="flex flex-row gap-1.5 items-center px-3 py-2 rounded bg-slate-800 hover:bg-slate-600 transition-colors"
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
            className="flex flex-row gap-1.5 items-center px-3 py-2 rounded bg-slate-800 hover:bg-slate-600 transition-colors"
          >
            <LockIcon size={20} weight="bold" />
            <span>Edit Layout</span>
            <kbd className="ml-1 text-xs bg-black/20 px-1 rounded">
              {editModeAccelerator}
            </kbd>
          </button>
        </div>
      </div>
      <div className="flex flex-row gap-4 flex-1 min-h-0 text-sm">
        {/* Left Column - Widget Menu */}
        <SettingsMenu />

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
