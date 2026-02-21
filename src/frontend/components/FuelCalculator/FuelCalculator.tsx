import { useMemo, useState, useEffect, memo, useRef } from 'react';
import {
  useDashboard,
  useTelemetryStore,
  useSessionStore,
} from '@irdashies/context';
import {
  runFuelLogic,
  INITIAL_INTERNAL_STATE,
  FuelInternalState,
} from './hooks/fuelLogic';
import { useFuelStore } from './FuelStore';
import {
  FuelCalculatorHeader,
  FuelCalculatorGauge,
  FuelCalculatorConsumptionGrid,
  FuelCalculatorPitScenarios,
  FuelCalculatorTimeEmpty,
  FuelHistory,
  FuelCalculatorTargetMessage,
  FuelCalculatorConfidence,
  FuelCalculatorEconomyPredict,
} from './widgets/FuelCalculatorWidgets';
import type { FuelCalculatorSettings, FuelCalculation } from './types';
import type { LayoutNode } from '../Settings/types';
import {
  DEFAULT_FUEL_LAYOUT_TREE,
  defaultFuelCalculatorSettings,
} from './defaults';

// Custom equality check to prevent React from re-rendering the whole tree 10 times a second
// when fuelLevel just floats by 0.001L. It will re-render only if large changes happen.
function isFuelDataEqual(
  a: FuelCalculation | null,
  b: FuelCalculation | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  for (const key of Object.keys(a) as (keyof FuelCalculation)[]) {
    if (key === 'targetScenarios' || key === 'lapsRange') continue;

    // Float values that wiggle due to telemetry noise
    if (key === 'fuelLevel') {
      if (Math.abs((a.fuelLevel || 0) - (b.fuelLevel || 0)) > 0.05)
        return false;
      continue;
    }
    if (key === 'fuelTankCapacity') {
      if (Math.abs((a.fuelTankCapacity || 0) - (b.fuelTankCapacity || 0)) > 0.1)
        return false;
      continue;
    }
    if (key === 'lapsRemaining') {
      // sessionTimeRemain ticks down constantly, so lapsRemaining drifts.
      // Only re-render if it changes by a significant margin (e.g. 0.05 laps)
      if (Math.abs((a.lapsRemaining || 0) - (b.lapsRemaining || 0)) > 0.05)
        return false;
      continue;
    }
    if (key === 'projectedLapUsage' || key === 'currentLapUsage') {
      if (Math.abs((a[key] || 0) - (b[key] || 0)) > 0.05) return false;
      continue;
    }
    if (
      key === 'lapsWithFuel' ||
      key === 'fuelToFinish' ||
      key === 'fuelAtFinish' ||
      key === 'totalLaps'
    ) {
      const valA = a[key] as number;
      const valB = b[key] as number;
      if (Math.abs((valA || 0) - (valB || 0)) > 0.05) return false;
      continue;
    }
    if (a[key] !== b[key]) return false;
  }

  const aRange = a.lapsRange;
  const bRange = b.lapsRange;
  if (aRange !== bRange) {
    if (!aRange || !bRange) return false;
    if (aRange[0] !== bRange[0] || aRange[1] !== bRange[1]) return false;
  }

  const aTargets = a.targetScenarios;
  const bTargets = b.targetScenarios;
  if (aTargets !== bTargets) {
    if (!aTargets || !bTargets) return false;
    if (aTargets.length !== bTargets.length) return false;
    for (let i = 0; i < aTargets.length; i++) {
      if (
        aTargets[i].laps !== bTargets[i].laps ||
        aTargets[i].fuelPerLap !== bTargets[i].fuelPerLap ||
        aTargets[i].isCurrentTarget !== bTargets[i].isCurrentTarget
      ) {
        return false;
      }
    }
  }

  return true;
}

// --- Types ---
/* eslint-disable react/prop-types */

interface FuelCalculatorProps extends Partial<FuelCalculatorSettings> {
  settings?: FuelCalculatorSettings;
}

interface FontStyle {
  fontSize?: number;
  labelFontSize?: number;
  valueFontSize?: number;
  barFontSize?: number;
  height?: number;
}

