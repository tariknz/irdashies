import { useState, useEffect } from 'react';
import { useDashboard } from '@irdashies/context';
import type { DashboardProfile } from '@irdashies/types';

export const ProfileSettings = () => {
  const {
    currentProfile,
    profiles,
    createProfile,
    deleteProfile,
    renameProfile,
    switchProfile,
    refreshProfiles,
  } = useDashboard();

  const [newProfileName, setNewProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

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
      setError('Cannot delete the default profile');
      return;
    }

    if (!confirm('Are you sure you want to delete this profile? This action cannot be undone.')) {
      return;
    }

    setError(null);
    try {
      await deleteProfile(profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
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
        <div className="divide-y divide-slate-700">
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
                  className={`px-4 py-3 flex items-center justify-between transition-colors ${
                    isActive ? 'bg-blue-600/20' : 'hover:bg-slate-700/50'
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
                          {profile.id === 'default' && (
                            <span className="ml-2 text-xs text-gray-400">(Default)</span>
                          )}
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
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-blue-300 font-semibold mb-2">💡 About Profiles</h4>
        <ul className="text-sm text-blue-200 space-y-1 list-disc list-inside">
          <li>Each profile has its own widget configurations and layouts</li>
          <li>Profiles are identified by unique IDs used by the component renderer</li>
          <li>Switch between profiles to use different dashboard setups</li>
          <li>The default profile cannot be deleted</li>
          <li>Profile changes are automatically saved</li>
        </ul>
      </div>
    </div>
  );
};
