import { useMemo, useState } from 'react';
import {
  DownloadSimpleIcon,
  PlusIcon,
  TrashIcon,
  UploadSimpleIcon,
} from '@phosphor-icons/react';
import { useDashboard, useSessionDrivers } from '@irdashies/context';
import {
  PIT_PROFILE_LIMITS,
  type PitServiceProfile,
  type PitTyreChange,
} from '@irdashies/types';
import { SettingNumberRow } from '../components/SettingNumberRow';
import { SettingsSection } from '../components/SettingSection';
import {
  exportPitProfiles,
  importPitProfiles,
  newPitProfile,
  readGantryPitStops,
  withGantryPitStops,
} from './gantryPitStopEdits';

const smallButtonClass =
  'flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors';

const TYRE_FIELDS: { key: PitTyreChange; label: string }[] = [
  { key: 'front', label: 'Front tyres' },
  { key: 'rear', label: 'Rear tyres' },
  { key: 'left', label: 'Left side tyres' },
  { key: 'right', label: 'Right side tyres' },
  { key: 'all', label: 'All four tyres' },
];

const ProfileEditor = ({
  profile,
  onChange,
  onDelete,
}: {
  profile: PitServiceProfile;
  onChange: (profile: PitServiceProfile) => void;
  onDelete: () => void;
}) => {
  const { tyreSeconds, fuelRate, driverChangeSeconds, fuelPerLap, tankLitres } =
    PIT_PROFILE_LIMITS;
  return (
    <div className="space-y-3 rounded border border-slate-700 bg-slate-800/40 p-3">
      <div className="flex items-center gap-2">
        <input
          aria-label="Profile name"
          value={profile.name}
          onChange={(event) =>
            onChange({ ...profile, name: event.target.value })
          }
          className="flex-1 rounded-md bg-slate-900 border border-slate-600 px-2 py-1 text-sm text-white"
        />
        <span className="font-mono text-xs text-slate-500">
          {profile.carPath}
        </span>
        <button
          type="button"
          onClick={onDelete}
          className={`${smallButtonClass} border-red-800 text-red-300 hover:bg-red-900/40`}
        >
          <TrashIcon size={12} />
          Remove
        </button>
      </div>
      <SettingNumberRow
        title="Fuel rate"
        description="Litres added per second. Fuel and tyres are done one after the other; work it out from a fuel-only stop, such as 37.2 L in 38 s = 0.98."
        value={profile.fuelRate}
        min={fuelRate.min}
        max={fuelRate.max}
        step={0.01}
        units="L/s"
        onChange={(value) => onChange({ ...profile, fuelRate: value })}
      />
      {TYRE_FIELDS.map(({ key, label }) => (
        <SettingNumberRow
          key={key}
          title={label}
          description={
            key === 'left'
              ? 'For series that change one side at a time. Leave at 0 when the car does not offer it.'
              : undefined
          }
          value={profile.tyres[key]}
          min={tyreSeconds.min}
          max={tyreSeconds.max}
          step={0.01}
          units="s"
          onChange={(value) =>
            onChange({ ...profile, tyres: { ...profile.tyres, [key]: value } })
          }
        />
      ))}
      <SettingNumberRow
        title="Driver change"
        description="A swap on its own. It runs alongside the service, so it only lengthens a stop shorter than this."
        value={profile.driverChangeSeconds}
        min={driverChangeSeconds.min}
        max={driverChangeSeconds.max}
        step={0.5}
        units="s"
        onChange={(value) =>
          onChange({ ...profile, driverChangeSeconds: value })
        }
      />
      <SettingNumberRow
        title="Fuel per lap"
        description="Typical use. With it, the stint length tells a long fuel stop from fuel and tyres. 0 if unknown."
        value={profile.fuelPerLap}
        min={fuelPerLap.min}
        max={fuelPerLap.max}
        step={0.01}
        units="L"
        onChange={(value) => onChange({ ...profile, fuelPerLap: value })}
      />
      <SettingNumberRow
        title="Tank size"
        description="Rules out more fuel than the car holds. 0 if unknown."
        value={profile.tankLitres}
        min={tankLitres.min}
        max={tankLitres.max}
        step={1}
        units="L"
        onChange={(value) => onChange({ ...profile, tankLitres: value })}
      />
    </div>
  );
};

/** Settings > Gantry > Pit Stops. */
export const GantryPitStopSettings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const drivers = useSessionDrivers();
  const [message, setMessage] = useState('');

  const pitStops = readGantryPitStops(currentDashboard);
  const sessionCars = useMemo(() => {
    const cars = new Map<string, string>();
    for (const driver of drivers ?? []) {
      if (driver.CarIsPaceCar || !driver.CarPath) continue;
      cars.set(driver.CarPath, driver.CarScreenName || driver.CarPath);
    }
    return [...cars].map(([carPath, name]) => ({ carPath, name }));
  }, [drivers]);

  if (!currentDashboard) return null;

  const commit = (profiles: PitServiceProfile[]) =>
    onDashboardUpdated?.(withGantryPitStops(currentDashboard, { profiles }));
  const update = (index: number, profile: PitServiceProfile) =>
    commit(pitStops.profiles.map((p, i) => (i === index ? profile : p)));

  const missing = sessionCars.filter(
    (car) => !pitStops.profiles.some((p) => p.carPath === car.carPath)
  );

  const download = () => {
    const blob = new Blob([exportPitProfiles(pitStops.profiles)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'irdashies-pit-timings.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SettingsSection title="Pit Stops">
      <p className="text-sm text-slate-400">
        Pit timings for each car. The Pit Stops tab compares how long a car sat
        in its stall with these to estimate what was done. Export them to share
        with your team.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {missing.map((car) => (
          <button
            key={car.carPath}
            type="button"
            onClick={() =>
              commit([
                ...pitStops.profiles,
                newPitProfile(car.carPath, car.name),
              ])
            }
            className={`${smallButtonClass} border-slate-600 text-slate-200 hover:bg-slate-700`}
          >
            <PlusIcon size={12} />
            Add {car.name}
          </button>
        ))}
        <button
          type="button"
          onClick={download}
          disabled={pitStops.profiles.length === 0}
          className={`${smallButtonClass} border-slate-600 text-slate-200 hover:bg-slate-700 disabled:opacity-50`}
        >
          <DownloadSimpleIcon size={12} />
          Export
        </button>
        <label
          className={`${smallButtonClass} cursor-pointer border-slate-600 text-slate-200 hover:bg-slate-700`}
        >
          <UploadSimpleIcon size={12} />
          Import
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              file
                .text()
                .then((text) => {
                  const result = importPitProfiles(pitStops.profiles, text);
                  if (!result)
                    return setMessage('That file is not a pit timings export.');
                  commit(result.profiles);
                  setMessage(
                    `Imported ${result.imported} car${result.imported === 1 ? '' : 's'}.`
                  );
                })
                .catch(() => setMessage('That file could not be read.'));
            }}
          />
        </label>
        {message && <span className="text-xs text-slate-400">{message}</span>}
      </div>

      {pitStops.profiles.length === 0 && (
        <p className="text-sm text-slate-500">
          No cars yet. Join a session to add its cars, or import a file.
        </p>
      )}
      {pitStops.profiles.map((profile, index) => (
        <ProfileEditor
          key={profile.id}
          profile={profile}
          onChange={(next) => update(index, next)}
          onDelete={() =>
            commit(pitStops.profiles.filter((_, i) => i !== index))
          }
        />
      ))}
    </SettingsSection>
  );
};