interface FuelCalculatorViewProps {
  layoutTree: LayoutNode;
  throttledFuelData: FuelCalculation | null;
  displayData: FuelCalculation;
  frozenFuelData: FuelCalculation | null;
  frozenDisplayData: FuelCalculation;
  settings: FuelCalculatorSettings;
  derivedFontStyles: Record<string, FontStyle>;
  derivedCompactMode: boolean;
  isOnTrack: boolean;
  isSessionVisible: boolean;
  editMode: boolean;
  currentFuelLevel: number;
  predictiveUsage: number;
  fuelUnits: 'L' | 'gal';
  sessionFlags: number;
  sessionType: string | undefined;
  totalRaceLaps: number | undefined;
  backgroundOpacity: number;
}

// --- View Component (Memoized) ---
const FuelCalculatorView = memo<FuelCalculatorViewProps>((props) => {
  const {
    layoutTree,
    throttledFuelData,
    displayData,
    frozenFuelData,
    frozenDisplayData,
    settings,
    derivedFontStyles,
    derivedCompactMode,
    isOnTrack,
    isSessionVisible,
    editMode,
    currentFuelLevel,
    predictiveUsage,
    fuelUnits,
    sessionFlags,
    sessionType,
    backgroundOpacity,
    totalRaceLaps,
  } = props;
  const renderWidget = (widgetId: string) => {
    const widgetStyles = derivedFontStyles[widgetId] || derivedFontStyles;
    const widgetProps = {
      widgetId: widgetId,
      fuelData: throttledFuelData,
      displayData: displayData,
      totalRaceLaps,
      fuelUnits: fuelUnits,
      settings: settings,
      customStyles: widgetStyles,
      isCompact: derivedCompactMode,
    };

    switch (widgetId) {
      case 'fuelHeader':
        return <FuelCalculatorHeader {...widgetProps} />;
      case 'fuelGauge':
        return <FuelCalculatorGauge {...widgetProps} />;
      case 'fuelGrid':
        return (
          <FuelCalculatorConsumptionGrid
            {...widgetProps}
            fuelData={frozenFuelData}
            liveFuelData={throttledFuelData}
            liveFuelLevel={currentFuelLevel}
            predictiveUsage={predictiveUsage}
            displayData={frozenDisplayData}
            sessionFlags={sessionFlags}
            sessionType={sessionType}
            totalRaceLaps={totalRaceLaps}
          />
        );
      case 'fuelScenarios':
        return (
          <FuelCalculatorPitScenarios
            {...widgetProps}
            fuelData={frozenFuelData}
            displayData={frozenDisplayData}
          />
        );
      case 'fuelTimeEmpty':
        return <FuelCalculatorTimeEmpty {...widgetProps} />;
      case 'fuelGraph':
      case 'historyGraph':
        return <FuelHistory {...widgetProps} />;
      case 'fuelTargetMessage':
        return (
          <FuelCalculatorTargetMessage
            {...widgetProps}
            fuelData={frozenFuelData}
            displayData={frozenDisplayData}
          />
        );
      case 'fuelConfidence':
        return <FuelCalculatorConfidence {...widgetProps} />;
      case 'fuelEconomyPredict':
        return (
          <FuelCalculatorEconomyPredict
            {...widgetProps}
            fuelData={frozenFuelData}
            displayData={displayData}
          />
        );
      default:
        return null;
    }
  };

  const RecursiveWidgetRenderer = ({ node }: { node: LayoutNode }) => {
    if (!node || !node.type) return null;
    if (node.type === 'box') {
      const isHorizontalBox = node.direction === 'row';
      return (
        <div
          className="flex-1 flex flex-col min-h-[50px] justify-center w-full"
          style={{ flexGrow: node.weight || 1 }}
        >
          <div
            className={`flex-1 flex ${isHorizontalBox ? 'flex-row items-center justify-around' : 'flex-col'} w-full`}
          >
            {Array.from(new Set(node.widgets || [])).map((widgetId) => (
              <div
                key={widgetId}
                data-widget-id={widgetId}
                className="flex-1 min-w-0 flex flex-col justify-center w-full"
              >
                {renderWidget(widgetId)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (node.type === 'split') {
      return (
        <div
          className={`flex-1 flex gap-1 ${node.direction === 'row' ? 'flex-row items-center' : 'flex-col'} h-full`}
        >
          {node.children?.map((child: LayoutNode) => (
            <RecursiveWidgetRenderer key={child.id} node={child} />
          ))}
        </div>
      );
    }
    return null;
  };

  if (!editMode && settings?.showOnlyWhenOnTrack && !isOnTrack) return null;
  if (!editMode && !isSessionVisible) return null;

  const currentFuelStatus = displayData.fuelStatus || 'safe';
  const showFuelStatusBorder = settings.showFuelStatusBorder ?? true;

  const borderColorValue = showFuelStatusBorder
    ? currentFuelStatus === 'caution'
      ? '#f97316'
      : currentFuelStatus === 'danger'
        ? '#ef4444'
        : '#22c55e'
    : 'rgba(71, 85, 105, 0.4)';

  const shadowColorValue = showFuelStatusBorder
    ? currentFuelStatus === 'caution'
      ? 'rgba(249, 115, 22, 0.3)'
      : currentFuelStatus === 'danger'
        ? 'rgba(239, 68, 68, 0.3)'
        : 'rgba(34, 197, 94, 0.3)'
    : 'none';

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        className={`absolute inset-0 ${showFuelStatusBorder ? 'border-[3px]' : ''} rounded-lg transition-colors duration-500 flex flex-col p-1.5`}
        style={{
          borderColor: showFuelStatusBorder ? borderColorValue : 'transparent',
          boxShadow: showFuelStatusBorder
            ? `inset 0 0 15px rgba(0,0,0,0.5), 0 0 10px ${shadowColorValue}`
            : 'inset 0 0 15px rgba(0,0,0,0.5)',
          backgroundColor: `color-mix(in srgb, var(--color-slate-900) ${backgroundOpacity * 100}%, transparent)`,
        }}
      >
        <RecursiveWidgetRenderer node={layoutTree} />
      </div>
    </div>
  );
});

FuelCalculatorView.displayName = 'FuelCalculatorView';

const EMPTY_DATA: FuelCalculation = {
  fuelLevel: 0,
  lastLapUsage: 0,
  avgLaps: 0,
  avg10Laps: 0,
  avgAllGreenLaps: 0,
  minLapUsage: 0,
  maxLapUsage: 0,
  lapsWithFuel: 0,
  lapsRemaining: 0,
  totalLaps: 0,
  fuelToFinish: 0,
  fuelToAdd: 0,
  canFinish: false,
  targetConsumption: 0,
  confidence: 'low',
  pitWindowOpen: 0,
  pitWindowClose: 0,
  currentLap: 0,
  fuelAtFinish: 0,
  avgLapTime: 0,
  projectedLapUsage: 0,
  maxQualify: null,
  fuelStatus: 'safe',
};

// --- Bridge: reads dataRef and types ---
interface BridgeRef {
  fuelData: FuelCalculation | null;
  currentFuelLevel: number;
  isOnTrack: boolean;
  sessionFlags: number;
  qualifyConsumption: number | null;
  sessionType: string | undefined;
  totalSessionLaps: number | undefined;
  isSessionVisible: boolean;
}

// --- Performance Bridge ---
/**
 * This component handles high-frequency telemetry and calculations
 * but NEVER triggers a re-render of the parent FuelCalculator.
 * It updates a shared ref that is sampled by the throttled interval.
 */
const HeadlessTelemetryBridge = ({
  settings,
  safetyMargin,
  dataRef,
}: {
  settings: FuelCalculatorSettings;
  safetyMargin: number;
  dataRef: React.MutableRefObject<BridgeRef>;
}) => {
  const internalStateRef = useRef<FuelInternalState>(INITIAL_INTERNAL_STATE);

  // Capture settings/safetyMargin in a ref so the interval doesn't
  // need them in its dependency array (avoids recreating the interval on each settings change).
  const settingsRef = useRef({ settings, safetyMargin });
  useEffect(() => {
    settingsRef.current = { settings, safetyMargin };
  }, [settings, safetyMargin]);

  useEffect(() => {
    const interval = setInterval(() => {
      const state = useTelemetryStore.getState();
      const telemetry = state.telemetry;
      if (!telemetry) return;

      // Access FuelStore directly — NO React subscription, so writing to it never re-renders this component
      const fuelStore = useFuelStore.getState();
      const { settings: s, safetyMargin: sm } = settingsRef.current;

      // Compute session type from telemetry
      const rawSessionNum = telemetry.SessionNum?.value?.[0] as
        | number
        | undefined;
      const sessionNum = rawSessionNum ?? 0;
      const sessionInfo = useSessionStore.getState().session;
      const currentSession = sessionInfo?.SessionInfo?.Sessions?.[sessionNum];
      const sessionTypeStr = currentSession?.SessionType as string | undefined;

      // Extract total laps (official) and estimated lap time
      const totalSessionLapsStr = currentSession?.SessionLaps as
        | string
        | number
        | undefined;
      const parsedLaps =
        typeof totalSessionLapsStr === 'string'
          ? parseInt(totalSessionLapsStr, 10)
          : totalSessionLapsStr;
      const totalSessionLaps =
        parsedLaps && parsedLaps > 0 && parsedLaps < 32767
          ? parsedLaps
          : undefined;

      const driverCarIdx = sessionInfo?.DriverInfo?.DriverCarIdx;
      const drivers = sessionInfo?.DriverInfo?.Drivers;
      const driver = drivers?.find((d) => d.CarIdx === driverCarIdx);
      const rawEstLapTime = driver?.CarClassEstLapTime;
      const estLapTime =
        rawEstLapTime && isFinite(rawEstLapTime) && rawEstLapTime > 0
          ? rawEstLapTime
          : undefined;

      const { calculation, nextInternalState, actions } = runFuelLogic({
        telemetry,
        sessionType: sessionTypeStr,
        totalSessionLaps,
        estLapTime,
        fuelStore,
        internalState: internalStateRef.current,
        settings: s,
        safetyMargin: sm,
      });

      internalStateRef.current = nextInternalState;

      // Write actions directly via getState() — zero re-renders
      const storeActions = useFuelStore.getState();
      if (actions.addLapData) storeActions.addLapData(actions.addLapData);
      if (actions.addRefuel) storeActions.addRefuel(actions.addRefuel);
      if (actions.updateLapCrossing) {
        const { lapDistPct, fuelLevel, sessionTime, lap, onPitRoad } =
          actions.updateLapCrossing;
        storeActions.updateLapCrossing(
          lapDistPct,
          fuelLevel,
          sessionTime,
          lap,
          onPitRoad
        );
      }
      if (actions.updateLapDistPct !== undefined) {
        storeActions.updateLapDistPct(actions.updateLapDistPct);
      }
      if (actions.setQualifyConsumption !== undefined) {
        storeActions.setQualifyConsumption(actions.setQualifyConsumption);
      }

      const currentFuelLevel = Number(telemetry.FuelLevel?.value?.[0] || 0);
      const sessionFlags = Number(telemetry.SessionFlags?.value?.[0] || 0);
      const isOnTrack = !!telemetry.IsOnTrack?.value?.[0];

      // Evaluate session visibility by checking the settings
      const sv = s.sessionVisibility;
      let isSessionVisible = true;
      if (sv && sessionTypeStr) {
        const sessionTypeMap: Record<string, keyof typeof sv> = {
          Race: 'race',
          'Lone Qualify': 'loneQualify',
          'Open Qualify': 'openQualify',
          Practice: 'practice',
          'Offline Testing': 'offlineTesting',
        };
        const key = sessionTypeMap[sessionTypeStr];
        if (key) isSessionVisible = sv[key] ?? true;
      }

      dataRef.current = {
        fuelData: calculation,
        currentFuelLevel,
        isOnTrack,
        sessionFlags,
        qualifyConsumption: useFuelStore.getState().qualifyConsumption,
        sessionType: sessionTypeStr,
        totalSessionLaps,
        isSessionVisible,
      };
    }, 100); // 10Hz

    return () => clearInterval(interval);
  }, [dataRef]); // Only dataRef — interval is NEVER recreated on settings/store changes

  return null;
};

// --- Data & Calculation ---
export const FuelCalculator = (props: FuelCalculatorProps) => {
  const { editMode, currentDashboard } = useDashboard();

  // Consume settings from context if not provided as props
  const settings = useMemo(() => {
    const widgetConfig = currentDashboard?.widgets.find((w) => w.id === 'fuel')
      ?.config as Record<string, unknown> | undefined;
    return {
      ...defaultFuelCalculatorSettings,
      ...widgetConfig,
      ...props, // Spread props in case flat settings were passed
    } as unknown as FuelCalculatorSettings;
  }, [props, currentDashboard?.widgets]);

  const generalSettings = currentDashboard?.generalSettings;
  const { fuelUnits, safetyMargin } = settings;
  // NOTE: No useTelemetryValue/useSessionVisibility here — the bridge computes it at 10Hz

  // --- RE-RENDER ISOLATION ---
  // We use a ref to hold latest telemetry data.
  // The HeadlessTelemetryBridge updates this ref at 10Hz.
  // The FuelCalculator parent NEVER re-renders from telemetry.
  const latestDataRef = useRef<BridgeRef>({
    fuelData: null,
    currentFuelLevel: 0,
    isOnTrack: false,
    sessionFlags: 0,
    qualifyConsumption: null,
    totalSessionLaps: undefined,
    sessionType: undefined,
    isSessionVisible: true,
  });

  const derivedCompactMode = useMemo(() => {
    return settings.useGeneralCompactMode
      ? (generalSettings?.compactMode ?? false)
      : false;
  }, [settings.useGeneralCompactMode, generalSettings?.compactMode]);

  const derivedFontStyles = useMemo(() => {
    if (!settings.useGeneralFontSize || !generalSettings?.fontSize) {
      return settings.widgetStyles || {};
    }

    const sizeMap: Record<
      string,
      { label: number; value: number; bar: number }
    > = {
      xs: { label: 8, value: 12, bar: 6 },
      sm: { label: 10, value: 14, bar: 8 },
      md: { label: 12, value: 18, bar: 10 },
      lg: { label: 14, value: 22, bar: 12 },
      xl: { label: 16, value: 26, bar: 14 },
      '2xl': { label: 18, value: 30, bar: 16 },
      '3xl': { label: 20, value: 34, bar: 18 },
    };

    const preset = sizeMap[generalSettings.fontSize] || sizeMap['sm'];
    const styles = {
      labelFontSize: preset.label,
      valueFontSize: preset.value,
      barFontSize: preset.bar,
    };

    return new Proxy(
      {},
      {
        get: () => styles,
      }
    ) as unknown as Record<string, FontStyle>;
  }, [settings.useGeneralFontSize, settings.widgetStyles, generalSettings]);

  const layoutTree: LayoutNode = useMemo(() => {
    if (settings.layoutTree && (settings.layoutTree as LayoutNode).type) {
      return settings.layoutTree as LayoutNode;
    }
    return DEFAULT_FUEL_LAYOUT_TREE;
  }, [settings.layoutTree]);

  // --- Throttling Logic: pull from dataRef at 10Hz, update React state ---
  const [throttledState, setThrottledState] = useState<{
    displayData: FuelCalculation;
    totalRaceLaps?: number;
    frozenFuelData: FuelCalculation | null;
    frozenDisplayData: FuelCalculation;
    predictiveUsage: number;
    currentFuelLevel: number;
    isOnTrack: boolean;
    sessionFlags: number;
    sessionType: string | undefined;
    isSessionVisible: boolean;
  }>({
    displayData: EMPTY_DATA,
    frozenFuelData: null,
    frozenDisplayData: EMPTY_DATA,
    predictiveUsage: 0,
    currentFuelLevel: 0,
    isOnTrack: false,
    sessionFlags: 0,
    sessionType: undefined,
    isSessionVisible: true,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const {
        fuelData: currentData,
        currentFuelLevel: liveFuel,
        isOnTrack: liveOnTrack,
        sessionFlags: liveFlags,
        sessionType: liveSessionType,
        isSessionVisible: liveIsSessionVisible,
      } = latestDataRef.current;

      if (!currentData) return;

      setThrottledState((prev) => {
        // --- OBJECT STABILITY: Skip re-render if nothing important changed ---
        if (
          isFuelDataEqual(prev.displayData, currentData) &&
          Math.abs(prev.currentFuelLevel - liveFuel) < 0.05 &&
          prev.isOnTrack === liveOnTrack &&
          prev.sessionFlags === liveFlags &&
          prev.isSessionVisible === liveIsSessionVisible
        ) {
          return prev;
        }

        let nextFrozen = prev.frozenFuelData;
        if (!nextFrozen || currentData.currentLap !== nextFrozen.currentLap) {
          nextFrozen = currentData;
        }

        let nextFrozenDisplay = prev.frozenDisplayData;
        if (nextFrozen && nextFrozen !== prev.frozenFuelData) {
          const level = nextFrozen.fuelLevel;
          const avgFuelPerLap =
            nextFrozen.avgLaps || nextFrozen.lastLapUsage || 0;
          const lapsWithFuel = avgFuelPerLap > 0 ? level / avgFuelPerLap : 0;

          // At lap crossing, SessionLapsRemain can be one lap too high because
          // it may not have decremented by the time the `Lap` telemetry tick is processed.
          // If nextFrozen.lapsRemaining > (totalLaps - currentLap + 1), it's stale.
          // Clamp it: the true lapsRemaining cannot exceed (totalLaps - currentLap).
          // This prevents the surplus from being inflated at the crossing frame.
          let correctedLapsRemaining = nextFrozen.lapsRemaining || 0;
          const maxPossibleLapsRemaining =
            nextFrozen.totalLaps > 0
              ? nextFrozen.totalLaps - nextFrozen.currentLap + 1
              : correctedLapsRemaining;
          if (correctedLapsRemaining > maxPossibleLapsRemaining + 0.05) {
            correctedLapsRemaining = maxPossibleLapsRemaining;
          }

          const fuelAtFinish = level - correctedLapsRemaining * avgFuelPerLap;

          nextFrozenDisplay = {
            ...nextFrozen,
            fuelLevel: level,
            lapsRemaining: correctedLapsRemaining,
            lapsWithFuel,
            pitWindowClose: nextFrozen.currentLap + lapsWithFuel - 1,
            fuelAtFinish,
            targetScenarios: nextFrozen.targetScenarios || [],
            lastLapUsage: nextFrozen.lastLapUsage || 0,
          };
        }

        return {
          displayData: currentData,
          totalRaceLaps: latestDataRef.current.totalSessionLaps,
          frozenFuelData: nextFrozen,
          frozenDisplayData: nextFrozenDisplay,
          predictiveUsage: currentData.projectedLapUsage || 0,
          currentFuelLevel: Number(liveFuel || 0),
          isOnTrack: !!liveOnTrack,
          sessionFlags: Number(liveFlags || 0),
          sessionType: liveSessionType,
          isSessionVisible: liveIsSessionVisible,
        };
      });
    }, 200); // 5Hz UI update rate to reduce CPU usage and FPS drops

    return () => clearInterval(interval);
  }, []); // Mount only

  if (!settings) return <div className="text-red-500">Missing Settings</div>;

  return (
    <>
      <HeadlessTelemetryBridge
        settings={settings}
        safetyMargin={safetyMargin}
        dataRef={latestDataRef}
      />
      <FuelCalculatorView
        layoutTree={layoutTree}
        throttledFuelData={throttledState.displayData}
        displayData={throttledState.displayData}
        frozenFuelData={throttledState.frozenFuelData}
        frozenDisplayData={throttledState.frozenDisplayData}
        settings={settings}
        derivedFontStyles={derivedFontStyles}
        derivedCompactMode={derivedCompactMode}
        isOnTrack={throttledState.isOnTrack}
        isSessionVisible={throttledState.isSessionVisible}
        editMode={!!editMode}
        currentFuelLevel={throttledState.currentFuelLevel}
        predictiveUsage={throttledState.predictiveUsage}
        fuelUnits={fuelUnits}
        sessionFlags={throttledState.sessionFlags}
        sessionType={throttledState.sessionType}
        totalRaceLaps={throttledState.totalRaceLaps}
        backgroundOpacity={
          settings.background?.opacity !== undefined
            ? settings.background.opacity / 100
            : 0.85
        }
      />
    </>
  );
};
