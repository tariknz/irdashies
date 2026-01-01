import { SessionVisibilitySettings } from '../types';
import { ToggleSwitch } from './ToggleSwitch';

interface SessionVisibilityProps {
    sessionVisibility: SessionVisibilitySettings;
    handleConfigChange: (newConfig: any) => void;
}

export const SessionVisibility = ({ sessionVisibility, handleConfigChange }: SessionVisibilityProps) => {
    return (
        < div className="space-y-4" >
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">Session visibility</h3>
            </div>
            {/* Show In Race Session */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-md font-medium text-slate-300">Show In Race Session</h4>
                    <p className="text-sm text-slate-400">
                        If enabled, standings will be shown in Race sessions.
                    </p>
                </div>
                <ToggleSwitch
                    enabled={sessionVisibility.race ?? false}
                    onToggle={(enabled) =>
                        handleConfigChange({ sessionVisibility: { ...sessionVisibility, race: enabled } })
                    }
                />
            </div>

            {/* Show In Lone Qualify Session */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-md font-medium text-slate-300">Show In Lone Qualify Session</h4>
                    <p className="text-sm text-slate-400">
                        If enabled, standings will be shown in Lone Qualify sessions.
                    </p>
                </div>
                <ToggleSwitch
                    enabled={sessionVisibility.loneQualify ?? false}
                    onToggle={(enabled) =>
                        handleConfigChange({ sessionVisibility: { ...sessionVisibility, loneQualify: enabled } })
                    }
                />
            </div>

            {/* Show In Open Qualify Session */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-md font-medium text-slate-300">Show In Open Qualify Session</h4>
                    <p className="text-sm text-slate-400">
                        If enabled, standings will be shown in Open Qualify sessions.
                    </p>
                </div>
                <ToggleSwitch
                    enabled={sessionVisibility.openQualify ?? false}
                    onToggle={(enabled) =>
                        handleConfigChange({ sessionVisibility: { ...sessionVisibility, openQualify: enabled } })
                    }
                />
            </div>

            {/* Show In Practice Session */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-md font-medium text-slate-300">Show In Practice Session</h4>
                    <p className="text-sm text-slate-400">
                        If enabled, standings will be shown in Practice sessions.
                    </p>
                </div>
                <ToggleSwitch
                    enabled={sessionVisibility.practice ?? false}
                    onToggle={(enabled) =>
                        handleConfigChange({ sessionVisibility: { ...sessionVisibility, practice: enabled } })
                    }
                />
            </div>

            {/* Show In Offline Testing Session */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-md font-medium text-slate-300">Show In Offline Testing Session</h4>
                    <p className="text-sm text-slate-400">
                        If enabled, standings will be shown in Offline Testing sessions.
                    </p>
                </div>
                <ToggleSwitch
                    enabled={sessionVisibility.offlineTesting ?? false}
                    onToggle={(enabled) =>
                        handleConfigChange({ sessionVisibility: { ...sessionVisibility, offlineTesting: enabled } })
                    }
                />
            </div>
        </div >)
}