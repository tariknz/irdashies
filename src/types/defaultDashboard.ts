import type { GeneralSettingsType } from './dashboardLayout';
import type { TypedDashboardWidget, WidgetConfigMap } from './widgetConfigs';

export const defaultDashboard: {
  widgets: TypedDashboardWidget[];
  generalSettings?: GeneralSettingsType;
} = {
  widgets: [
    {
      id: 'standings',
      enabled: true,
      layout: {
        x: 6,
        y: 10,
        width: 560,
        height: 774,
      },
      config: {
        useLivePosition: false,
        iratingChange: {
          enabled: true,
        },
        positionChange: {
          enabled: false,
        },
        badge: {
          enabled: true,
          badgeFormat: 'license-color-rating-bw',
        },
        delta: {
          enabled: true,
        },
        gap: {
          enabled: false,
          decimalPlaces: 1,
        },
        interval: {
          enabled: false,
          decimalPlaces: 1,
        },
        lastTime: {
          enabled: true,
          timeFormat: 'full',
        },
        fastestTime: {
          enabled: true,
          timeFormat: 'full',
        },
        background: {
          opacity: 80,
        },
        countryFlags: {
          enabled: true,
        },
        carNumber: {
          enabled: true,
        },
        driverName: {
          enabled: true,
          showStatusBadges: true,
          removeNumbersFromName: false,
        },
        teamName: {
          enabled: false,
        },
        pitStatus: {
          enabled: true,
          showPitTime: true,
          pitLapDisplayMode: 'lastPitLap',
        },
        position: {
          enabled: true,
        },
        compound: {
          enabled: true,
        },
        carManufacturer: {
          enabled: true,
          hideIfSingleMake: false,
        },
        lapTimeDeltas: {
          enabled: false,
          numLaps: 3,
        },
        avgLapTime: {
          enabled: false,
          numLaps: 5,
          timeFormat: 'mixed',
        },
        driverStandings: {
          buffer: 3,
          numNonClassDrivers: 3,
          minPlayerClassDrivers: 10,
          numTopDrivers: 3,
          topDriverDivider: 'theme',
        },
        titleBar: {
          enabled: false,
          progressBar: {
            enabled: true,
          },
        },
        headerBar: {
          enabled: true,
          sessionName: {
            enabled: true,
          },
          sessionTime: {
            enabled: true,
            mode: 'Remaining',
          },
          sessionLaps: {
            enabled: true,
          },
          incidentCount: {
            enabled: true,
          },
          brakeBias: {
            enabled: false,
          },
          localTime: {
            enabled: false,
          },
          sessionClockTime: {
            enabled: false,
          },
          trackWetness: {
            enabled: false,
          },
          precipitation: {
            enabled: false,
          },
          airTemperature: {
            enabled: false,
            unit: 'Metric',
          },
          trackTemperature: {
            enabled: false,
            unit: 'Metric',
          },
          wind: {
            enabled: false,
          },
          trackName: {
            enabled: false,
          },
          displayOrder: [
            'sessionName',
            'sessionTime',
            'sessionLaps',
            'incidentCount',
            'brakeBias',
            'localTime',
            'sessionClockTime',
            'trackWetness',
            'precipitation',
            'airTemperature',
            'trackTemperature',
            'wind',
            'trackName',
          ],
        },
        footerBar: {
          enabled: true,
          sessionName: {
            enabled: false,
          },
          sessionTime: {
            enabled: false,
            mode: 'Remaining',
          },
          sessionLaps: {
            enabled: true,
          },
          incidentCount: {
            enabled: false,
          },
          brakeBias: {
            enabled: false,
          },
          localTime: {
            enabled: true,
          },
          sessionClockTime: {
            enabled: false,
          },
          trackWetness: {
            enabled: true,
          },
          precipitation: {
            enabled: false,
          },
          airTemperature: {
            enabled: true,
            unit: 'Metric',
          },
          trackTemperature: {
            enabled: true,
            unit: 'Metric',
          },
          wind: {
            enabled: false,
          },
          trackName: {
            enabled: false,
          },
          displayOrder: [
            'sessionName',
            'sessionTime',
            'sessionLaps',
            'incidentCount',
            'brakeBias',
            'localTime',
            'sessionClockTime',
            'trackWetness',
            'precipitation',
            'airTemperature',
            'trackTemperature',
            'wind',
            'trackName',
          ],
        },
        showOnlyWhenOnTrack: false,
        displayOrder: [
          'position',
          'carNumber',
          'countryFlags',
          'driverName',
          'driverTag',
          'teamName',
          'pitStatus',
          'carManufacturer',
          'badge',
          'iratingChange',
          'positionChange',
          'gap',
          'interval',
          'fastestTime',
          'lastTime',
          'compound',
          'lapTimeDeltas',
          'avgLapTime',
        ],
        driverTag: { enabled: false },
        sessionVisibility: {
          race: true,
          loneQualify: true,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
      },
    },
    {
      id: 'flag',
      enabled: false,
      layout: {
        x: 100,
        y: 50,
        width: 190,
        height: 240,
      },
      config: {
        enabled: true,
        showOnlyWhenOnTrack: false,
        showLabel: true,
        animate: true,
        blinkPeriod: 0.5,
        matrixMode: '16x16',
        showNoFlagState: true,
        enableGlow: true,
        doubleFlag: false,
        sessionVisibility: {
          race: true,
          loneQualify: true,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
      },
    },
    {
      id: 'input',
      enabled: true,
      layout: {
        x: 622,
        y: 864,
        width: 396,
        height: 92,
      },
      config: {
        useRawValues: false,
        trace: {
          enabled: true,
          includeThrottle: true,
          includeBrake: true,
          includeAbs: true,
          includeSteer: true,
          includeClutch: false,
          strokeWidth: 3,
          maxSamples: 400,
        },
        bar: {
          enabled: true,
          includeClutch: true,
          includeBrake: true,
          includeThrottle: true,
          includeAbs: true,
        },
        gear: {
          enabled: true,
          size: 100,
          showspeed: true,
          showspeedunit: true,
          unit: 'auto',
        },
        abs: {
          enabled: false,
        },
        steer: {
          enabled: true,
          config: {
            style: 'default',
            color: 'light',
          },
        },
        background: {
          opacity: 80,
        },
        showOnlyWhenOnTrack: true,
        displayOrder: ['trace', 'bar', 'gear', 'steer'],
        sessionVisibility: {
          race: true,
          loneQualify: true,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
      },
    },
    {
      id: 'tachometer',
      enabled: false,
      layout: {
        x: 622,
        y: 864,
        width: 496,
        height: 50,
      },
      config: {
        showRpmText: false,
        rpmOrientation: 'horizontal',
        shiftPointSettings: {
          enabled: false,
          indicatorType: 'glow',
          indicatorColor: '#00ff00',
          carConfigs: {},
        },
        background: { opacity: 80 },
        showOnlyWhenOnTrack: true,
        sessionVisibility: {
          race: true,
          loneQualify: true,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
      },
    },
    {
      id: 'relative',
      enabled: true,
      layout: {
        x: 7,
        y: 674,
        width: 402,
        height: 300,
      },
      config: {
        buffer: 3,
        useLivePosition: false,
        background: {
          opacity: 80,
        },
        position: {
          enabled: true,
        },
        carNumber: {
          enabled: true,
        },
        countryFlags: {
          enabled: true,
        },
        driverName: {
          enabled: true,
          showStatusBadges: true,
          removeNumbersFromName: false,
        },
        teamName: {
          enabled: false,
        },
        pitStatus: {
          enabled: true,
          showPitTime: true,
          pitLapDisplayMode: 'lastPitLap',
        },
        carManufacturer: {
          enabled: true,
          hideIfSingleMake: false,
        },
        badge: {
          enabled: true,
          badgeFormat: 'license-color-rating-bw',
        },
        iratingChange: {
          enabled: false,
        },
        positionChange: {
          enabled: false,
        },
        delta: {
          enabled: true,
          precision: 2,
        },
        fastestTime: {
          enabled: false,
          timeFormat: 'full',
        },
        lastTime: {
          enabled: false,
          timeFormat: 'full',
        },
        compound: {
          enabled: false,
        },
        lapTimeDeltas: {
          enabled: false,
          numLaps: 3,
        },
        displayOrder: [
          'position',
          'carNumber',
          'countryFlags',
          'driverName',
          'driverTag',
          'teamName',
          'pitStatus',
          'carManufacturer',
          'badge',
          'iratingChange',
          'positionChange',
          'delta',
          'fastestTime',
          'lastTime',
          'compound',
          'lapTimeDeltas',
        ],
        driverTag: { enabled: false },
        titleBar: {
          enabled: false,
          progressBar: {
            enabled: true,
          },
        },
        headerBar: {
          enabled: true,
          sessionName: {
            enabled: true,
          },
          sessionTime: {
            enabled: true,
            mode: 'Remaining',
          },
          sessionLaps: {
            enabled: true,
          },
          incidentCount: {
            enabled: true,
          },
          brakeBias: {
            enabled: true,
          },
          localTime: {
            enabled: false,
          },
          sessionClockTime: {
            enabled: false,
          },
          trackWetness: {
            enabled: false,
          },
          precipitation: {
            enabled: false,
          },
          airTemperature: {
            enabled: false,
            unit: 'Metric',
          },
          trackTemperature: {
            enabled: false,
            unit: 'Metric',
          },
          wind: {
            enabled: false,
          },
          trackName: {
            enabled: false,
          },
          displayOrder: [
            'sessionName',
            'sessionTime',
            'sessionLaps',
            'incidentCount',
            'brakeBias',
            'localTime',
            'sessionClockTime',
            'trackWetness',
            'precipitation',
            'airTemperature',
            'trackTemperature',
            'wind',
            'trackName',
          ],
        },
        footerBar: {
          enabled: true,
          sessionName: {
            enabled: false,
          },
          sessionTime: {
            enabled: false,
            mode: 'Remaining',
          },
          sessionLaps: {
            enabled: true,
          },
          incidentCount: {
            enabled: false,
          },
          brakeBias: {
            enabled: false,
          },
          localTime: {
            enabled: true,
          },
          sessionClockTime: {
            enabled: false,
          },
          trackWetness: {
            enabled: true,
          },
          precipitation: {
            enabled: false,
          },
          airTemperature: {
            enabled: true,
            unit: 'Metric',
          },
          trackTemperature: {
            enabled: true,
            unit: 'Metric',
          },
          wind: {
            enabled: false,
          },
          trackName: {
            enabled: false,
          },
          displayOrder: [
            'sessionName',
            'sessionTime',
            'sessionLaps',
            'incidentCount',
            'brakeBias',
            'localTime',
            'sessionClockTime',
            'trackWetness',
            'precipitation',
            'airTemperature',
            'trackTemperature',
            'wind',
            'trackName',
          ],
        },
        showOnlyWhenOnTrack: false,
        sessionVisibility: {
          race: true,
          loneQualify: true,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
      },
    },
    {
      id: 'map',
      enabled: true,
      layout: {
        x: 1102,
        y: 41,
        width: 407,
        height: 227,
      },
      config: {
        turnLabels: {
          enabled: false,
          labelType: 'both',
          highContrast: true,
          labelFontSize: 100,
        },
        showCarNumbers: true,
        invertTrackColors: false,
        driverCircleSize: 40,
        playerCircleSize: 40,
        trackmapFontSize: 100,
        trackLineWidth: 20,
        trackOutlineWidth: 40,
        useHighlightColor: false,
        invertLeaderColor: false,
        showOnlyWhenOnTrack: false,
        sessionVisibility: {
          race: true,
          loneQualify: true,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
        styling: { isMinimalTrack: false, isMinimalCar: false },
        sectorColoring: { enabled: false },
      },
    },
    {
      id: 'flatmap',
      enabled: false,
      layout: {
        x: 622,
        y: 700,
        width: 800,
        height: 150,
      },
      config: {
        showCarNumbers: true,
        displayMode: 'carNumber',
        driverCircleSize: 40,
        playerCircleSize: 40,
        trackmapFontSize: 100,
        trackLineWidth: 20,
        trackOutlineWidth: 40,
        invertTrackColors: false,
        useHighlightColor: false,
        invertLeaderColor: false,
        showOnlyWhenOnTrack: false,
        sessionVisibility: {
          race: true,
          loneQualify: true,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
      },
    },
    {
      id: 'weather',
      enabled: true,
      layout: {
        x: 1334,
        y: 271,
        width: 174,
        height: 425,
      },
      config: {
        background: {
          opacity: 25,
        },
        units: 'auto',
        displayOrder: [
          'trackTemp',
          'airTemp',
          'wind',
          'humidity',
          'precipitation',
          'wetness',
          'trackState',
        ],
        airTemp: {
          enabled: true,
        },
        trackTemp: {
          enabled: true,
        },
        wetness: {
          enabled: true,
        },
        trackState: {
          enabled: true,
        },
        humidity: {
          enabled: true,
        },
        precipitation: {
          enabled: false,
        },
        wind: {
          enabled: true,
        },
        showOnlyWhenOnTrack: false,
        sessionVisibility: {
          race: true,
          loneQualify: true,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
      },
    },
    {
      id: 'fastercarsfrombehind',
      enabled: false,
      layout: {
        x: 588,
        y: 44,
        width: 405,
        height: 43,
      },
      config: {
        distanceThreshold: -1.5,
        onlyShowFasterClasses: true,
        showOnlyWhenOnTrack: false,
        numberDriversBehind: 3,
        alignDriverBoxes: 'Top',
        closestDriverBox: 'Top',
        showName: true,
        removeNumbersFromName: false,
        showDistance: true,
        showBadge: false,
        sessionVisibility: {
          race: true,
          loneQualify: false,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
      },
    },
    {
      id: 'fuel',
      enabled: false,
      layout: {
        x: 1102,
        y: 240,
        width: 300,
        height: 520,
      },
      config: {
        showOnlyWhenOnTrack: true,
        fuelUnits: 'L',
        layout: 'vertical',
        showConsumption: true,
        showFuelLevel: true,
        showLapsRemaining: true,
        showMin: true,
        showCurrentLap: true,
        showLastLap: true,
        show3LapAvg: true,
        show10LapAvg: true,
        showMax: true,
        showPitWindow: true,
        showEnduranceStrategy: true,
        showFuelScenarios: true,
        showFuelRequired: true,
        showQualifyConsumption: true,
        showFuelHistory: true,
        fuelHistoryType: 'histogram',
        safetyMargin: 0,
        background: {
          opacity: 85,
        },
        fuelRequiredMode: 'toFinish',
        enableTargetPitLap: false,
        targetPitLap: 15,
        targetPitLapBasis: 'avg',
        enableStorage: true,
        enableLogging: false,
        showFuelStatusBorder: true,
        economyPredictMode: 'live',
        useGeneralFontSize: false,
        useGeneralCompactMode: false,
        sessionVisibility: {
          race: true,
          loneQualify: true,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
        layoutConfig: [],
        layoutTree: {
          id: 'root-fuel-default',
          type: 'split',
          direction: 'col',
          children: [
            {
              id: 'box-1',
              type: 'box',
              direction: 'col',
              widgets: ['fuelHeader', 'fuelGauge', 'fuelGrid'],
            },
          ],
        },
        consumptionGridOrder: ['curr', 'avg', 'max', 'last', 'min', 'qual'],
        avgLapsCount: 5,
        fuelStatusThresholds: {
          green: 60,
          amber: 30,
          red: 10,
        },
        fuelStatusBasis: 'avg',
        fuelStatusRedLaps: 3,
        widgetStyles: {
          fuelGraph: {
            height: 64,
            labelFontSize: 10,
            valueFontSize: 12,
            barFontSize: 8,
          },
          fuelHeader: {
            labelFontSize: 10,
            valueFontSize: 14,
          },
          fuelConfidence: {
            labelFontSize: 10,
            valueFontSize: 12,
          },
          fuelGauge: {
            labelFontSize: 10,
            valueFontSize: 12,
          },
          fuelTimeEmpty: {
            labelFontSize: 10,
            valueFontSize: 14,
          },
          fuelGrid: {
            labelFontSize: 10,
            valueFontSize: 12,
          },
          fuelScenarios: {
            labelFontSize: 10,
            valueFontSize: 12,
          },
          fuelTargetMessage: {
            labelFontSize: 10,
            valueFontSize: 12,
          },
          fuelEconomyPredict: {
            labelFontSize: 12,
            valueFontSize: 14,
          },
        },
      },
    },
    {
      id: 'blindspotmonitor',
      enabled: false,
      layout: {
        x: 378,
        y: 102,
        width: 800,
        height: 500,
      },
      config: {
        showOnlyWhenOnTrack: false,
        distAhead: 4.5,
        distBehind: 4.5,
        background: {
          opacity: 30,
        },
        width: 20,
        borderSize: 1,
        indicatorColor: 16096779,
        sessionVisibility: {
          race: true,
          loneQualify: true,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
      },
    },
    {
      id: 'garagecover',
      enabled: false,
      layout: {
        x: 50,
        y: 50,
        width: 600,
        height: 540,
      },
      config: {
        imageFilename: '',
      },
    },
    {
      id: 'rejoin',
      enabled: false,
      layout: {
        x: 378,
        y: 102,
        width: 800,
        height: 500,
      },
      config: {
        showAtSpeed: 30,
        clearGap: 3.5,
        careGap: 2,
        stopGap: 1,
        width: 20,
        sessionVisibility: {
          race: true,
          loneQualify: false,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
      },
    },
    {
      id: 'laptimelog',
      enabled: false,
      layout: {
        x: 300,
        y: 100,
        width: 250,
        height: 250,
      },
      config: {
        scale: 100,
        alignment: 'top',
        reverse: false,
        showCurrentLap: true,
        showPredictedLap: true,
        showLastLap: true,
        showBestLap: true,
        delta: {
          enabled: true,
          method: 'bestlap',
        },
        history: {
          enabled: true,
          count: 10,
        },
        background: {
          opacity: 80,
        },
        foreground: {
          opacity: 70,
        },
        sessionVisibility: {
          race: true,
          loneQualify: true,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
        showOnlyWhenOnTrack: true,
      },
    },
    {
      id: 'slowcarahead',
      enabled: false,
      layout: {
        x: 300,
        y: 100,
        width: 450,
        height: 50,
      },
      config: {
        maxDistance: 250,
        slowSpeedThreshold: 50,
        stoppedSpeedThreshold: 5,
        barThickness: 10,
        showOnlyWhenOnTrack: true,
        sessionVisibility: {
          race: true,
          loneQualify: false,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
      },
    },
    {
      id: 'telemetryinspector',
      enabled: false,
      layout: {
        x: 50,
        y: 50,
        width: 250,
        height: 200,
      },
      config: {
        background: {
          opacity: 80,
        },
        properties: [
          { source: 'telemetry', path: 'Speed', label: 'Speed' },
          { source: 'telemetry', path: 'SessionTime', label: 'Session Time' },
        ],
      },
    },
    {
      id: 'pitlanehelper',
      enabled: false,
      layout: {
        x: 100,
        y: 100,
        width: 150,
        height: 200,
      },
      config: {
        showMode: 'approaching',
        approachDistance: 200,
        enablePitLimiterWarning: true,
        enableEarlyPitboxWarning: true,
        earlyPitboxThreshold: 75,
        showPitlaneTraffic: true,
        showPastPitBox: false,
        showSpeedSummary: true,
        showSpeedDelta: true,
        speedUnit: 'auto',
        speedLimitStyle: 'text',
        progressBarOrientation: 'horizontal',
        speedBarOrientation: 'horizontal',
        showProgressBar: true,
        showSpeedBar: true,
        showPitExitInputs: false,
        pitExitInputs: { throttle: true, clutch: false },
        showInputsPhase: 'atPitbox',
        background: { opacity: 80 },
        sessionVisibility: {
          race: true,
          loneQualify: false,
          openQualify: false,
          practice: true,
          offlineTesting: true,
        },
      },
    },
    {
      id: 'twitchchat',
      alwaysEnabled: true,
      enabled: false,
      layout: {
        x: 378,
        y: 102,
        width: 400,
        height: 500,
      },
      config: {
        fontSize: 16,
        channel: '',
        background: {
          opacity: 30,
        },
      },
    },
    {
      id: 'infobar',
      enabled: false,
      layout: {
        x: 0,
        y: 0,
        width: 800,
        height: 60,
      },
      config: {
        enabled: true,
        sessionName: { enabled: true },
        sessionTime: {
          enabled: true,
          mode: 'Remaining',
          totalFormat: 'minimal',
          labelStyle: 'minimal',
        },
        sessionLaps: { enabled: true, mode: 'Elapsed' },
        incidentCount: { enabled: true },
        brakeBias: { enabled: false },
        localTime: { enabled: true },
        sessionClockTime: { enabled: false },
        trackWetness: { enabled: false },
        precipitation: { enabled: false },
        airTemperature: { enabled: false, unit: 'Metric' },
        trackTemperature: { enabled: true, unit: 'Metric' },
        wind: { enabled: false, speedPosition: 'right' },
        trackName: { enabled: false },
        background: { opacity: 80 },
        showOnlyWhenOnTrack: false,
        sessionVisibility: {
          race: true,
          loneQualify: true,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
        displayOrder: [
          'sessionName',
          'sessionTime',
          'sessionLaps',
          'incidentCount',
          'brakeBias',
          'localTime',
          'sessionClockTime',
          'trackWetness',
          'precipitation',
          'airTemperature',
          'trackTemperature',
          'wind',
          'trackName',
        ],
      },
    },
    {
      id: 'sectordelta',
      enabled: false,
      layout: {
        x: 6,
        y: 800,
        width: 300,
        height: 60,
      },
      config: {
        background: { opacity: 80 },
        timeFormat: 'full',
        ghostComparison: 'prefer-ghost',
        showOnlyWhenOnTrack: true,
        sessionVisibility: {
          race: true,
          loneQualify: true,
          openQualify: true,
          practice: true,
          offlineTesting: true,
        },
      },
    },
  ],
  generalSettings: {
    fontType: 'lato',
    fontSize: 'sm',
    fontWeight: 'normal',
    colorPalette: 'black',
    showOnlyWhenOnTrack: true,
    highlightColor: 960745,
    skipTaskbar: true,
    disableHardwareAcceleration: false,
    enableAutoStart: false,
    startMinimized: false,
    closeToTray: true,
    compactMode: 'off' as const,
    overlayAlwaysOnTop: true,
    enableNetworkAccess: false,
  },
};

export function getWidgetDefaultConfig<K extends keyof WidgetConfigMap>(
  id: K
): WidgetConfigMap[K] {
  const widget = defaultDashboard.widgets.find((w) => w.id === id) as
    | TypedDashboardWidget<K>
    | undefined;
  if (!widget) throw new Error(`No default config found for widget: ${id}`);
  return widget.config;
}

/**
 * Deep merges a saved widget config with the default config.
 * - Saved values take precedence over defaults.
 * - Missing fields are filled from the default.
 * - Nested objects are merged recursively.
 * - Arrays named "displayOrder" are merged to preserve existing order while
 *   inserting any new default items at their relative position.
 */
export function deepMergeConfig(
  defaultCfg: Record<string, unknown>,
  savedCfg: unknown
): Record<string, unknown> {
  if (!savedCfg || typeof savedCfg !== 'object' || Array.isArray(savedCfg)) {
    return { ...defaultCfg };
  }

  const saved = savedCfg as Record<string, unknown>;
  const result: Record<string, unknown> = { ...defaultCfg };

  for (const key of Object.keys(saved)) {
    const savedVal = saved[key];
    const defaultVal = result[key];

    if (savedVal === undefined) continue;

    if (
      key === 'displayOrder' &&
      Array.isArray(savedVal) &&
      Array.isArray(defaultVal)
    ) {
      result[key] = mergeDisplayOrder(
        defaultVal as string[],
        savedVal as string[]
      );
    } else if (
      savedVal !== null &&
      typeof savedVal === 'object' &&
      !Array.isArray(savedVal) &&
      defaultVal !== null &&
      typeof defaultVal === 'object' &&
      !Array.isArray(defaultVal)
    ) {
      result[key] = deepMergeConfig(
        defaultVal as Record<string, unknown>,
        savedVal
      );
    } else {
      result[key] = savedVal;
    }
  }

  return result;
}

function mergeDisplayOrder(
  defaultOrder: string[],
  savedOrder: string[]
): string[] {
  const merged = [...savedOrder];
  const missing = defaultOrder.filter((id) => !merged.includes(id));

  for (const missingId of missing) {
    const defaultIdx = defaultOrder.indexOf(missingId);
    let insertAt = merged.length;

    for (let i = defaultIdx + 1; i < defaultOrder.length; i++) {
      const afterIdx = merged.indexOf(defaultOrder[i]);
      if (afterIdx !== -1) {
        insertAt = afterIdx;
        break;
      }
    }

    merged.splice(insertAt, 0, missingId);
  }

  return merged;
}
