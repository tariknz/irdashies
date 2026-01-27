import { useState, useEffect } from 'react';
import { useDashboard } from '@irdashies/context';
import type { DashboardProfile, GeneralSettingsType, FontSize } from '@irdashies/types';
import { ConfirmDialog } from '../../ui/ConfirmDialog';

const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
    { value: 'xs', label: 'Extra Small' },
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
    { value: 'xl', label: 'Extra Large' },
    { value: '2xl', label: '2X Large' },
    { value: '3xl', label: '3X Large' },
];

const COLOR_PALETTES: { value: GeneralSettingsType['colorPalette']; label: string }[] = [
    { value: undefined, label: 'Use Dashboard Default' },
    { value: 'default', label: 'Slate (default)' },
    { value: 'black', label: 'Black' },
    { value: 'red', label: 'Red' },
    { value: 'orange', label: 'Orange' },
    { value: 'amber', label: 'Amber' },
    { value: 'yellow', label: 'Yellow' },
    { value: 'lime', label: 'Lime' },
    { value: 'green', label: 'Green' },
    { value: 'emerald', label: 'Emerald' },
    { value: 'teal', label: 'Teal' },
    { value: 'cyan', label: 'Cyan' },
    { value: 'sky', label: 'Sky' },
    { value: 'blue', label: 'Blue' },
    { value: 'indigo', label: 'Indigo' },
    { value: 'violet', label: 'Violet' },
    { value: 'purple', label: 'Purple' },
    { value: 'fuchsia', label: 'Fuchsia' },
    { value: 'pink', label: 'Pink' },
    { value: 'rose', label: 'Rose' },
    { value: 'zinc', label: 'Zinc' },
    { value: 'stone', label: 'Stone' },
];

