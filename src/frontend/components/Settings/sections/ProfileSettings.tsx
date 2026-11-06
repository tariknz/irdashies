import { ToggleSwitch } from '../components/ToggleSwitch';
import { useState, useEffect, useRef } from 'react';
import { SettingsPopover } from '../components/SettingsPopover';
import { useDashboard } from '@irdashies/context';
import type {
  DashboardProfile,
  ProfileTriggerKey,
  SessionProfileMap,
} from '@irdashies/types';
import {
  SESSION_PROFILE_KEYS,
  SESSION_PROFILE_LABELS,
  SPOTTING_TRIGGER_KEY,
  SPOTTING_TRIGGER_LABEL,
} from '@irdashies/types';
import logger from '@irdashies/utils/logger';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  CopySimpleIcon,
  PencilSimpleIcon,
  CaretDownIcon,
  TrashIcon,
  ArrowSquareOutIcon,
} from '@phosphor-icons/react';

interface SessionProfileRowProps {
  triggerKey: ProfileTriggerKey;
  label: string;
  profiles: DashboardProfile[];
  value: string;
  disabled: boolean;
  onChange: (triggerKey: ProfileTriggerKey, profileId: string) => void;
}

const SessionProfileRow = ({
  triggerKey,
  label,
  profiles,
  value,
  disabled,
  onChange,
}: SessionProfileRowProps) => (
  <div className="flex items-center justify-between gap-4">
    <label
      htmlFor={`session-profile-${triggerKey}`}
      className="text-md font-medium text-slate-300"
    >
      {label}
    </label>
    <select
      id={`session-profile-${triggerKey}`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(triggerKey, e.target.value)}
      className="settings-field  min-w-52 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">Don&apos;t switch</option>
      {profiles.map((profile) => (
        <option key={profile.id} value={profile.id}>
          {profile.name}
        </option>
      ))}
    </select>
  </div>
);

