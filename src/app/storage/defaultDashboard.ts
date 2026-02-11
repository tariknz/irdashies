import type { DashboardLayout } from '@irdashies/types';

export const defaultDashboard: DashboardLayout = {
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
        iratingChange: {
          enabled: true,
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
        },
        interval: {
          enabled: false,
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
        },
        teamName: {
          enabled: false,
        },
        pitStatus: {
          enabled: true,
          pitLapDisplayMode: 'lapsSinceLastPit',
        },
        position: {
          enabled: true,
        },
        compound: {
          enabled: true,
        },
        carManufacturer: {
          enabled: true,
        },
        lapTimeDeltas: {
          enabled: false,
          numLaps: 3,
        },
        driverStandings: {
          buffer: 3,
          numNonClassDrivers: 3,
          minPlayerClassDrivers: 10,
          numTopDrivers: 3,
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
          airTemperature: {
            enabled: false,
            unit: 'Metric',
          },
          trackTemperature: {
            enabled: false,
            unit: 'Metric',
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
            'airTemperature',
            'trackTemperature',
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
          airTemperature: {
            enabled: true,
            unit: 'Metric',
          },
          trackTemperature: {
            enabled: true,
            unit: 'Metric',
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
            'airTemperature',
            'trackTemperature',
          ],
        },
        showOnlyWhenOnTrack: false,
        displayOrder: [
          'position',
          'carNumber',
          'countryFlags',
          'driverName',
          'teamName',
          'pitStatus',
          'carManufacturer',
          'badge',
          'iratingChange',
          'gap',
          'interval',
          'fastestTime',
          'lastTime',
          'compound',
          'lapTimeDeltas',
        ],
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
        showOnlyWhenOnTrack: false,
        showLabel: true,
        animate: true,
        blinkPeriod: 0.5,
        matrixMode: '16x16',
        showNoFlagState: true,
        enableGlow: true,
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
        height: 113,
      },
      config: {
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
          unit: 'auto',
        },
        steer: {
          enabled: true,
          config: {
            style: 'default',
            color: 'light',
          },
        },
        tachometer: {
          enabled: true,
          showRpmText: false,
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
        },
        teamName: {
          enabled: false,
        },
        pitStatus: {
          enabled: true,
          pitLapDisplayMode: 'lapsSinceLastPit',
        },
        carManufacturer: {
          enabled: true,
        },
        badge: {
          enabled: true,
          badgeFormat: 'license-color-rating-bw',
        },
        iratingChange: {
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
        displayOrder: [
          'position',
          'carNumber',
          'countryFlags',
          'driverName',
          'teamName',
          'pitStatus',
          'carManufacturer',
          'badge',
          'iratingChange',
          'delta',
          'fastestTime',
          'lastTime',
          'compound',
        ],
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
        enableTurnNames: false,
        showCarNumbers: true,
        invertTrackColors: false,
        driverCircleSize: 40,
        playerCircleSize: 40,
        trackLineWidth: 20,
        trackOutlineWidth: 40,
        useHighlightColor: false,
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
        trackLineWidth: 20,
        trackOutlineWidth: 40,
        invertTrackColors: false,
        useHighlightColor: false,
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
        wind: {
          enabled: true,
        },
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
      enabled: true,
      layout: {
        x: 588,
        y: 44,
        width: 405,
        height: 43,
      },
      config: {
        distanceThreshold: -1.5,
        onlyShowFasterClasses: true,
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
        height: 420,
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
              widgets: [
                'fuelHeader',
                'fuelConfidence',
                'fuelTargetMessage',
                'fuelGauge',
                'fuelGrid',
                'fuelScenarios',
                'fuelEconomyPredict',
                'fuelGraph',
                'fuelTimeEmpty',
              ],
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
        distAhead: 4.5,
        distBehind: 4.5,
        background: {
          opacity: 30,
        },
        width: 20,
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
        background: { opacity: 80 },
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
  ],
  generalSettings: {
    fontSize: 'sm',
    colorPalette: 'black',
    highlightColor: 960745,
    skipTaskbar: true,
    disableHardwareAcceleration: false,
    overlayAlwaysOnTop: true,
    enableNetworkAccess: false,
  },
};
