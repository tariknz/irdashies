import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'relative',
  name: 'Relative',
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
    foreground: {
      opacity: 70,
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
    radio: {
      persistenceSeconds: 3,
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
      decimalPlaces: 1,
    },
    pushToPass: { enabled: false },
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
      'pushToPass',
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
      fuelLevel: {
        enabled: false,
      },
      lastLap: {
        enabled: false,
      },
      bestLap: {
        enabled: false,
      },
      topSpeed: {
        enabled: false,
      },
      manufacturerPosition: {
        enabled: false,
      },
      classRank: {
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
        'fuelLevel',
        'lastLap',
        'bestLap',
        'topSpeed',
        'manufacturerPosition',
        'classRank',
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
      fuelLevel: {
        enabled: false,
      },
      lastLap: {
        enabled: false,
      },
      bestLap: {
        enabled: false,
      },
      topSpeed: {
        enabled: false,
      },
      manufacturerPosition: {
        enabled: false,
      },
      classRank: {
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
        'fuelLevel',
        'lastLap',
        'bestLap',
        'topSpeed',
        'manufacturerPosition',
        'classRank',
      ],
    },
    showOnlyWhenOnTrack: false,
    hideDriversInPitStall: false,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
    stylingOptions: {
      badge: false,
      statusBadges: false,
      columnHeaders: { enabled: false },
      driverPosition: { background: true },
      driverNumber: { background: true, border: true },
      flagContour: {
        enabled: false,
        borderWidth: 5,
      },
    },
  },
});
