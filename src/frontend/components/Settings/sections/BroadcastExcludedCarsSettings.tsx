import { useMemo } from 'react';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useDashboard, useSessionDrivers } from '@irdashies/context';
import type { Driver, ExcludedCar } from '@irdashies/types';
import { SettingsSection } from '../components/SettingSection';
import { broadcastExcludedCars } from '../broadcastModules';

interface SessionCarModel {
  carId: number;
  name: string;
  count: number;
}

const sessionCarModels = (
  drivers: readonly Driver[] | undefined
): SessionCarModel[] => {
  const models = new Map<number, SessionCarModel>();
  for (const driver of drivers ?? []) {
    if (driver.CarIsPaceCar || driver.IsSpectator) continue;
    const model = models.get(driver.CarID);
    if (model) model.count += 1;
    else
      models.set(driver.CarID, {
        carId: driver.CarID,
        name: driver.CarScreenName,
        count: 1,
      });
  }
  return [...models.values()].sort((a, b) => a.name.localeCompare(b.name));
};

const countLabel = (count: number | undefined) => {
  if (!count) return 'not in this session';
  return `${count} ${count === 1 ? 'car' : 'cars'} in this session`;
};

export const BroadcastExcludedCarsSettings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const drivers = useSessionDrivers();
  const towerConfig = currentDashboard?.widgets.find(
    (w) => w.id === 'broadcast'
  )?.config;
  const excludedCars = broadcastExcludedCars(towerConfig);
  const models = useMemo(() => sessionCarModels(drivers), [drivers]);
  const countByCarId = new Map(models.map((m) => [m.carId, m.count]));
  const missing = models.filter(
    (m) => !excludedCars.some((car) => car.carId === m.carId)
  );

  const save = (next: ExcludedCar[]) => {
    if (!currentDashboard || !onDashboardUpdated) return;
    onDashboardUpdated({
      ...currentDashboard,
      widgets: currentDashboard.widgets.map((w) =>
        w.id === 'broadcast'
          ? { ...w, config: { ...w.config, excludedCars: next } }
          : w
      ),
    });
  };

  return (
    <SettingsSection title="Excluded cars">
      <p className="text-sm text-slate-400">
        Hidden from the Tower, Ticker, Events and Podium, with every other
        car&apos;s position renumbered. The Gantry lists them separately as
        Safety car.
      </p>

      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {missing.map((model) => (
            <button
              key={model.carId}
              type="button"
              onClick={() =>
                save([
                  ...excludedCars,
                  { carId: model.carId, name: model.name },
                ])
              }
              className="settings-button"
            >
              <PlusIcon size={16} />
              Add {model.name} ({model.count})
            </button>
          ))}
        </div>
      )}

      {excludedCars.length === 0 && (
        <p className="text-sm text-slate-400">
          No cars excluded. Join a session to add its cars.
        </p>
      )}
      {excludedCars.map((car) => (
        <div
          key={car.carId}
          className="flex items-center gap-2 rounded-lg border border-settings-hover bg-settings-control/40 p-4"
        >
          <span className="flex-1 text-slate-200">{car.name}</span>
          <span className="text-sm text-slate-400">
            {countLabel(countByCarId.get(car.carId))}
          </span>
          <button
            type="button"
            aria-label={`Remove ${car.name}`}
            onClick={() =>
              save(excludedCars.filter((c) => c.carId !== car.carId))
            }
            className="settings-button-danger"
          >
            <TrashIcon size={16} />
            Remove
          </button>
        </div>
      ))}
    </SettingsSection>
  );
};