export const ProfileSettings = () => {
  const {
    currentDashboard,
    currentProfile,
    profiles,
    bridge,
    createProfile,
    cloneProfile,
    deleteProfile,
    renameProfile,
    switchProfile,
    refreshProfiles,
  } = useDashboard();

  const webServerEnabled =
    currentDashboard?.generalSettings?.enableWebServer ?? true;

  const [cycleProfiles, setCycleProfiles] = useState(false);
  const [showProfileBanner, setShowProfileBanner] = useState(true);
  const [sessionProfileMap, setSessionProfileMap] = useState<SessionProfileMap>(
    {}
  );
  // The rows stay disabled until the stored map has arrived. Editing one before
  // then would build a new map from an empty one and wipe what is on disk.
  const [sessionProfileMapLoaded, setSessionProfileMapLoaded] = useState(false);

  // Every write sends the whole map, so it must be derived from the newest one
  // rather than from a render's closure. Two edits in quick succession would
  // otherwise both build on the same state and the second would drop the
  // first's selection.
  const sessionProfileMapRef = useRef<SessionProfileMap>({});
  // Writes are chained so they reach storage in the order they were made. Two
  // in flight at once can otherwise be persisted out of order, leaving the
  // stored map disagreeing with what the page shows.
  const sessionProfileWrites = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    bridge.getCycleProfiles?.().then((v) => setCycleProfiles(v ?? false));
    bridge
      .getShowProfileBanner?.()
      .then((v) => setShowProfileBanner(v ?? true));
    bridge.getSessionProfileMap?.().then((v) => {
      sessionProfileMapRef.current = v ?? {};
      setSessionProfileMap(v ?? {});
      setSessionProfileMapLoaded(true);
    });
  }, [bridge]);

  const persistSessionProfileMap = (next: SessionProfileMap) => {
    sessionProfileMapRef.current = next;
    setSessionProfileMap(next);
    sessionProfileWrites.current = sessionProfileWrites.current
      .then(() => bridge.setSessionProfileMap?.(next))
      .catch((err) => {
        logger.error('Failed to save the session profile map', err);
      });
  };

  const handleSessionProfileChange = (
    triggerKey: ProfileTriggerKey,
    profileId: string
  ) => {
    // An empty selection drops the key entirely rather than storing a blank,
    // so "no profile" and "profile deleted" stay the same thing on disk.
    persistSessionProfileMap(
      Object.fromEntries(
        Object.entries({
          ...sessionProfileMapRef.current,
          [triggerKey]: profileId,
        }).filter(([, id]) => Boolean(id))
      ) as SessionProfileMap
    );
  };

  /**
   * Fills in every session type with the profile in use right now.
   *
   * This is what the feature used to do behind the user's back on first run, to
   * keep the page from looking inert. It is the same convenience offered as a
   * choice: nothing is mapped until someone presses this, so an install that
   * never opens the section never switches profiles.
   *
   * Spotting is left out on purpose. It is a state rather than a session type,
   * and filling it in would change the overlay the first time the player steps
   * out of the car.
   */
  const handleUseCurrentProfileForAll = () => {
    if (!currentProfile) return;
    persistSessionProfileMap({
      ...sessionProfileMapRef.current,
      ...Object.fromEntries(
        SESSION_PROFILE_KEYS.map((key) => [key, currentProfile.id])
      ),
    } as SessionProfileMap);
  };

  const handleToggleCycleProfiles = async (checked: boolean) => {
    await bridge.setCycleProfiles?.(checked);
    setCycleProfiles(checked);
  };

  const handleToggleShowProfileBanner = async (checked: boolean) => {
    await bridge.setShowProfileBanner?.(checked);
    setShowProfileBanner(checked);
  };

  const [newProfileName, setNewProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverIP, setServerIP] = useState<string>('localhost');
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [serverPortError, setServerPortError] = useState<string | null>(null);
  const browserUrlsReady = webServerEnabled && serverPort !== null;
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    profileId: string;
    profileName: string;
  }>({ isOpen: false, profileId: '', profileName: '' });
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const popupAnchor = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const close = () => setOpenDropdownId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    refreshProfiles();
    // Fetch server port and IP via IPC
    // A legacy bridge without port discovery uses the original default. While
    // discovery is pending, keep browser actions unavailable rather than guess.
    const portPromise = bridge.getComponentServerPort
      ? bridge.getComponentServerPort()
      : Promise.resolve(3000);
    portPromise
      .then((port) => {
        setServerPort(port);
        // A missing LAN address can safely fall back to localhost on this port.
        return fetch(`http://localhost:${port}/api/server-ip`)
          .then((res) => res.json())
          .catch(() => ({ ip: 'localhost' }))
          .then((data) => {
            if (data.ip) {
              setServerIP(data.ip);
            }
          });
      })
      .catch((err) => {
        logger.warn('Failed to load the browser source port', err);
        setServerPortError(
          'Could not load browser source URLs. Close and reopen Profiles to try again.'
        );
      });
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, []);

  const browserUrlFor = (profileId: string, host = serverIP) =>
    serverPort === null
      ? ''
      : `http://${host}:${serverPort}/dashboard?profile=${encodeURIComponent(profileId)}`;

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      setError('Profile name cannot be empty');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      await createProfile(newProfileName.trim());
      setNewProfileName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (profileId === 'default') {
      setError('Cannot delete the Default profile');
      return;
    }

    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;

    setConfirmDelete({
      isOpen: true,
      profileId: profileId,
      profileName: profile.name,
    });
  };

  const handleConfirmDelete = async () => {
    const { profileId } = confirmDelete;
    setConfirmDelete({ isOpen: false, profileId: '', profileName: '' });

    setError(null);
    try {
      await deleteProfile(profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete({ isOpen: false, profileId: '', profileName: '' });
  };

  const handleCloneProfile = async (profile: DashboardProfile) => {
    setError(null);
    try {
      const cloned = await cloneProfile(profile.id);
      setEditingProfileId(cloned.id);
      setEditingProfileName(cloned.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone profile');
    }
  };

  const handleStartEdit = (profile: DashboardProfile) => {
    setEditingProfileId(profile.id);
    setEditingProfileName(profile.name);
    setError(null);
  };

  const handleSaveEdit = async (profileId: string) => {
    if (!editingProfileName.trim()) {
      setError('Profile name cannot be empty');
      return;
    }

    setError(null);
    try {
      await renameProfile(profileId, editingProfileName.trim());
      setEditingProfileId(null);
      setEditingProfileName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename profile');
    }
  };

  const handleCancelEdit = () => {
    setEditingProfileId(null);
    setEditingProfileName('');
    setError(null);
  };

  const handleSwitchProfile = async (profileId: string) => {
    setError(null);
    try {
      await switchProfile(profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch profile');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none border-b border-slate-700 px-1 pb-5 pt-1">
        <h2 className="mb-1 text-xl font-semibold tracking-tight text-white">
          Configuration Profiles
        </h2>
        <p className="text-slate-400">
          Manage different dashboard configurations for various scenarios. Each
          profile stores separate widget configurations and layouts.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pt-5 pr-1 [scrollbar-gutter:stable]">
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Create New Profile */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-semibold text-white">
            Create New Profile
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProfile();
              }}
              aria-label="New profile name"
              placeholder="Enter profile name..."
              disabled={isCreating}
              className="settings-field flex-1  disabled:opacity-50"
            />
            <button
              onClick={handleCreateProfile}
              disabled={isCreating || !newProfileName.trim()}
              className="bg-accent-600 hover:bg-accent-700 disabled:bg-settings-control disabled:text-slate-400 disabled:cursor-not-allowed text-on-accent px-4 py-2 rounded font-medium transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>

        {/* Profiles List */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-slate-700/50 border-b border-settings-boundary">
            <h3 className="text-lg font-semibold text-white">Your Profiles</h3>
            <p className="text-sm text-slate-400 mt-1">
              Browser and OBS widget positions are saved separately from the
              desktop layout. Use Actions &gt; Edit Browser Layout to drag and
              resize widgets for OBS, then copy the same profile URL into your
              browser source.
            </p>
          </div>
          <div className="divide-y divide-slate-700 overflow-y-auto min-h-0">
            {profiles.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400">
                No profiles found. Create your first profile above.
              </div>
            ) : (
              profiles.map((profile) => {
                const isActive = currentProfile?.id === profile.id;
                const isEditing = editingProfileId === profile.id;

                return (
                  <div
                    key={profile.id}
                    className={`px-4 py-3 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                      isActive ? 'bg-accent-600/20' : 'hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex-1 flex items-center gap-3">
                      {isActive && (
                        <div
                          className="w-2 h-2 bg-accent-500 rounded-full"
                          title="Active Profile"
                        />
                      )}
                      {isEditing ? (
                        <input
                          type="text"
                          aria-label={`Name for ${profile.name}`}
                          value={editingProfileName}
                          onChange={(e) =>
                            setEditingProfileName(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(profile.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          autoFocus
                          className="settings-field flex-1"
                        />
                      ) : (
                        <div className="flex-1">
                          <div className="text-white font-medium">
                            {profile.name}
                          </div>
                          {profile.lastModified && (
                            <div className="text-xs text-slate-500">
                              Modified:{' '}
                              {new Date(profile.lastModified).toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(profile.id)}
                            className="settings-button-primary"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="settings-button"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {!isActive && (
                            <button
                              onClick={() => handleSwitchProfile(profile.id)}
                              className="settings-button-primary"
                            >
                              Switch
                            </button>
                          )}

                          {browserUrlsReady && (
                            <button
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  browserUrlFor(profile.id)
                                )
                              }
                              className="settings-button"
                              title="Copy browser URL for this profile"
                            >
                              Copy URL
                            </button>
                          )}

                          {/* Actions dropdown */}
                          <div className="relative">
                            <button
                              aria-expanded={openDropdownId === profile.id}
                              aria-controls={
                                openDropdownId === profile.id
                                  ? `profile-actions-${profile.id}`
                                  : undefined
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                popupAnchor.current = e.currentTarget;
                                setOpenDropdownId(
                                  openDropdownId === profile.id
                                    ? null
                                    : profile.id
                                );
                              }}
                              className="settings-button"
                            >
                              Actions
                              <CaretDownIcon size={12} />
                            </button>
                          </div>
                          <SettingsPopover
                            open={openDropdownId === profile.id}
                            anchorRef={popupAnchor}
                            onClose={() => setOpenDropdownId(null)}
                            label={`${profile.name} actions`}
                            id={`profile-actions-${profile.id}`}
                          >
                            {browserUrlsReady && (
                              <a
                                href={browserUrlFor(profile.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setOpenDropdownId(null)}
                                className="flex min-h-9 w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-settings-hover"
                                title="Open this profile in your browser to arrange its OBS widgets"
                              >
                                <ArrowSquareOutIcon size={14} />
                                Edit Browser Layout
                              </a>
                            )}
                            <button
                              onClick={() => {
                                popupAnchor.current?.focus();
                                setOpenDropdownId(null);
                                handleCloneProfile(profile);
                              }}
                              className="flex min-h-9 w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-settings-hover"
                            >
                              <CopySimpleIcon size={14} />
                              Clone
                            </button>
                            <button
                              onClick={() => {
                                popupAnchor.current?.focus();
                                setOpenDropdownId(null);
                                handleStartEdit(profile);
                              }}
                              className="flex min-h-9 w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-settings-hover"
                            >
                              <PencilSimpleIcon size={14} />
                              Rename
                            </button>
                            {profile.id !== 'default' && (
                              <button
                                onClick={() => {
                                  popupAnchor.current?.focus();
                                  setOpenDropdownId(null);
                                  handleDeleteProfile(profile.id);
                                }}
                                className="flex min-h-9 w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm text-red-300 hover:bg-settings-hover"
                              >
                                <TrashIcon size={14} />
                                Delete
                              </button>
                            )}
                          </SettingsPopover>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Profile Switching Options */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4
                id="cycle-profiles-label"
                className="text-md font-medium text-slate-300"
              >
                Cycle Profiles
              </h4>
              <p className="text-sm text-slate-400">
                When switching profiles with the keyboard shortcut, wrap around
                from the last profile back to the first (and vice versa).
              </p>
            </div>
            <ToggleSwitch
              enabled={cycleProfiles}
              onToggle={(enabled) => handleToggleCycleProfiles(enabled)}
              ariaLabelledBy="cycle-profiles-label"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h4
                id="show-profile-banner-label"
                className="text-md font-medium text-slate-300"
              >
                Show Profile Name Banner
              </h4>
              <p className="text-sm text-slate-400">
                Briefly display the profile name on the overlay when switching
                profiles.
              </p>
            </div>
            <ToggleSwitch
              enabled={showProfileBanner}
              onToggle={(enabled) => handleToggleShowProfileBanner(enabled)}
              ariaLabelledBy="show-profile-banner-label"
            />
          </div>
        </div>

        {/* Session mapping */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Switch Profile By Session
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              Set a profile for each session type and it is applied
              automatically as the event moves from practice through to the
              race. A session left on Don&apos;t switch keeps whatever profile
              you are already on, so to come back to a layout, map that session
              to it rather than leaving it unset.
            </p>
          </div>

          <div className="space-y-2">
            {SESSION_PROFILE_KEYS.map((key) => (
              <SessionProfileRow
                key={key}
                triggerKey={key}
                label={SESSION_PROFILE_LABELS[key]}
                profiles={profiles}
                value={sessionProfileMap[key] ?? ''}
                disabled={!sessionProfileMapLoaded}
                onChange={handleSessionProfileChange}
              />
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleUseCurrentProfileForAll}
              disabled={!sessionProfileMapLoaded || !currentProfile}
              className="text-sm text-accent-400 hover:text-accent-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Use {currentProfile?.name ?? 'current profile'} for all sessions
            </button>
          </div>

          <div className="border-t border-slate-700 pt-3 space-y-2">
            <SessionProfileRow
              triggerKey={SPOTTING_TRIGGER_KEY}
              label={SPOTTING_TRIGGER_LABEL}
              profiles={profiles}
              value={sessionProfileMap[SPOTTING_TRIGGER_KEY] ?? ''}
              disabled={!sessionProfileMapLoaded}
              onChange={handleSessionProfileChange}
            />
            <p className="text-sm text-slate-400">
              Applied while you are in a session but not in the car, whichever
              session type it is, and handed back as soon as you are driving
              again.
            </p>
          </div>
        </div>

        {/* OBS Browser Source URL - only meaningful while the web server runs */}
        {currentProfile && !webServerEnabled && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">
              OBS Browser Source
            </h3>
            <p className="text-sm text-slate-400">
              The built-in web server is turned off, so browser source URLs are
              unavailable. Re-enable it under Settings &rarr; General &rarr;
              Enable Web Server (requires restart).
            </p>
          </div>
        )}

        {currentProfile && webServerEnabled && serverPort === null && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">
              OBS Browser Source
            </h3>
            <p
              className="text-sm text-slate-400"
              role={serverPortError ? 'alert' : 'status'}
            >
              {serverPortError ?? 'Loading browser source URLs...'}
            </p>
          </div>
        )}

        {currentProfile && browserUrlsReady && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                OBS Browser Source
              </h3>
              <p className="text-sm text-slate-400 mb-3">
                Use the URL below for OBS browser sources. OBS requires IP
                addresses instead of localhost.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-300 mb-2">
                Localhost (Development)
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={browserUrlFor(currentProfile.id, 'localhost')}
                  className="settings-field flex-1 font-mono"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      browserUrlFor(currentProfile.id, 'localhost')
                    );
                  }}
                  className="border border-settings-boundary bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-300 mb-2">
                IP Address (OBS/Streaming)
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={browserUrlFor(currentProfile.id)}
                  className="settings-field flex-1 font-mono"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      browserUrlFor(currentProfile.id)
                    );
                  }}
                  className="bg-accent-600 hover:bg-accent-700 text-on-accent px-3 py-2 rounded text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Copy for OBS
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Note: This URL uses your server&apos;s IP address ({serverIP}).
                Works in OBS browser sources and from other machines.
              </p>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
          <h4 className="text-slate-200 font-semibold mb-2">About Profiles</h4>
          <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>Each profile has its own widget configurations and layouts</li>
            <li>Switch between profiles to use different dashboard setups</li>
            <li>The Default cannot be deleted</li>
            <li>Profile changes are automatically saved</li>
          </ul>
        </div>

        {/* Confirmation Dialog */}
        <ConfirmDialog
          isOpen={confirmDelete.isOpen}
          title="Delete Profile"
          message={`Are you sure you want to delete the profile "${confirmDelete.profileName}"? This action cannot be undone and all widget configurations for this profile will be permanently lost.`}
          confirmText="Delete Profile"
          cancelText="Keep Profile"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          variant="danger"
        />
      </div>
    </div>
  );
};
