import type { SessionVisibilitySettings } from './types';

interface SessionVisibilityConfigProps {
  sessionVisibility: SessionVisibilitySettings;
  onChange: (sessionVisibility: SessionVisibilitySettings) => void;
}

export const SessionVisibilityConfig = ({
  sessionVisibility,
  onChange,
}: SessionVisibilityConfigProps) => {
  const handleChange = (key: keyof SessionVisibilitySettings, value: boolean) => {
    onChange({
      ...sessionVisibility,
      [key]: value,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row items-center gap-2">
        <input
          type="checkbox"
          id="session-race"
          checked={sessionVisibility.race}
          onChange={(e) => handleChange('race', e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="session-race" className="cursor-pointer">
          Race
        </label>
      </div>

      <div className="flex flex-row items-center gap-2">
        <input
          type="checkbox"
          id="session-loneQualify"
          checked={sessionVisibility.loneQualify}
          onChange={(e) => handleChange('loneQualify', e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="session-loneQualify" className="cursor-pointer">
          Lone Qualifying
        </label>
      </div>

      <div className="flex flex-row items-center gap-2">
        <input
          type="checkbox"
          id="session-openQualify"
          checked={sessionVisibility.openQualify}
          onChange={(e) => handleChange('openQualify', e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="session-openQualify" className="cursor-pointer">
          Open Qualifying
        </label>
      </div>

      <div className="flex flex-row items-center gap-2">
        <input
          type="checkbox"
          id="session-practice"
          checked={sessionVisibility.practice}
          onChange={(e) => handleChange('practice', e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="session-practice" className="cursor-pointer">
          Practice
        </label>
      </div>

      <div className="flex flex-row items-center gap-2">
        <input
          type="checkbox"
          id="session-offlineTesting"
          checked={sessionVisibility.offlineTesting}
          onChange={(e) => handleChange('offlineTesting', e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="session-offlineTesting" className="cursor-pointer">
          Offline Testing
        </label>
      </div>
    </div>
  );
};