export const ProfileSettings = () => {
    const {
        currentProfile,
        profiles,
        createProfile,
        deleteProfile,
        renameProfile,
        switchProfile,
        refreshProfiles,
        bridge,
    } = useDashboard();

    const [newProfileName, setNewProfileName] = useState('');
    const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
    const [editingProfileName, setEditingProfileName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [serverIP, setServerIP] = useState<string>('localhost');
    const [confirmDelete, setConfirmDelete] = useState<{
        isOpen: boolean;
        profileId: string;
        profileName: string;
    }>({ isOpen: false, profileId: '', profileName: '' });

    // Debounce state for theme settings
    const [pendingFontSize, setPendingFontSize] = useState<FontSize | '' | undefined>(currentProfile?.themeSettings?.fontSize);
    const [pendingColorPalette, setPendingColorPalette] = useState<GeneralSettingsType['colorPalette'] | ''>(currentProfile?.themeSettings?.colorPalette ?? '');
    const [pendingOpacity, setPendingOpacity] = useState<number | undefined>(currentProfile?.themeSettings?.opacity);

    useEffect(() => {
        refreshProfiles();
        // Fetch server IP
        fetch('http://localhost:3000/api/server-ip')
            .then(res => res.json())
            .catch(() => ({ ip: 'localhost' }))
            .then(data => {
                if (data.ip) {
                    setServerIP(data.ip);
                }
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync pending values when profile changes
    useEffect(() => {
        if (currentProfile) {
            setPendingFontSize(currentProfile.themeSettings?.fontSize);
            setPendingColorPalette(currentProfile.themeSettings?.colorPalette ?? '');
            setPendingOpacity(currentProfile.themeSettings?.opacity);
        }
    }, [currentProfile?.id, currentProfile?.themeSettings]);

    // Debounce font size updates (500ms delay)
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (currentProfile && bridge.updateProfileTheme && pendingFontSize !== currentProfile.themeSettings?.fontSize) {
                try {
                    await bridge.updateProfileTheme(currentProfile.id, {
                        ...currentProfile.themeSettings,
                        fontSize: pendingFontSize || undefined,
                    });
                    await refreshProfiles();
                } catch (error) {
                    console.error('Failed to update font size:', error);
                    setError('Failed to update font size');
                }
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [pendingFontSize, currentProfile, bridge, refreshProfiles]);

    // Debounce color palette updates (500ms delay)
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (currentProfile && bridge.updateProfileTheme && pendingColorPalette !== (currentProfile.themeSettings?.colorPalette ?? '')) {
                try {
                    await bridge.updateProfileTheme(currentProfile.id, {
                        ...currentProfile.themeSettings,
                        colorPalette: (pendingColorPalette as GeneralSettingsType['colorPalette']) || undefined,
                    });
                    await refreshProfiles();
                } catch (error) {
                    console.error('Failed to update color palette:', error);
                    setError('Failed to update color palette');
                }
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [pendingColorPalette, currentProfile, bridge, refreshProfiles]);

    // Debounce opacity updates (800ms delay - longer since slider produces many events)
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (currentProfile && bridge.updateProfileTheme && pendingOpacity !== currentProfile.themeSettings?.opacity) {
                try {
                    await bridge.updateProfileTheme(currentProfile.id, {
                        ...currentProfile.themeSettings,
                        opacity: pendingOpacity,
                    });
                    await refreshProfiles();
                } catch (error) {
                    console.error('Failed to update opacity:', error);
                    setError('Failed to update opacity');
                }
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [pendingOpacity, currentProfile, bridge, refreshProfiles]);

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

        const profile = profiles.find(p => p.id === profileId);
        if (!profile) return;

        setConfirmDelete({
            isOpen: true,
            profileId: profileId,
            profileName: profile.name
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
        <div className="h-full max-h-screen overflow-y-auto">
            <div className="p-6 space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">Configuration Profiles</h2>
                <p className="text-gray-400 text-sm">
                    Manage different dashboard configurations for various scenarios. Each profile stores
                    separate widget configurations and layouts.
                </p>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded">
                    {error}
                </div>
            )}

            {/* Create New Profile */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
                <h3 className="text-lg font-semibold text-white">Create New Profile</h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateProfile();
                        }}
                        placeholder="Enter profile name..."
                        disabled={isCreating}
                        className="flex-1 bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    />
                    <button
                        onClick={handleCreateProfile}
                        disabled={isCreating || !newProfileName.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition-colors"
                    >
                        {isCreating ? 'Creating...' : 'Create'}
                    </button>
                </div>
            </div>

            {/* Profiles List */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-600">
                    <h3 className="text-lg font-semibold text-white">Your Profiles</h3>
                </div>
                <div className="divide-y divide-slate-700 overflow-y-auto min-h-0">
                    {profiles.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-400">
                            No profiles found. Create your first profile above.
                        </div>
                    ) : (
                        profiles.map((profile) => {
                            const isActive = currentProfile?.id === profile.id;
                            const isEditing = editingProfileId === profile.id;

                            return (
                                <div
                                    key={profile.id}
                                    className={`px-4 py-3 flex items-center justify-between transition-colors ${isActive ? 'bg-blue-600/20' : 'hover:bg-slate-700/50'
                                        }`}
                                >
                                    <div className="flex-1 flex items-center gap-3">
                                        {isActive && (
                                            <div className="w-2 h-2 bg-blue-500 rounded-full" title="Active Profile" />
                                        )}
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editingProfileName}
                                                onChange={(e) => setEditingProfileName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEdit(profile.id);
                                                    if (e.key === 'Escape') handleCancelEdit();
                                                }}
                                                autoFocus
                                                className="flex-1 bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-sm focus:outline-none focus:border-blue-500"
                                            />
                                        ) : (
                                            <div className="flex-1">
                                                <div className="text-white font-medium">
                                                    {profile.name}
                                                </div>
                                                {profile.lastModified && (
                                                    <div className="text-xs text-gray-500">
                                                        Modified: {new Date(profile.lastModified).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        {isEditing ? (
                                            <>
                                                <button
                                                    onClick={() => handleSaveEdit(profile.id)}
                                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {!isActive && (
                                                    <button
                                                        onClick={() => handleSwitchProfile(profile.id)}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                                                    >
                                                        Switch
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => handleStartEdit(profile)}
                                                    className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                                                >
                                                    Rename
                                                </button>
                                                {profile.id !== 'default' && (
                                                    <button
                                                        onClick={() => handleDeleteProfile(profile.id)}
                                                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        const url = `http://${serverIP}:3000/dashboard?profile=${profile.id}`;
                                                        navigator.clipboard.writeText(url);
                                                    }}
                                                    className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                                                    title="Copy browser URL for this profile"
                                                >
                                                    Copy URL
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Theme Override Settings for Current Profile */}
            {currentProfile && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">
                            Theme Overrides for &quot;{currentProfile.name}&quot;
                        </h3>
                        <p className="text-sm text-gray-400">
                            Customize theme settings for this profile. Leave unset to use dashboard defaults.
                        </p>
                    </div>

                    {/* Font Size Override */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Font Size</label>
                        <select
                            value={pendingFontSize ?? ''}
                            onChange={(e) => {
                                const value = e.target.value as FontSize | '';
                                setPendingFontSize(value || undefined);
                            }}
                            className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500"
                        >
                            <option value="">Use Dashboard Default</option>
                            {FONT_SIZE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Color Palette Override */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Color Palette</label>
                        <select
                            value={pendingColorPalette ?? ''}
                            onChange={(e) => {
                                const value = e.target.value as GeneralSettingsType['colorPalette'] | '';
                                setPendingColorPalette(value);
                            }}
                            className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500"
                        >
                            {COLOR_PALETTES.map((opt, idx) => (
                                <option key={opt.value ?? `unset-${idx}`} value={opt.value ?? ''}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Opacity Override */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-300">Opacity</label>
                            <span className="text-sm text-slate-400">
                                {pendingOpacity !== undefined 
                                    ? `${Math.round((pendingOpacity ?? 1) * 100)}%`
                                    : 'Use Dashboard Default'}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={pendingOpacity !== undefined 
                                ? Math.round((pendingOpacity ?? 1) * 100)
                                : ''}
                            onChange={(e) => {
                                const percentValue = e.target.value;
                                const opacityValue = percentValue ? parseInt(percentValue) / 100 : undefined;
                                setPendingOpacity(opacityValue);
                            }}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                        </div>
                        <button
                            onClick={() => {
                                setPendingOpacity(undefined);
                            }}
                            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                        >
                            Reset to Default
                        </button>
                    </div>
                </div>
            )}

            {/* OBS Browser Source URL */}
            {currentProfile && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">
                            OBS Browser Source
                        </h3>
                        <p className="text-sm text-gray-400 mb-3">
                            Use the URL below for OBS browser sources. OBS requires IP addresses instead of localhost.
                        </p>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="text-xs font-medium text-slate-300 mb-2">Localhost (Development)</div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={`http://localhost:3000/dashboard?profile=${currentProfile.id}`}
                                className="flex-1 bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded text-sm font-mono"
                            />
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`http://localhost:3000/dashboard?profile=${currentProfile.id}`);
                                }}
                                className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors whitespace-nowrap"
                            >
                                Copy
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-xs font-medium text-slate-300 mb-2">IP Address (OBS/Streaming)</div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={`http://${serverIP}:3000/dashboard?profile=${currentProfile.id}`}
                                className="flex-1 bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded text-sm font-mono"
                            />
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`http://${serverIP}:3000/dashboard?profile=${currentProfile.id}`);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors whitespace-nowrap"
                            >
                                Copy for OBS
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Note: This URL uses your server's IP address ({serverIP}). Works in OBS browser sources and from other machines.
                        </p>
                    </div>
                </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-blue-300 font-semibold mb-2">💡 About Profiles</h4>
                <ul className="text-sm text-blue-200 space-y-1 list-disc list-inside">
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
