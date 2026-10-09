import {
  useDashboard,
  useDriverControlsSnapshot,
  useSessionStore,
  useSessionVisibility,
  useTrackStateSnapshot,
} from '@irdashies/context';
import type { TyrePanelConfig } from '@irdashies/types';
import {
  getTemperatureCondition,
  getWearCondition,
  isAvailable,
  type TemperatureCondition,
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
  temperature?: readonly number[];
  pressure?: readonly number[];
  wear?: readonly number[];
  isLive: boolean;
}

const displayValue = (value: number | undefined, digits: number) =>
  isAvailable(value) ? value.toFixed(digits) : '—';

export function TyrePanelView({
  config,
  temperature,
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
      className="h-full w-full overflow-hidden rounded border border-slate-600/60 p-2 text-slate-100"
      style={{
        backgroundColor: `rgb(15 23 42 / ${(config.background.opacity ?? 80) / 100})`,
      }}
    >
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider">
        <span className="text-slate-400">Tyres</span>
        <span className={isLive ? 'text-emerald-400/80' : 'text-amber-300/80'}>
          {isLive ? 'Live' : 'Pit snapshot'}
        </span>
      </div>
      <div className="grid h-[calc(100%-18px)] grid-cols-2 gap-x-3 gap-y-1.5">
        {corners.map((corner, index) => {
          const temperatureC = temperature?.[index];
          const displayedTemperature =
            isAvailable(temperatureC) && config.temperatureUnit === 'F'
              ? (temperatureC * 9) / 5 + 32
              : temperatureC;
          const pressureKpa = pressure?.[index];
          const displayedPressure =
            isAvailable(pressureKpa) && config.pressureUnit === 'psi'
              ? pressureKpa * 0.1450377
              : pressureKpa;
          const temperatureCondition = getTemperatureCondition(
            temperatureC,
            coldThreshold,
            hotThreshold
          );
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
                <span className={temperatureStyles[temperatureCondition]}>
                  {displayValue(displayedTemperature, 0)}
                </span>
                <span className={temperatureStyles[temperatureCondition]}>
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
  const controls = useDriverControlsSnapshot();
  const track = useTrackStateSnapshot();
  const session = useSessionStore((state) => state.session);
  const visible = useSessionVisibility(
    config?.sessionVisibility ?? {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    }
  );

  if (
    !config ||
    !visible ||
    (config.showOnlyWhenOnTrack && !track?.isOnTrack)
  ) {
    return null;
  }

  return (
    <TyrePanelView
      config={config}
      temperature={controls?.tyreTemperature}
      pressure={controls?.tyrePressure}
      wear={controls?.tyreWear}
      isLive={session?.WeekendInfo?.SimMode === 'Le Mans Ultimate'}
    />
  );
}
