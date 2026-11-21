import {
  useActiveSimulator,
  useCarConditionSnapshot,
  useDashboard,
  useSessionVisibility,
  useTrackStateSelector,
  trackStateSelectors,
} from '@irdashies/context';
import type { TyrePanelConfig } from '@irdashies/types';
import {
  getTemperatureCondition,
  getWearCondition,
  isAvailable,
  tyreZoneTemperatures,
  type TemperatureCondition,
  type TyreZoneReading,
  type WearCondition,
} from './tyreConditions';

const corners = ['FL', 'FR', 'RL', 'RR'] as const;

const temperatureStyles: Record<TemperatureCondition, string> = {
  cold: 'text-sky-300',
  optimal: 'text-emerald-400',
  hot: 'text-orange-400',
  unavailable: 'text-slate-500',
};

const wearStyles: Record<WearCondition, string> = {
  healthy: 'text-emerald-400',
  worn: 'text-amber-400',
  replace: 'text-red-400',
  unavailable: 'text-slate-500',
};

interface TyrePanelViewProps {
  config: TyrePanelConfig;
  temperatures?: readonly (readonly TyreZoneReading[])[];
  pressure?: readonly (number | null)[];
  wear?: readonly (number | null)[];
  isLive: boolean;
}

const displayValue = (value: number | null | undefined, digits: number) =>
  isAvailable(value) ? value.toFixed(digits) : '—';

const toDisplayTemperature = (
  celsius: TyreZoneReading,
  unit: TyrePanelConfig['temperatureUnit']
) => (isAvailable(celsius) && unit === 'F' ? (celsius * 9) / 5 + 32 : celsius);

export function TyrePanelView({
  config,
  temperatures,
  pressure,
  wear,
  isLive,
}: TyrePanelViewProps) {
  const coldThreshold = config.temperatureThresholds?.cold ?? 70;
  const hotThreshold = config.temperatureThresholds?.hot ?? 100;
  const wornThreshold = config.wearThresholds?.worn ?? 60;
  const replaceThreshold = config.wearThresholds?.replace ?? 30;

  return (
    <div
      className="h-full w-full overflow-hidden rounded border border-slate-600/60 bg-slate-900/(--bg-opacity) p-2 text-slate-100"
      style={{
        ['--bg-opacity' as string]: `${config.background.opacity ?? 80}%`,
      }}
    >
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider">
        <span className="text-slate-400">Tyres</span>
        <span className="text-slate-500">In · Mid · Out</span>
        <span className={isLive ? 'text-emerald-400/80' : 'text-amber-300/80'}>
          {isLive ? 'Live' : 'Pit snapshot'}
        </span>
      </div>
      <div className="grid h-[calc(100%-18px)] grid-cols-2 gap-x-3 gap-y-1.5">
        {corners.map((corner, index) => {
          const zones = temperatures?.[index] ?? [];
          const pressureKpa = pressure?.[index];
          const displayedPressure =
            isAvailable(pressureKpa) && config.pressureUnit === 'psi'
              ? pressureKpa * 0.1450377
              : pressureKpa;
          const wearCondition = getWearCondition(
            wear?.[index],
            wornThreshold,
            replaceThreshold
          );

          return (
            <div
              className="flex min-w-0 items-start justify-between rounded-sm border border-slate-700/70 bg-slate-800/70 px-2 py-1"
              key={corner}
            >
              <span className="text-xs font-bold leading-4 text-white">
                {corner}
              </span>
              <div className="flex flex-col items-end font-mono text-sm font-semibold leading-4">
                <div className="flex gap-2">
                  {[0, 1, 2].map((zone) => (
                    <span
                      key={zone}
                      className={
                        temperatureStyles[
                          getTemperatureCondition(
                            zones[zone],
                            coldThreshold,
                            hotThreshold
                          )
                        ]
                      }
                    >
                      {displayValue(
                        toDisplayTemperature(
                          zones[zone],
                          config.temperatureUnit
                        ),
                        0
                      )}
                    </span>
                  ))}
                </div>
                <span
                  className={
                    isAvailable(pressureKpa)
                      ? 'text-slate-200'
                      : 'text-slate-500'
                  }
                >
                  {displayValue(displayedPressure, 1)}
                </span>
                <span className={wearStyles[wearCondition]}>
                  {isAvailable(wear?.[index])
                    ? `${((wear?.[index] as number) * 100).toFixed(0)}%`
                    : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TyrePanel() {
  const { currentDashboard } = useDashboard();
  const config = currentDashboard?.widgets.find(
    (widget) => (widget.type || widget.id) === 'tyrepanel'
  )?.config as TyrePanelConfig | undefined;
  const car = useCarConditionSnapshot();
  const isOnTrack = useTrackStateSelector(trackStateSelectors.isOnTrack);
  const isLmu = useActiveSimulator() === 'lmu';
  const visible = useSessionVisibility(
    config?.sessionVisibility ?? {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    }
  );

  if (!config || !visible || (config.showOnlyWhenOnTrack && !isOnTrack)) {
    return null;
  }

  return (
    <TyrePanelView
      config={config}
      temperatures={[0, 1, 2, 3].map((index) =>
        tyreZoneTemperatures(
          index,
          car?.tyreTemperatureLeft,
          car?.tyreTemperatureMiddle,
          car?.tyreTemperatureRight
        )
      )}
      pressure={car?.tyrePressure}
      wear={car?.tyreWear}
      isLive={isLmu}
    />
  );
}
